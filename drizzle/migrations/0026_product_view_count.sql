ALTER TABLE public.products ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.record_product_view(p_product uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.products SET view_count = view_count + 1
  WHERE id = p_product AND status = 'active' AND owner_id IS DISTINCT FROM auth.uid();
$$;

REVOKE ALL ON FUNCTION public.record_product_view(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.record_product_view(uuid) TO anon, authenticated;