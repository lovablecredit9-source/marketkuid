CREATE OR REPLACE FUNCTION public.make_store_slug(p_name text, p_owner uuid)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE base text; cand text; n int := 1;
BEGIN
  base := regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g');
  base := left(trim(both '-' from base), 36);
  base := trim(both '-' from base);
  IF base = '' THEN base := 'toko'; END IF;
  IF length(base) < 3 THEN base := base || '-toko'; END IF;
  cand := base;
  WHILE EXISTS (SELECT 1 FROM seller_stores WHERE slug = cand AND owner_id <> p_owner) LOOP
    n := n + 1; cand := base || '-' || n;
  END LOOP;
  RETURN cand;
END $$;

CREATE OR REPLACE FUNCTION public.tg_store_slug_fill()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    NEW.slug := public.make_store_slug(NEW.store_name, NEW.owner_id);
  ELSE
    NEW.slug := lower(btrim(NEW.slug));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS seller_stores_slug_fill ON public.seller_stores;
CREATE TRIGGER seller_stores_slug_fill BEFORE INSERT OR UPDATE OF slug, store_name ON public.seller_stores
FOR EACH ROW EXECUTE FUNCTION public.tg_store_slug_fill();

UPDATE public.seller_stores SET slug = public.make_store_slug(store_name, owner_id)
WHERE slug IS NULL OR btrim(slug) = '';

CREATE OR REPLACE FUNCTION public.store_by_slug(p_slug text)
RETURNS TABLE(owner_id uuid, store_name text, slug text, description text, is_open boolean, created_at timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT s.owner_id, s.store_name, s.slug, s.description, s.is_open, s.created_at
  FROM public.seller_stores s WHERE s.slug = lower(p_slug) OR s.owner_id::text = lower(p_slug) LIMIT 1;
$function$;