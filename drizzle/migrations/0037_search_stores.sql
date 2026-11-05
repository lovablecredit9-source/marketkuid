CREATE OR REPLACE FUNCTION public.search_stores(p_q text, p_limit integer DEFAULT 5)
RETURNS TABLE(owner_id uuid, store_name text, slug text, is_open boolean, product_count bigint, rating_avg numeric, review_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT s.owner_id, s.store_name, s.slug, s.is_open,
    (SELECT count(*) FROM public.products p WHERE p.owner_id = s.owner_id AND p.status = 'active'),
    (SELECT round(avg(r.rating)::numeric, 1) FROM public.product_reviews r WHERE r.seller_id = s.owner_id),
    (SELECT count(*) FROM public.product_reviews r WHERE r.seller_id = s.owner_id)
  FROM public.seller_stores s
  WHERE length(trim(coalesce(p_q, ''))) >= 1
    AND s.store_name ILIKE '%' || replace(replace(trim(p_q), '%', ''), '_', '') || '%'
    AND NOT public.is_store_banned(s.owner_id)
  ORDER BY (lower(s.store_name) = lower(trim(p_q))) DESC, (s.store_name ILIKE trim(p_q) || '%') DESC, s.store_name
  LIMIT least(greatest(coalesce(p_limit, 5), 1), 20);
$$;
GRANT EXECUTE ON FUNCTION public.search_stores(text, integer) TO anon, authenticated;