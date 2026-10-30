CREATE OR REPLACE FUNCTION public.credit_seller_for_order_now(p_order uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE o orders%ROWTYPE; v_gross bigint; v_fee bigint; v_net bigint;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order FOR UPDATE;
  IF o.id IS NULL OR o.status NOT IN ('paid','processing','completed') OR o.payment_method IS NULL OR o.paid_at IS NULL THEN RETURN; END IF;
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
  INSERT INTO wallet_ledger (user_id, amount, kind, ref_id, note) VALUES (o.seller_id, v_net, 'sale', o.id, 'Penjualan M-' || o.order_no || ' (dikonfirmasi pembeli, potongan admin 3% Rp' || v_fee || ')');
END $$;
REVOKE ALL ON FUNCTION public.credit_seller_for_order_now(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.buyer_confirm_order(p_order uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE o orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order;
  IF o.id IS NULL OR o.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'Pesanan tidak ditemukan'; END IF;
  IF o.status NOT IN ('paid','processing','completed') OR o.paid_at IS NULL THEN RAISE EXCEPTION 'Pesanan belum dibayar'; END IF;
  PERFORM public.credit_seller_for_order_now(p_order);
END $$;
REVOKE ALL ON FUNCTION public.buyer_confirm_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buyer_confirm_order(uuid) TO authenticated;