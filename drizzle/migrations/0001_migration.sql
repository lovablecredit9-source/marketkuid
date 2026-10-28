CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_categories TO anon, authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads categories" ON public.product_categories FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.product_categories (name, sort) VALUES
('AI Tools',1),('Aplikasi',2),('Cloud',3),('Design & Kreatif',4),('Game Online',5),('Lainnya',6),
('PPOB',7),('Social Media',8),('Software',9),('Streaming',10),('Tools',11);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.seller_stores(owner_id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 120),
  description text NOT NULL DEFAULT '',
  product_type text NOT NULL CHECK (product_type IN ('link','code','email_2fa','email_pin','file','preorder','otp','gsuite','custom')),
  require_buyer_note boolean NOT NULL DEFAULT false,
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  usage_guide text NOT NULL DEFAULT '',
  images text[] NOT NULL DEFAULT '{}',
  seller_contact text,
  work_estimate text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft')),
  sold_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_owner_idx ON public.products(owner_id);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads active products" ON public.products FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY "Owners read own products" ON public.products FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert own products" ON public.products FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own products" ON public.products FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners delete own products" ON public.products FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  image_url text,
  price bigint NOT NULL CHECK (price >= 0),
  lifetime boolean NOT NULL DEFAULT false,
  duration_value int CHECK (duration_value IS NULL OR duration_value > 0),
  duration_unit text CHECK (duration_unit IS NULL OR duration_unit IN ('hari','bulan','tahun')),
  warranty jsonb,
  discount jsonb,
  bonus jsonb,
  preorder_quota int CHECK (preorder_quota IS NULL OR preorder_quota > 0),
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_variants_product_idx ON public.product_variants(product_id);
GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads variants of active products" ON public.product_variants FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.status = 'active'));
CREATE POLICY "Owners read own variants" ON public.product_variants FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert own variants" ON public.product_variants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.owner_id = auth.uid()));
CREATE POLICY "Owners update own variants" ON public.product_variants FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.owner_id = auth.uid()));
CREATE POLICY "Owners delete own variants" ON public.product_variants FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE public.product_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','sold')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_stock_product_idx ON public.product_stock(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_stock TO authenticated;
GRANT ALL ON public.product_stock TO service_role;
ALTER TABLE public.product_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own stock" ON public.product_stock FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert own stock" ON public.product_stock FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.owner_id = auth.uid()));
CREATE POLICY "Owners update own stock" ON public.product_stock FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners delete own stock" ON public.product_stock FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Sellers upload own product images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Sellers update own product images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Sellers delete own product images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);