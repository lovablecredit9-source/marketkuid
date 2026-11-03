ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS buyer_confirmed_at timestamptz;

UPDATE public.orders o SET buyer_confirmed_at = l.created_at
FROM public.wallet_ledger l
WHERE l.ref_id = o.id AND l.kind = 'sale' AND l.note LIKE '%dikonfirmasi pembeli%' AND o.buyer_confirmed_at IS NULL;

CREATE OR REPLACE FUNCTION public.buyer_confirm_order(p_order uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order;
  IF o.id IS NULL OR o.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'Pesanan tidak ditemukan'; END IF;
  IF o.status NOT IN ('paid','processing','completed') OR o.paid_at IS NULL THEN RAISE EXCEPTION 'Pesanan belum dibayar'; END IF;
  PERFORM public.credit_seller_for_order_now(p_order);
  UPDATE orders SET buyer_confirmed_at = COALESCE(buyer_confirmed_at, now()), updated_at = now() WHERE id = p_order;
END $function$;