-- Guest checkout: shadow buyer accounts + secret per-checkout links (service-only)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS guest_email text, ADD COLUMN IF NOT EXISTS guest_telegram text;

CREATE TABLE public.guest_buyers (
  email text PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.guest_buyers TO service_role;
ALTER TABLE public.guest_buyers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.guest_checkouts (
  checkout_id uuid PRIMARY KEY,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  email text NOT NULL,
  whatsapp text,
  telegram text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.guest_checkouts TO service_role;
ALTER TABLE public.guest_checkouts ENABLE ROW LEVEL SECURITY;
CREATE INDEX guest_checkouts_email_idx ON public.guest_checkouts (email, created_at DESC);

-- Runs place_order / submit_order_payment as the guest's shadow buyer (service role only),
-- so prices, stock, vouchers and ban checks stay in one place.
CREATE OR REPLACE FUNCTION public.guest_place_order(p_buyer uuid, p_email text, p_telegram text, p_items jsonb, p_whatsapp text, p_note text, p_voucher text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE prev text := current_setting('request.jwt.claims', true); cid uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.guest_buyers WHERE user_id = p_buyer) THEN RAISE EXCEPTION 'Pembeli tamu tidak valid'; END IF;
  IF p_email IS NULL OR p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Email tidak valid'; END IF;
  IF p_telegram IS NOT NULL AND p_telegram <> '' AND p_telegram !~ '^@?[A-Za-z0-9_]{5,32}$' THEN RAISE EXCEPTION 'Username Telegram tidak valid'; END IF;
  IF (SELECT count(*) FROM public.guest_checkouts g JOIN public.orders o ON o.checkout_id = g.checkout_id
      WHERE g.email = lower(p_email) AND o.status = 'pending' AND o.expires_at > now()) >= 5 THEN
    RAISE EXCEPTION 'Terlalu banyak pesanan belum dibayar untuk email ini. Bayar atau tunggu yang lama kedaluwarsa.';
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_buyer, 'role', 'authenticated')::text, true);
  cid := public.place_order(p_items, p_whatsapp, p_note, p_voucher);
  PERFORM set_config('request.jwt.claims', coalesce(prev, ''), true);
  UPDATE public.orders SET guest_email = lower(p_email), guest_telegram = nullif(ltrim(coalesce(p_telegram, ''), '@'), '') WHERE checkout_id = cid;
  INSERT INTO public.guest_checkouts (checkout_id, buyer_id, email, whatsapp, telegram)
    VALUES (cid, p_buyer, lower(p_email), nullif(p_whatsapp, ''), nullif(ltrim(coalesce(p_telegram, ''), '@'), ''));
  RETURN cid;
END $$;
REVOKE ALL ON FUNCTION public.guest_place_order(uuid, text, text, jsonb, text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_place_order(uuid, text, text, jsonb, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.guest_submit_payment(p_token uuid, p_proof text, p_method uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE prev text := current_setting('request.jwt.claims', true); g record; v_id uuid;
BEGIN
  SELECT * INTO g FROM public.guest_checkouts WHERE token = p_token;
  IF g.checkout_id IS NULL THEN RAISE EXCEPTION 'Pesanan tidak ditemukan'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', g.buyer_id, 'role', 'authenticated')::text, true);
  v_id := public.submit_order_payment(g.checkout_id, p_proof, p_method);
  PERFORM set_config('request.jwt.claims', coalesce(prev, ''), true);
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.guest_submit_payment(uuid, text, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_submit_payment(uuid, text, uuid) TO service_role;