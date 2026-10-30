CREATE OR REPLACE FUNCTION public.credit_seller_for_order(p_order uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o orders%ROWTYPE; v_gross bigint; v_fee bigint; v_net bigint;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order;
  IF o.id IS NULL OR o.status <> 'completed' OR o.payment_method IS NULL THEN RETURN; END IF;
  IF o.completed_at IS NULL OR o.completed_at > now() - interval '5 hours' THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM wallet_ledger WHERE ref_id = o.id AND kind = 'sale') THEN RETURN; END IF;
  v_gross := o.subtotal - o.discount;
  IF v_gross <= 0 THEN RETURN; END IF;
  v_fee := ceil(v_gross * 0.03)::bigint;
  v_net := v_gross - v_fee;
  INSERT INTO wallets (user_id, balance) VALUES (o.seller_id, v_net)
    ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + EXCLUDED.balance, updated_at = now();
  INSERT INTO wallet_ledger (user_id, amount, kind, ref_id, note) VALUES (o.seller_id, v_net, 'sale', o.id, 'Penjualan M-' || o.order_no || ' (potongan admin 3% Rp' || v_fee || ')');
END $function$;
REVOKE EXECUTE ON FUNCTION public.credit_seller_for_order(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.release_seller_holds()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  FOR r IN SELECT o.id FROM orders o WHERE o.status = 'completed' AND o.payment_method IS NOT NULL
      AND o.completed_at <= now() - interval '5 hours'
      AND NOT EXISTS (SELECT 1 FROM wallet_ledger l WHERE l.ref_id = o.id AND l.kind = 'sale')
      ORDER BY o.completed_at LIMIT 500 LOOP
    PERFORM public.credit_seller_for_order(r.id);
  END LOOP;
END $function$;
GRANT EXECUTE ON FUNCTION public.release_seller_holds() TO authenticated;

CREATE OR REPLACE FUNCTION public.seller_holds()
 RETURNS TABLE(order_id uuid, order_no bigint, buyer_id uuid, buyer_name text, buyer_whatsapp text, product_name text, amount bigint, completed_at timestamptz, release_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT o.id, o.order_no, o.buyer_id, o.buyer_name, o.buyer_whatsapp,
    (SELECT i.product_name FROM order_items i WHERE i.order_id = o.id ORDER BY i.created_at LIMIT 1),
    (o.subtotal - o.discount)::bigint, o.completed_at, o.completed_at + interval '5 hours'
  FROM orders o
  WHERE o.seller_id = auth.uid() AND o.status = 'completed' AND o.payment_method IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM wallet_ledger l WHERE l.ref_id = o.id AND l.kind = 'sale')
  ORDER BY o.completed_at DESC;
$function$;
GRANT EXECUTE ON FUNCTION public.seller_holds() TO authenticated;

CREATE OR REPLACE FUNCTION public.seller_start_conversation(p_buyer uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); cid uuid; bname text; sname text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Masuk dulu'; END IF;
  IF uid = p_buyer THEN RAISE EXCEPTION 'Tidak bisa chat diri sendiri'; END IF;
  SELECT store_name INTO sname FROM seller_stores WHERE owner_id = uid;
  IF sname IS NULL THEN RAISE EXCEPTION 'Toko tidak ditemukan'; END IF;
  IF NOT EXISTS (SELECT 1 FROM orders WHERE seller_id = uid AND buyer_id = p_buyer) THEN RAISE EXCEPTION 'Pembeli belum pernah bertransaksi di tokomu'; END IF;
  SELECT id INTO cid FROM conversations WHERE buyer_id = p_buyer AND seller_id = uid;
  IF cid IS NOT NULL THEN RETURN cid; END IF;
  SELECT coalesce(nullif(username,''), nullif(full_name,''), 'Pembeli') INTO bname FROM profiles WHERE id = p_buyer;
  INSERT INTO conversations (buyer_id, seller_id, buyer_name, store_name) VALUES (p_buyer, uid, coalesce(bname,'Pembeli'), sname) RETURNING id INTO cid;
  RETURN cid;
END $function$;
GRANT EXECUTE ON FUNCTION public.seller_start_conversation(uuid) TO authenticated;