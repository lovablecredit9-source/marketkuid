ALTER TABLE public.seller_stores
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_orders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bank_type text,
  ADD COLUMN IF NOT EXISTS bank_provider text,
  ADD COLUMN IF NOT EXISTS bank_number text,
  ADD COLUMN IF NOT EXISTS bank_holder text;

ALTER TABLE public.seller_stores
  ADD CONSTRAINT seller_stores_desc_len CHECK (description IS NULL OR char_length(description) <= 500),
  ADD CONSTRAINT seller_stores_slug_fmt CHECK (slug IS NULL OR slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 3 AND 40);
CREATE UNIQUE INDEX IF NOT EXISTS seller_stores_slug_key ON public.seller_stores (slug) WHERE slug IS NOT NULL;

DROP POLICY IF EXISTS "Owners update own store settings" ON public.seller_stores;
CREATE POLICY "Owners update own store settings" ON public.seller_stores
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
GRANT UPDATE ON public.seller_stores TO authenticated;

CREATE TABLE public.seller_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.seller_stores(owner_id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('diskon','diskon_produk','bonus')),
  code text NOT NULL CHECK (code ~ '^[A-Z0-9]{3,20}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  description text CHECK (description IS NULL OR char_length(description) <= 200),
  value_type text NOT NULL CHECK (value_type IN ('percent','nominal')),
  value numeric NOT NULL CHECK (value > 0),
  max_discount numeric CHECK (max_discount IS NULL OR max_discount > 0),
  usage_limit integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  per_user_limit integer NOT NULL DEFAULT 1 CHECK (per_user_limit > 0),
  min_spend numeric NOT NULL DEFAULT 0 CHECK (min_spend >= 0),
  min_qty integer NOT NULL DEFAULT 1 CHECK (min_qty >= 1),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  used_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seller_vouchers_percent_max CHECK (value_type <> 'percent' OR value <= 100),
  CONSTRAINT seller_vouchers_period CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  UNIQUE (owner_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_vouchers TO authenticated;
GRANT ALL ON public.seller_vouchers TO service_role;
ALTER TABLE public.seller_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own vouchers" ON public.seller_vouchers
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.wishlists (
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
GRANT SELECT, INSERT, DELETE ON public.wishlists TO authenticated;
GRANT ALL ON public.wishlists TO service_role;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own wishlist" ON public.wishlists
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);