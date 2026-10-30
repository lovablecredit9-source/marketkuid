ALTER TABLE public.orders ADD COLUMN payment_method text;

CREATE TABLE public.order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  amount bigint NOT NULL,
  proof_path text NOT NULL,
  method_id uuid,
  method_label text NOT NULL DEFAULT 'QRIS',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_payments_checkout_idx ON public.order_payments (checkout_id);
CREATE INDEX order_payments_status_idx ON public.order_payments (status, created_at DESC);
GRANT SELECT ON public.order_payments TO authenticated;
GRANT ALL ON public.order_payments TO service_role;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or admin order payments" ON public.order_payments FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Credit the seller's Saldo Marketku once per completed order.
CREATE OR REPLACE FUNCTION public.credit_seller_for_order(p_order uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE; v_amt bigint;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order;
  IF o.id IS NULL OR o.status <> 'completed' OR o.payment_method IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM wallet_ledger WHERE ref_id = o.id AND kind = 'sale') THEN RETURN; END IF;
  v_amt := o.subtotal - o.discount;
  IF v_amt <= 0 THEN RETURN; END IF;
  INSERT INTO wallets (user_id, balance) VALUES (o.seller_id, v_amt)
    ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + EXCLUDED.balance, updated_at = now();
  INSERT INTO wallet_ledger (user_id, amount, kind, ref_id, note) VALUES (o.seller_id, v_amt, 'sale', o.id, 'Penjualan M-' || o.order_no);
END $$;
REVOKE EXECUTE ON FUNCTION public.credit_seller_for_order(uuid) FROM PUBLIC, anon, authenticated;

-- Mark an order paid, auto-deliver stock items, complete when everything is delivered.
CREATE OR REPLACE FUNCTION public.fulfill_paid_order(p_order uuid, p_method text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it record; codes text[]; all_done boolean := true;
BEGIN
  UPDATE orders SET status = 'paid', paid_at = now(), payment_method = p_method, updated_at = now() WHERE id = p_order AND status = 'pending';
  IF NOT FOUND THEN RETURN; END IF;
  FOR it IN SELECT * FROM order_items WHERE order_id = p_order LOOP
    IF it.product_type = 'preorder' OR it.variant_id IS NULL THEN all_done := false; CONTINUE; END IF;
    WITH picked AS (
      SELECT id, content FROM product_stock WHERE variant_id = it.variant_id AND status = 'available' ORDER BY created_at LIMIT it.qty FOR UPDATE SKIP LOCKED
    ), upd AS (
      UPDATE product_stock s SET status = 'sold' FROM picked WHERE s.id = picked.id RETURNING picked.content
    ) SELECT array_agg(content) INTO codes FROM upd;
    IF codes IS NULL OR array_length(codes, 1) < it.qty THEN
      -- not enough stock: put back what was taken, seller delivers manually
      IF codes IS NOT NULL THEN
        UPDATE product_stock SET status = 'available' WHERE variant_id = it.variant_id AND status = 'sold' AND content = ANY(codes);
      END IF;
      all_done := false; CONTINUE;
    END IF;
    UPDATE order_items SET delivered = delivered || codes WHERE id = it.id;
  END LOOP;
  IF all_done THEN
    UPDATE orders SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = p_order;
    UPDATE products p SET sold_count = sold_count + x.q FROM (SELECT product_id, sum(qty) q FROM order_items WHERE order_id = p_order GROUP BY product_id) x WHERE p.id = x.product_id;
    PERFORM public.credit_seller_for_order(p_order);
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.fulfill_paid_order(uuid, text) FROM PUBLIC, anon, authenticated;

-- Buyer pays a whole checkout with Saldo Marketku (no QRIS unique code needed).
CREATE OR REPLACE FUNCTION public.pay_order_with_wallet(p_checkout uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_due bigint; v_bal bigint; o record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Masuk dulu'; END IF;
  IF public.is_account_banned(uid) THEN RAISE EXCEPTION 'Akun kamu sedang diblokir'; END IF;
  PERFORM 1 FROM orders WHERE checkout_id = p_checkout AND buyer_id = uid AND status = 'pending' FOR UPDATE;
  SELECT COALESCE(sum(subtotal - discount), 0) INTO v_due FROM orders WHERE checkout_id = p_checkout AND buyer_id = uid AND status = 'pending';
  IF v_due <= 0 THEN RAISE EXCEPTION 'Tidak ada pesanan yang perlu dibayar'; END IF;
  IF EXISTS (SELECT 1 FROM orders WHERE checkout_id = p_checkout AND buyer_id = uid AND status = 'pending' AND expires_at IS NOT NULL AND expires_at < now()) THEN
    RAISE EXCEPTION 'Waktu bayar sudah habis, buat pesanan baru';
  END IF;
  IF EXISTS (SELECT 1 FROM order_payments WHERE checkout_id = p_checkout AND status = 'pending') THEN
    RAISE EXCEPTION 'Bukti QRIS sedang dicek admin';
  END IF;
  INSERT INTO wallets (user_id, balance) VALUES (uid, 0) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_bal FROM wallets WHERE user_id = uid FOR UPDATE;
  IF v_bal < v_due THEN RAISE EXCEPTION 'Saldo tidak cukup. Saldo kamu Rp%, perlu Rp%', v_bal, v_due; END IF;
  UPDATE wallets SET balance = balance - v_due, updated_at = now() WHERE user_id = uid RETURNING balance INTO v_bal;
  INSERT INTO wallet_ledger (user_id, amount, kind, ref_id, note) VALUES (uid, -v_due, 'purchase', p_checkout, 'Bayar pesanan dengan saldo');
  FOR o IN SELECT id FROM orders WHERE checkout_id = p_checkout AND buyer_id = uid AND status = 'pending' LOOP
    UPDATE orders SET unique_code = 0, total = subtotal - discount WHERE id = o.id;
    PERFORM public.fulfill_paid_order(o.id, 'saldo');
  END LOOP;
  RETURN v_bal;
END $$;

-- Buyer sends QRIS transfer proof for a checkout; admin confirms.
CREATE OR REPLACE FUNCTION public.submit_order_payment(p_checkout uuid, p_proof text, p_method uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_due bigint; v_label text := 'QRIS'; v_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Masuk dulu'; END IF;
  IF public.is_account_banned(uid) THEN RAISE EXCEPTION 'Akun kamu sedang diblokir'; END IF;
  IF p_proof IS NULL OR split_part(p_proof, '/', 1) <> uid::text THEN RAISE EXCEPTION 'Bukti transfer tidak valid'; END IF;
  SELECT COALESCE(sum(total), 0) INTO v_due FROM orders WHERE checkout_id = p_checkout AND buyer_id = uid AND status = 'pending';
  IF v_due <= 0 THEN RAISE EXCEPTION 'Tidak ada pesanan yang perlu dibayar'; END IF;
  IF EXISTS (SELECT 1 FROM orders WHERE checkout_id = p_checkout AND buyer_id = uid AND status = 'pending' AND expires_at IS NOT NULL AND expires_at < now()) THEN
    RAISE EXCEPTION 'Waktu bayar sudah habis, buat pesanan baru';
  END IF;
  IF EXISTS (SELECT 1 FROM order_payments WHERE checkout_id = p_checkout AND status = 'pending') THEN RAISE EXCEPTION 'Bukti sudah dikirim, tunggu dicek admin'; END IF;
  IF p_method IS NOT NULL THEN
    SELECT provider INTO v_label FROM payment_methods WHERE id = p_method AND is_active;
    IF v_label IS NULL THEN RAISE EXCEPTION 'Metode pembayaran tidak tersedia'; END IF;
  END IF;
  INSERT INTO order_payments (checkout_id, buyer_id, amount, proof_path, method_id, method_label)
    VALUES (p_checkout, uid, v_due, p_proof, p_method, v_label) RETURNING id INTO v_id;
  -- keep the orders open while admin checks the proof
  UPDATE orders SET expires_at = now() + interval '24 hours', updated_at = now() WHERE checkout_id = p_checkout AND buyer_id = uid AND status = 'pending';
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_review_order_payment(p_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pay order_payments%ROWTYPE; o record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Khusus admin'; END IF;
  SELECT * INTO pay FROM order_payments WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pembayaran tidak ditemukan'; END IF;
  IF pay.status <> 'pending' THEN RAISE EXCEPTION 'Pembayaran sudah diproses'; END IF;
  UPDATE order_payments SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    admin_note = NULLIF(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now() WHERE id = p_id;
  IF p_approve THEN
    FOR o IN SELECT id FROM orders WHERE checkout_id = pay.checkout_id AND buyer_id = pay.buyer_id AND status = 'pending' LOOP
      PERFORM public.fulfill_paid_order(o.id, lower(pay.method_label));
    END LOOP;
  ELSE
    UPDATE orders SET expires_at = now() + interval '1 hour', updated_at = now() WHERE checkout_id = pay.checkout_id AND status = 'pending';
  END IF;
  PERFORM public.admin_log(CASE WHEN p_approve THEN 'approve_order_payment' ELSE 'reject_order_payment' END, 'order', pay.checkout_id::text, pay.amount || COALESCE(' • ' || NULLIF(trim(p_note), ''), ''));
END $$;

-- Seller completing an order manually also credits their saldo.
CREATE OR REPLACE FUNCTION public.seller_advance_order(p_order uuid, p_status text, p_delivery text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order AND seller_id = auth.uid();
  IF o.id IS NULL THEN RAISE EXCEPTION 'Pesanan tidak ditemukan'; END IF;
  IF NOT ((o.status = 'paid' AND p_status IN ('processing','completed')) OR (o.status = 'processing' AND p_status = 'completed')) THEN
    RAISE EXCEPTION 'Status pesanan tidak bisa diubah';
  END IF;
  IF p_status = 'completed' AND p_delivery IS NOT NULL AND btrim(p_delivery) <> '' THEN
    UPDATE public.order_items SET delivered = delivered || ARRAY[left(p_delivery, 4000)] WHERE order_id = p_order;
  END IF;
  UPDATE public.orders SET status = p_status, updated_at = now(), completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE completed_at END WHERE id = p_order;
  IF p_status = 'completed' THEN
    UPDATE public.products p SET sold_count = sold_count + x.q FROM (SELECT product_id, sum(qty) q FROM public.order_items WHERE order_id = p_order GROUP BY product_id) x WHERE p.id = x.product_id;
    PERFORM public.credit_seller_for_order(p_order);
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.pay_order_with_wallet(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_order_payment(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_review_order_payment(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_order_with_wallet(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_order_payment(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_order_payment(uuid, boolean, text) TO authenticated;