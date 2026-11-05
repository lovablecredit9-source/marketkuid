CREATE OR REPLACE FUNCTION public.order_warranty_days(p_order uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE WHEN count(v.warranty) = 0 THEN NULL
    ELSE GREATEST(1, LEAST(3, max(COALESCE(NULLIF(v.warranty->>'days','')::int, 3)))) END
  FROM order_items i JOIN product_variants v ON v.id = i.variant_id
  WHERE i.order_id = p_order AND v.warranty IS NOT NULL AND jsonb_typeof(v.warranty) = 'object';
$$;
REVOKE EXECUTE ON FUNCTION public.order_warranty_days(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.order_release_at(p_order uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE WHEN public.order_warranty_days(o.id) IS NULL THEN o.paid_at + interval '5 hours'
    ELSE o.paid_at + make_interval(days => public.order_warranty_days(o.id)) END
  FROM orders o WHERE o.id = p_order;
$$;
REVOKE EXECUTE ON FUNCTION public.order_release_at(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.credit_seller_for_order(p_order uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o orders%ROWTYPE; v_gross bigint; v_fee bigint; v_net bigint;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order FOR UPDATE;
  IF o.id IS NULL OR o.status NOT IN ('paid','processing','completed') OR o.payment_method IS NULL OR o.paid_at IS NULL THEN RETURN; END IF;
  IF public.order_release_at(o.id) > now() THEN RETURN; END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.credit_seller_for_order_now(p_order uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o orders%ROWTYPE; v_gross bigint; v_fee bigint; v_net bigint;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order FOR UPDATE;
  IF o.id IS NULL OR o.status NOT IN ('paid','processing','completed') OR o.payment_method IS NULL OR o.paid_at IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM wallet_ledger WHERE ref_id = o.id AND kind = 'sale') THEN RETURN; END IF;
  IF o.status <> 'completed' THEN
    UPDATE orders SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = o.id;
    UPDATE products p SET sold_count = sold_count + x.q FROM (SELECT product_id, sum(qty) q FROM order_items WHERE order_id = o.id GROUP BY product_id) x WHERE p.id = x.product_id;
  END IF;
  -- Garansi orders stay held until the warranty window (max 3 days) ends, even after buyer confirmation.
  IF public.order_warranty_days(o.id) IS NOT NULL AND public.order_release_at(o.id) > now() THEN RETURN; END IF;
  v_gross := o.subtotal - o.discount;
  IF v_gross <= 0 THEN RETURN; END IF;
  v_fee := ceil(v_gross * 0.03)::bigint;
  v_net := v_gross - v_fee;
  INSERT INTO wallets (user_id, balance) VALUES (o.seller_id, v_net)
    ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + EXCLUDED.balance, updated_at = now();
  INSERT INTO wallet_ledger (user_id, amount, kind, ref_id, note) VALUES (o.seller_id, v_net, 'sale', o.id, 'Penjualan M-' || o.order_no || ' (dikonfirmasi pembeli, potongan admin 3% Rp' || v_fee || ')');
END $function$;

CREATE OR REPLACE FUNCTION public.release_seller_holds()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  FOR r IN SELECT o.id FROM orders o WHERE o.status IN ('paid','processing','completed') AND o.payment_method IS NOT NULL
      AND o.paid_at <= now() - interval '5 hours'
      AND NOT EXISTS (SELECT 1 FROM wallet_ledger l WHERE l.ref_id = o.id AND l.kind = 'sale')
      ORDER BY o.paid_at LIMIT 500 LOOP
    PERFORM public.credit_seller_for_order(r.id);
  END LOOP;
END $function$;

DROP FUNCTION IF EXISTS public.seller_holds();
CREATE FUNCTION public.seller_holds()
 RETURNS TABLE(order_id uuid, order_no bigint, buyer_id uuid, buyer_name text, buyer_whatsapp text, product_name text, amount bigint, completed_at timestamp with time zone, release_at timestamp with time zone, kind text, warranty_days integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.id, o.order_no, o.buyer_id, o.buyer_name, o.buyer_whatsapp,
    (SELECT i.product_name FROM order_items i WHERE i.order_id = o.id ORDER BY i.created_at LIMIT 1),
    (o.subtotal - o.discount)::bigint, o.paid_at, public.order_release_at(o.id),
    CASE WHEN public.order_warranty_days(o.id) IS NULL THEN 'biasa' ELSE 'garansi' END,
    public.order_warranty_days(o.id)
  FROM orders o
  WHERE o.seller_id = auth.uid() AND o.status IN ('paid','processing','completed') AND o.payment_method IS NOT NULL AND o.paid_at IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM wallet_ledger l WHERE l.ref_id = o.id AND l.kind = 'sale')
  ORDER BY o.paid_at DESC;
$function$;
REVOKE EXECUTE ON FUNCTION public.seller_holds() FROM anon;
GRANT EXECUTE ON FUNCTION public.seller_holds() TO authenticated;