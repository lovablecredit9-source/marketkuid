
-- ===== Ads v2: keywords, duration, wallet =====
ALTER TABLE public.ad_campaigns
  ADD COLUMN IF NOT EXISTS keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS match_mode text NOT NULL DEFAULT 'frasa',
  ADD COLUMN IF NOT EXISTS duration_days integer,
  ADD COLUMN IF NOT EXISTS price_per_day bigint NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS total_cost bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_part bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_part bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS live_from timestamptz,
  ADD COLUMN IF NOT EXISTS live_until timestamptz;
ALTER TABLE public.ad_campaigns ADD CONSTRAINT ad_campaigns_match_mode_check CHECK (match_mode IN ('persis','frasa'));
ALTER TABLE public.ad_campaigns DROP CONSTRAINT IF EXISTS ad_campaigns_status_check;
ALTER TABLE public.ad_campaigns ADD CONSTRAINT ad_campaigns_status_check
  CHECK (status IN ('menunggu_saldo','menunggu','aktif','dijeda','selesai','dibatalkan'));

-- Campaigns are now created/cancelled only through functions (balance is charged there).
REVOKE INSERT, UPDATE, DELETE ON public.ad_campaigns FROM authenticated;
DROP TRIGGER IF EXISTS ad_campaigns_guard ON public.ad_campaigns;

CREATE TABLE public.ad_wallets (
  owner_id uuid PRIMARY KEY,
  paid bigint NOT NULL DEFAULT 0 CHECK (paid >= 0),
  promo bigint NOT NULL DEFAULT 0 CHECK (promo >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ad_wallets TO authenticated;
GRANT ALL ON public.ad_wallets TO service_role;
ALTER TABLE public.ad_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own ad wallet" ON public.ad_wallets FOR SELECT TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE public.ad_wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('topup','voucher','belanja','refund')),
  paid_delta bigint NOT NULL DEFAULT 0,
  promo_delta bigint NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ad_wallet_ledger_owner_idx ON public.ad_wallet_ledger (owner_id, created_at DESC);
GRANT SELECT ON public.ad_wallet_ledger TO authenticated;
GRANT ALL ON public.ad_wallet_ledger TO service_role;
ALTER TABLE public.ad_wallet_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own ad ledger" ON public.ad_wallet_ledger FOR SELECT TO authenticated USING (auth.uid() = owner_id);

-- Ad balance vouchers are issued by Marketku admins (service role only).
CREATE TABLE public.ad_vouchers (
  code text PRIMARY KEY CHECK (code = upper(code)),
  amount bigint NOT NULL CHECK (amount > 0),
  max_claims integer,
  claimed integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ad_vouchers TO service_role;
ALTER TABLE public.ad_vouchers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ad_voucher_claims (
  code text NOT NULL REFERENCES public.ad_vouchers(code) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (code, owner_id)
);
GRANT ALL ON public.ad_voucher_claims TO service_role;
ALTER TABLE public.ad_voucher_claims ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_ad_voucher(p_code text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.ad_vouchers; uid uuid := auth.uid(); c text := upper(btrim(coalesce(p_code,'')));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Masuk dulu'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.seller_stores WHERE owner_id = uid) THEN RAISE EXCEPTION 'Buka toko dulu'; END IF;
  IF c = '' THEN RAISE EXCEPTION 'Masukkan kode voucher'; END IF;
  SELECT * INTO v FROM public.ad_vouchers WHERE code = c FOR UPDATE;
  IF NOT FOUND OR NOT v.is_active OR (v.expires_at IS NOT NULL AND v.expires_at < now()) THEN RAISE EXCEPTION 'Kode voucher tidak valid atau sudah kedaluwarsa'; END IF;
  IF v.max_claims IS NOT NULL AND v.claimed >= v.max_claims THEN RAISE EXCEPTION 'Kuota voucher sudah habis'; END IF;
  IF EXISTS (SELECT 1 FROM public.ad_voucher_claims WHERE code = c AND owner_id = uid) THEN RAISE EXCEPTION 'Voucher ini sudah kamu klaim'; END IF;
  INSERT INTO public.ad_voucher_claims (code, owner_id) VALUES (c, uid);
  UPDATE public.ad_vouchers SET claimed = claimed + 1 WHERE code = c;
  INSERT INTO public.ad_wallets (owner_id, promo) VALUES (uid, v.amount)
    ON CONFLICT (owner_id) DO UPDATE SET promo = public.ad_wallets.promo + v.amount, updated_at = now();
  INSERT INTO public.ad_wallet_ledger (owner_id, kind, promo_delta, note) VALUES (uid, 'voucher', v.amount, 'Klaim voucher ' || c);
  RETURN v.amount;
END $$;

-- Sitewide sponsored slots; extra campaigns wait in the queue.
CREATE OR REPLACE FUNCTION public.ad_refresh_queue()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE slots int := 20; free int; r record;
BEGIN
  UPDATE public.ad_campaigns SET status = 'selesai' WHERE status = 'aktif' AND live_until IS NOT NULL AND live_until <= now();
  SELECT slots - count(*) INTO free FROM public.ad_campaigns WHERE status = 'aktif';
  FOR r IN SELECT id, duration_days FROM public.ad_campaigns WHERE status = 'menunggu' ORDER BY created_at LIMIT greatest(free, 0) FOR UPDATE SKIP LOCKED LOOP
    UPDATE public.ad_campaigns SET status = 'aktif', live_from = now(), live_until = now() + make_interval(days => r.duration_days) WHERE id = r.id;
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.ad_refresh_queue() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_ad_campaign(p_product uuid, p_keywords text[], p_mode text, p_days integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); pr record; kws text[]; cost bigint; w public.ad_wallets; use_promo bigint; use_paid bigint; new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Masuk dulu'; END IF;
  SELECT p.id, p.name, p.status INTO pr FROM public.products p WHERE p.id = p_product AND p.owner_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produk tidak ditemukan'; END IF;
  IF pr.status <> 'active' THEN RAISE EXCEPTION 'Produk belum memenuhi syarat iklan (harus aktif)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.product_stock s JOIN public.product_variants v ON v.id = s.variant_id WHERE v.product_id = p_product AND s.status = 'available') THEN
    RAISE EXCEPTION 'Produk belum memenuhi syarat iklan (stok kosong)';
  END IF;
  IF p_mode NOT IN ('persis','frasa') THEN RAISE EXCEPTION 'Mode pencocokan tidak valid'; END IF;
  IF p_days IS NULL OR p_days < 1 OR p_days > 90 THEN RAISE EXCEPTION 'Durasi 1 sampai 90 hari'; END IF;
  SELECT coalesce(array_agg(DISTINCT k), '{}') INTO kws FROM (SELECT lower(btrim(x)) k FROM unnest(coalesce(p_keywords,'{}')) x) t WHERE length(k) BETWEEN 2 AND 40;
  IF cardinality(kws) = 0 THEN RAISE EXCEPTION 'Isi minimal 1 kata kunci'; END IF;
  IF cardinality(kws) > 10 THEN RAISE EXCEPTION 'Maksimal 10 kata kunci'; END IF;
  cost := p_days::bigint * 5000;
  INSERT INTO public.ad_wallets (owner_id) VALUES (uid) ON CONFLICT DO NOTHING;
  SELECT * INTO w FROM public.ad_wallets WHERE owner_id = uid FOR UPDATE;
  IF w.paid + w.promo < cost THEN RAISE EXCEPTION 'Saldo iklan belum cukup'; END IF;
  use_promo := least(w.promo, cost); use_paid := cost - use_promo;
  UPDATE public.ad_wallets SET promo = promo - use_promo, paid = paid - use_paid, updated_at = now() WHERE owner_id = uid;
  INSERT INTO public.ad_campaigns (owner_id, product_id, name, placement, daily_budget, status, keywords, match_mode, duration_days, price_per_day, total_cost, paid_part, promo_part, spend)
  VALUES (uid, p_product, left('Iklan ' || pr.name, 60), 'semua', 5000, 'menunggu', kws, p_mode, p_days, 5000, cost, use_paid, use_promo, cost)
  RETURNING id INTO new_id;
  INSERT INTO public.ad_wallet_ledger (owner_id, kind, paid_delta, promo_delta, note) VALUES (uid, 'belanja', -use_paid, -use_promo, 'Iklan ' || left(pr.name, 50) || ' · ' || p_days || ' hari');
  PERFORM public.ad_refresh_queue();
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_ad_campaign(p_id uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); c public.ad_campaigns; refund bigint := 0; days_left int; r_promo bigint; r_paid bigint;
BEGIN
  SELECT * INTO c FROM public.ad_campaigns WHERE id = p_id AND owner_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign tidak ditemukan'; END IF;
  IF c.status = 'menunggu' THEN refund := c.total_cost;
  ELSIF c.status = 'aktif' THEN
    days_left := greatest(floor(extract(epoch FROM (c.live_until - now())) / 86400)::int, 0);
    refund := least(days_left::bigint * c.price_per_day, c.total_cost);
  ELSIF c.status IN ('menunggu_saldo','dijeda') THEN refund := 0;
  ELSE RAISE EXCEPTION 'Campaign sudah selesai atau dibatalkan';
  END IF;
  r_promo := least(refund, c.promo_part); r_paid := refund - r_promo;
  UPDATE public.ad_campaigns SET status = 'dibatalkan', spend = greatest(spend - refund, 0) WHERE id = p_id;
  IF refund > 0 THEN
    INSERT INTO public.ad_wallets (owner_id) VALUES (uid) ON CONFLICT DO NOTHING;
    UPDATE public.ad_wallets SET promo = promo + r_promo, paid = paid + r_paid, updated_at = now() WHERE owner_id = uid;
    INSERT INTO public.ad_wallet_ledger (owner_id, kind, paid_delta, promo_delta, note) VALUES (uid, 'refund', r_paid, r_promo, 'Pembatalan ' || c.name);
  END IF;
  PERFORM public.ad_refresh_queue();
  RETURN refund;
END $$;

-- Public: sponsored products for the home page (empty query) or a search term. Counts an impression per result.
CREATE OR REPLACE FUNCTION public.sponsored_products(p_query text, p_limit integer DEFAULT 6)
RETURNS TABLE (campaign_id uuid, product_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q text := lower(btrim(coalesce(p_query, '')));
BEGIN
  PERFORM public.ad_refresh_queue();
  RETURN QUERY
  WITH picked AS (
    SELECT DISTINCT ON (c.product_id) c.id, c.product_id
    FROM public.ad_campaigns c JOIN public.products p ON p.id = c.product_id AND p.status = 'active'
    WHERE c.status = 'aktif' AND (
      q = '' OR (c.match_mode = 'persis' AND q = ANY(c.keywords))
      OR (c.match_mode = 'frasa' AND EXISTS (SELECT 1 FROM unnest(c.keywords) k WHERE position(k IN q) > 0))
    )
    ORDER BY c.product_id, random()
  ), lim AS (SELECT * FROM picked ORDER BY random() LIMIT least(greatest(coalesce(p_limit, 6), 1), 20)),
  upd AS (UPDATE public.ad_campaigns a SET impressions = a.impressions + 1 FROM lim WHERE a.id = lim.id RETURNING a.id, a.product_id)
  SELECT upd.id, upd.product_id FROM upd;
END $$;
GRANT EXECUTE ON FUNCTION public.sponsored_products(text, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.track_ad_click(p_campaign uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.ad_campaigns SET clicks = clicks + 1 WHERE id = p_campaign AND status = 'aktif';
$$;
GRANT EXECUTE ON FUNCTION public.track_ad_click(uuid) TO anon, authenticated;

-- ===== Telegram bots owned by sellers =====
CREATE TABLE public.telegram_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  tg_bot_id bigint NOT NULL UNIQUE,
  username text NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  admin_username text CHECK (admin_username IS NULL OR admin_username ~ '^[A-Za-z0-9_]{3,32}$'),
  admin_wa text CHECK (admin_wa IS NULL OR admin_wa ~ '^62[0-9]{8,13}$'),
  token text NOT NULL,
  webhook_secret text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  webhook_ok boolean NOT NULL DEFAULT false,
  webhook_at timestamptz,
  buyer_mode smallint NOT NULL DEFAULT 1 CHECK (buyer_mode BETWEEN 1 AND 3),
  keyboard jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(keyboard) = 'array' AND jsonb_array_length(keyboard) <= 8),
  force_join jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(force_join) = 'object'),
  crypto_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX telegram_bots_owner_idx ON public.telegram_bots (owner_id);
-- Token and webhook secret are never readable by the app; only server code uses them.
GRANT SELECT (id, owner_id, tg_bot_id, username, name, admin_username, admin_wa, is_active, webhook_ok, webhook_at, buyer_mode, keyboard, force_join, crypto_enabled, created_at)
  ON public.telegram_bots TO authenticated;
GRANT UPDATE (name, admin_username, admin_wa, buyer_mode, keyboard, force_join, crypto_enabled) ON public.telegram_bots TO authenticated;
GRANT ALL ON public.telegram_bots TO service_role;
ALTER TABLE public.telegram_bots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own bots" ON public.telegram_bots FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners update own bots" ON public.telegram_bots FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.telegram_bot_users (
  bot_id uuid NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  tg_user_id bigint NOT NULL,
  first_name text,
  username text,
  referred_by bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bot_id, tg_user_id)
);
GRANT SELECT ON public.telegram_bot_users TO authenticated;
GRANT ALL ON public.telegram_bot_users TO service_role;
ALTER TABLE public.telegram_bot_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bot owners read bot users" ON public.telegram_bot_users FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.telegram_bots b WHERE b.id = bot_id AND b.owner_id = auth.uid()));

CREATE TABLE public.telegram_bot_updates (
  bot_id uuid NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  update_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bot_id, update_id)
);
GRANT ALL ON public.telegram_bot_updates TO service_role;
ALTER TABLE public.telegram_bot_updates ENABLE ROW LEVEL SECURITY;

-- Public: active product counts per category for the "Semua Kategori" page.
CREATE OR REPLACE FUNCTION public.category_product_counts()
RETURNS TABLE (category_id uuid, products integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT category_id, count(*)::int FROM public.products WHERE status = 'active' AND category_id IS NOT NULL GROUP BY category_id;
$$;
GRANT EXECUTE ON FUNCTION public.category_product_counts() TO anon, authenticated;
