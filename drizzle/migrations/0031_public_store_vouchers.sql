CREATE OR REPLACE FUNCTION public.public_store_vouchers(p_owner uuid)
RETURNS TABLE (code text, name text, kind text, value numeric, value_type text, max_discount numeric, min_spend numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.code, v.name, v.kind, v.value::numeric, v.value_type, v.max_discount::numeric, v.min_spend::numeric
  FROM public.seller_vouchers v
  WHERE v.owner_id = p_owner AND v.is_active
    AND (v.starts_at IS NULL OR v.starts_at <= now())
    AND (v.ends_at IS NULL OR v.ends_at > now())
    AND (v.usage_limit IS NULL OR v.used_count < v.usage_limit)
  ORDER BY v.created_at DESC
  LIMIT 10
$$;
REVOKE ALL ON FUNCTION public.public_store_vouchers(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.public_store_vouchers(uuid) TO anon, authenticated, service_role;