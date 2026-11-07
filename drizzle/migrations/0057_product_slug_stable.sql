CREATE OR REPLACE FUNCTION public.tg_product_slug_fill()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' OR (TG_OP = 'UPDATE' AND NEW.slug IS DISTINCT FROM OLD.slug) THEN
    NEW.slug := public.make_product_slug(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END $$;