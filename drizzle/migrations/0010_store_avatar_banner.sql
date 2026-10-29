ALTER TABLE public.seller_stores ADD COLUMN IF NOT EXISTS avatar_path text, ADD COLUMN IF NOT EXISTS banner_path text;

CREATE OR REPLACE FUNCTION public.store_media(p_ids uuid[])
RETURNS TABLE (owner_id uuid, avatar_path text, banner_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.owner_id, s.avatar_path, s.banner_path FROM public.seller_stores s WHERE s.owner_id = ANY(p_ids);
$$;
REVOKE ALL ON FUNCTION public.store_media(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.store_media(uuid[]) TO anon, authenticated;