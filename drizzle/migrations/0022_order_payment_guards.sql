CREATE OR REPLACE FUNCTION public.cancel_order(p_order uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order AND buyer_id = auth.uid();
  IF o.id IS NULL THEN RAISE EXCEPTION 'Pesanan tidak ditemukan'; END IF;
  IF o.status <> 'pending' THEN RAISE EXCEPTION 'Hanya pesanan yang belum dibayar yang bisa dibatalkan'; END IF;
  IF EXISTS (SELECT 1 FROM public.order_payments WHERE checkout_id = o.checkout_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Bukti pembayaran sedang dicek admin, pesanan belum bisa dibatalkan';
  END IF;
  UPDATE public.orders SET status = 'cancelled', updated_at = now() WHERE id = p_order;
  IF o.voucher_code IS NOT NULL THEN
    UPDATE public.seller_vouchers SET used_count = greatest(used_count - 1, 0) WHERE owner_id = o.seller_id AND code = o.voucher_code;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fulfill_paid_order(p_order uuid, p_method text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it record; codes text[]; avail int; all_done boolean := true;
BEGIN
  UPDATE orders SET status = 'paid', paid_at = now(), payment_method = p_method, updated_at = now() WHERE id = p_order AND status = 'pending';
  IF NOT FOUND THEN RETURN; END IF;
  FOR it IN SELECT * FROM order_items WHERE order_id = p_order LOOP
    IF it.product_type = 'preorder' OR it.variant_id IS NULL THEN all_done := false; CONTINUE; END IF;
    SELECT count(*) INTO avail FROM product_stock WHERE variant_id = it.variant_id AND status = 'available';
    IF avail < it.qty THEN all_done := false; CONTINUE; END IF;
    WITH picked AS (
      SELECT id, content FROM product_stock WHERE variant_id = it.variant_id AND status = 'available' ORDER BY created_at LIMIT it.qty FOR UPDATE
    ), upd AS (
      UPDATE product_stock s SET status = 'sold' FROM picked WHERE s.id = picked.id RETURNING picked.content
    ) SELECT array_agg(content) INTO codes FROM upd;
    UPDATE order_items SET delivered = delivered || COALESCE(codes, '{}') WHERE id = it.id;
  END LOOP;
  IF all_done THEN
    UPDATE orders SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = p_order;
    UPDATE products p SET sold_count = sold_count + x.q FROM (SELECT product_id, sum(qty) q FROM order_items WHERE order_id = p_order GROUP BY product_id) x WHERE p.id = x.product_id;
    PERFORM public.credit_seller_for_order(p_order);
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.fulfill_paid_order(uuid, text) FROM PUBLIC, anon, authenticated;