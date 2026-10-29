CREATE OR REPLACE FUNCTION public.product_like_counts(p_ids uuid[])
RETURNS TABLE(product_id uuid, likes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT w.product_id, count(*)::bigint
  FROM public.wishlists w
  JOIN public.products p ON p.id = w.product_id AND p.status = 'active'
  WHERE w.product_id = ANY(p_ids)
  GROUP BY w.product_id
$$;
REVOKE EXECUTE ON FUNCTION public.product_like_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_like_counts(uuid[]) TO anon, authenticated;