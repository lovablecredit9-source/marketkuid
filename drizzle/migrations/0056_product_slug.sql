ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_key ON public.products (slug) WHERE slug IS NOT NULL;

CREATE OR REPLACE FUNCTION public.make_product_slug(p_name text, p_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE base text; cand text; n int := 1;
BEGIN
  base := regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g');
  base := trim(both '-' from left(trim(both '-' from base), 70));
  IF base = '' THEN base := 'produk'; END IF;
  -- never collide with a uuid-looking link
  IF base ~ '^[0-9a-f]{8}-[0-9a-f]{4}-' THEN base := 'produk-' || base; END IF;
  cand := base;
  WHILE EXISTS (SELECT 1 FROM products WHERE slug = cand AND id <> p_id) LOOP
    n := n + 1; cand := base || '-' || n;
  END LOOP;
  RETURN cand;
END $$;

CREATE OR REPLACE FUNCTION public.tg_product_slug_fill()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.slug IS NULL OR NEW.name IS DISTINCT FROM OLD.name THEN
    NEW.slug := public.make_product_slug(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS products_slug_fill ON public.products;
CREATE TRIGGER products_slug_fill BEFORE INSERT OR UPDATE OF name, slug ON public.products
FOR EACH ROW EXECUTE FUNCTION public.tg_product_slug_fill();

UPDATE public.products SET slug = NULL WHERE slug IS NULL;