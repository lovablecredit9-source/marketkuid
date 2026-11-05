CREATE TABLE public.order_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('DR-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  reasons text[] NOT NULL DEFAULT '{}',
  note text,
  status text NOT NULL DEFAULT 'terbuka' CHECK (status IN ('terbuka','ditinjau','dilepas','refund','ditutup')),
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX order_disputes_one_active ON public.order_disputes(order_id) WHERE status IN ('terbuka','ditinjau');
CREATE INDEX order_disputes_buyer ON public.order_disputes(buyer_id);
CREATE INDEX order_disputes_seller ON public.order_disputes(seller_id);

CREATE TABLE public.dispute_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES public.order_disputes(id) ON DELETE CASCADE,
  sender_id uuid,
  sender_role text NOT NULL CHECK (sender_role IN ('buyer','seller','admin','system')),
  body text NOT NULL DEFAULT '',
  attachment_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dispute_messages_dispute ON public.dispute_messages(dispute_id, created_at);

GRANT SELECT ON public.order_disputes TO authenticated;
GRANT ALL ON public.order_disputes TO service_role;
GRANT SELECT ON public.dispute_messages TO authenticated;
GRANT ALL ON public.dispute_messages TO service_role;

ALTER TABLE public.order_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read disputes" ON public.order_disputes FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.is_dispute_participant(p_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM order_disputes d WHERE d.id::text = p_id
    AND (d.buyer_id = auth.uid() OR d.seller_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
$$;

CREATE POLICY "Participants read dispute messages" ON public.dispute_messages FOR SELECT TO authenticated
  USING (public.is_dispute_participant(dispute_id::text));

CREATE POLICY "Dispute participants read evidence" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dispute-evidence' AND public.is_dispute_participant((storage.foldername(name))[1]));
CREATE POLICY "Dispute participants upload evidence" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dispute-evidence' AND public.is_dispute_participant((storage.foldername(name))[1]));

-- internal refund helper (not callable by clients)
CREATE OR REPLACE FUNCTION public._dispute_refund(p_id uuid, p_by uuid, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d order_disputes%ROWTYPE; o orders%ROWTYPE;
BEGIN
  SELECT * INTO d FROM order_disputes WHERE id = p_id FOR UPDATE;
  SELECT * INTO o FROM orders WHERE id = d.order_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM wallet_ledger WHERE ref_id = o.id AND kind = 'sale') THEN RAISE EXCEPTION 'Dana sudah diteruskan ke seller'; END IF;
  IF EXISTS (SELECT 1 FROM wallet_ledger WHERE ref_id = o.id AND kind = 'refund') THEN RAISE EXCEPTION 'Pesanan sudah direfund'; END IF;
  INSERT INTO wallets (user_id, balance) VALUES (o.buyer_id, 0) ON CONFLICT (user_id) DO NOTHING;
  UPDATE wallets SET balance = balance + o.total, updated_at = now() WHERE user_id = o.buyer_id;
  INSERT INTO wallet_ledger (user_id, amount, kind, ref_id, note) VALUES (o.buyer_id, o.total, 'refund', o.id, 'Refund dispute M-' || o.order_no);
  UPDATE orders SET status = 'refunded', updated_at = now() WHERE id = o.id;
  UPDATE order_disputes SET status = 'refund', resolved_by = p_by, resolved_at = now(), resolution_note = NULLIF(trim(coalesce(p_note,'')),''), updated_at = now() WHERE id = p_id;
  INSERT INTO dispute_messages (dispute_id, sender_role, body) VALUES (p_id, 'system', '💸 Refund disetujui. Dana Rp' || o.total || ' dikembalikan ke Saldo Marketku pembeli.');
END $$;
REVOKE ALL ON FUNCTION public._dispute_refund(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.open_dispute(p_order uuid, p_reasons text[], p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE; v_id uuid; v_body text; v_name text;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order;
  IF o.id IS NULL OR o.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'Pesanan tidak ditemukan'; END IF;
  IF o.paid_at IS NULL OR o.status NOT IN ('paid','processing','completed') THEN RAISE EXCEPTION 'Pesanan belum dibayar'; END IF;
  IF o.buyer_confirmed_at IS NOT NULL OR EXISTS (SELECT 1 FROM wallet_ledger WHERE ref_id = o.id AND kind = 'sale') THEN
    RAISE EXCEPTION 'Pesanan sudah selesai, dana sudah diteruskan ke seller'; END IF;
  IF coalesce(array_length(p_reasons,1),0) = 0 THEN RAISE EXCEPTION 'Pilih minimal satu alasan'; END IF;
  SELECT id INTO v_id FROM order_disputes WHERE order_id = o.id AND status IN ('terbuka','ditinjau');
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO order_disputes (order_id, buyer_id, seller_id, reasons, note)
    VALUES (o.id, o.buyer_id, o.seller_id, p_reasons, NULLIF(left(trim(coalesce(p_note,'')),1000),''))
    RETURNING id INTO v_id;
  v_body := array_to_string(p_reasons, ', ');
  IF NULLIF(trim(coalesce(p_note,'')),'') IS NOT NULL THEN v_body := v_body || ' · Keterangan: ' || left(trim(p_note),1000); END IF;
  INSERT INTO dispute_messages (dispute_id, sender_id, sender_role, body) VALUES (v_id, auth.uid(), 'buyer', v_body);
  SELECT product_name INTO v_name FROM order_items WHERE order_id = o.id LIMIT 1;
  INSERT INTO dispute_messages (dispute_id, sender_role, body) VALUES (v_id, 'system',
    '📋 Laporan baru: ' || coalesce(v_name,'Pesanan') || ' (Rp' || o.total || ') — Order M-' || o.order_no || E'.\nAdmin dan penjual dapat meninjau pesanan ini di sini. Dana pesanan diamankan sementara.');
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.send_dispute_message(p_id uuid, p_body text, p_attachment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d order_disputes%ROWTYPE; v_role text;
BEGIN
  SELECT * INTO d FROM order_disputes WHERE id = p_id;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Dispute tidak ditemukan'; END IF;
  IF auth.uid() = d.buyer_id THEN v_role := 'buyer';
  ELSIF auth.uid() = d.seller_id THEN v_role := 'seller';
  ELSIF public.has_role(auth.uid(),'admin') THEN v_role := 'admin';
  ELSE RAISE EXCEPTION 'Dispute tidak ditemukan'; END IF;
  IF d.status NOT IN ('terbuka','ditinjau') THEN RAISE EXCEPTION 'Dispute sudah ditutup'; END IF;
  IF NULLIF(trim(coalesce(p_body,'')),'') IS NULL AND p_attachment IS NULL THEN RAISE EXCEPTION 'Pesan kosong'; END IF;
  IF p_attachment IS NOT NULL AND split_part(p_attachment,'/',1) <> d.id::text THEN RAISE EXCEPTION 'Lampiran tidak valid'; END IF;
  IF p_attachment IS NOT NULL AND (SELECT count(*) FROM dispute_messages WHERE dispute_id = d.id AND sender_id = auth.uid() AND attachment_path IS NOT NULL) >= 3 THEN
    RAISE EXCEPTION 'Maksimal 3 bukti foto'; END IF;
  INSERT INTO dispute_messages (dispute_id, sender_id, sender_role, body, attachment_path)
    VALUES (d.id, auth.uid(), v_role, left(trim(coalesce(p_body,'')),2000), p_attachment);
  UPDATE order_disputes SET updated_at = now() WHERE id = d.id;
END $$;

CREATE OR REPLACE FUNCTION public.seller_respond_dispute(p_id uuid, p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d order_disputes%ROWTYPE;
BEGIN
  SELECT * INTO d FROM order_disputes WHERE id = p_id FOR UPDATE;
  IF d.id IS NULL OR d.seller_id <> auth.uid() THEN RAISE EXCEPTION 'Dispute tidak ditemukan'; END IF;
  IF d.status NOT IN ('terbuka','ditinjau') THEN RAISE EXCEPTION 'Dispute sudah ditutup'; END IF;
  IF p_action = 'refund' THEN
    PERFORM public._dispute_refund(d.id, auth.uid(), 'Disetujui seller');
  ELSIF p_action = 'tolak' THEN
    IF d.status = 'ditinjau' THEN RAISE EXCEPTION 'Dispute sudah diteruskan ke admin'; END IF;
    UPDATE order_disputes SET status = 'ditinjau', updated_at = now() WHERE id = d.id;
    INSERT INTO dispute_messages (dispute_id, sender_role, body) VALUES (d.id, 'system', '⚖️ Seller menolak refund. Dispute diteruskan ke admin Marketku untuk ditinjau.');
  ELSIF p_action = 'selesai' THEN
    UPDATE order_disputes SET status = 'ditutup', resolved_by = auth.uid(), resolved_at = now(), resolution_note = 'Ditandai selesai oleh seller', updated_at = now() WHERE id = d.id;
    INSERT INTO dispute_messages (dispute_id, sender_role, body) VALUES (d.id, 'system', '✅ Seller menandai masalah selesai. Pesanan kembali berjalan normal.');
  ELSE RAISE EXCEPTION 'Aksi tidak dikenal'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.buyer_close_dispute(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d order_disputes%ROWTYPE;
BEGIN
  SELECT * INTO d FROM order_disputes WHERE id = p_id FOR UPDATE;
  IF d.id IS NULL OR d.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'Dispute tidak ditemukan'; END IF;
  IF d.status NOT IN ('terbuka','ditinjau') THEN RAISE EXCEPTION 'Dispute sudah ditutup'; END IF;
  UPDATE order_disputes SET status = 'ditutup', resolved_by = auth.uid(), resolved_at = now(), resolution_note = 'Ditutup oleh pembeli', updated_at = now() WHERE id = d.id;
  INSERT INTO dispute_messages (dispute_id, sender_role, body) VALUES (d.id, 'system', '✅ Pembeli menutup laporan. Masalah dianggap selesai.');
END $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(p_id uuid, p_refund boolean, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d order_disputes%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Khusus admin'; END IF;
  SELECT * INTO d FROM order_disputes WHERE id = p_id FOR UPDATE;
  IF d.id IS NULL OR d.status NOT IN ('terbuka','ditinjau') THEN RAISE EXCEPTION 'Dispute tidak aktif'; END IF;
  IF p_refund THEN
    PERFORM public._dispute_refund(d.id, auth.uid(), p_note);
  ELSE
    UPDATE order_disputes SET status = 'dilepas', resolved_by = auth.uid(), resolved_at = now(), resolution_note = NULLIF(trim(coalesce(p_note,'')),''), updated_at = now() WHERE id = d.id;
    PERFORM public.credit_seller_for_order_now(d.order_id);
    INSERT INTO dispute_messages (dispute_id, sender_role, body) VALUES (d.id, 'system', '🔓 Admin melepas dana ke seller. Dispute selesai.');
  END IF;
  PERFORM public.admin_log(CASE WHEN p_refund THEN 'dispute_refund' ELSE 'dispute_release' END, 'dispute', d.code, coalesce(NULLIF(trim(p_note),''), d.code));
END $$;

-- buyer confirming the order ends any active dispute (funds released)
CREATE OR REPLACE FUNCTION public.buyer_confirm_order(p_order uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE; v_d uuid;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order;
  IF o.id IS NULL OR o.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'Pesanan tidak ditemukan'; END IF;
  IF o.status NOT IN ('paid','processing','completed') OR o.paid_at IS NULL THEN RAISE EXCEPTION 'Pesanan belum dibayar'; END IF;
  SELECT id INTO v_d FROM order_disputes WHERE order_id = o.id AND status IN ('terbuka','ditinjau');
  IF v_d IS NOT NULL THEN
    UPDATE order_disputes SET status = 'dilepas', resolved_by = auth.uid(), resolved_at = now(), resolution_note = 'Pembeli mengonfirmasi pesanan', updated_at = now() WHERE id = v_d;
    INSERT INTO dispute_messages (dispute_id, sender_role, body) VALUES (v_d, 'system', '✅ Pembeli mengonfirmasi pesanan diterima. Dana diteruskan ke seller.');
  END IF;
  PERFORM public.credit_seller_for_order_now(p_order);
  UPDATE orders SET buyer_confirmed_at = COALESCE(buyer_confirmed_at, now()), updated_at = now() WHERE id = p_order;
END $$;

-- automatic 5h release skips orders with an active dispute
CREATE OR REPLACE FUNCTION public.credit_seller_for_order(p_order uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE; v_gross bigint; v_fee bigint; v_net bigint;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order FOR UPDATE;
  IF o.id IS NULL OR o.status NOT IN ('paid','processing','completed') OR o.payment_method IS NULL OR o.paid_at IS NULL THEN RETURN; END IF;
  IF o.paid_at > now() - interval '5 hours' THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM order_disputes WHERE order_id = o.id AND status IN ('terbuka','ditinjau')) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM wallet_ledger WHERE ref_id = o.id AND kind = 'sale') THEN RETURN; END IF;
  IF o.status <> 'completed' THEN
    UPDATE orders SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = o.id;
    UPDATE products p SET sold_count = sold_count + x.q FROM (SELECT product_id, sum(qty) q FROM order_items WHERE order_id = o.id GROUP BY product_id) x WHERE p.id = x.product_id;
  END IF;
  v_gross := o.subtotal - o.discount;
  IF v_gross <= 0 THEN RETURN; END IF;
  v_fee := ceil(v_gross * 0.03)::bigint;
  v_net := v_gross - v_fee;
  INSERT INTO wallets (user_id, balance) VALUES (o.seller_id, v_net)
    ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + EXCLUDED.balance, updated_at = now();
  INSERT INTO wallet_ledger (user_id, amount, kind, ref_id, note) VALUES (o.seller_id, v_net, 'sale', o.id, 'Penjualan M-' || o.order_no || ' (potongan admin 3% Rp' || v_fee || ')');
END $$;