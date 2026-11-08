CREATE TABLE public.store_visits (
  owner_id uuid NOT NULL,
  visitor_key text NOT NULL,
  visited_on date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, visited_on, visitor_key)
);
GRANT ALL ON public.store_visits TO service_role;
ALTER TABLE public.store_visits ENABLE ROW LEVEL SECURITY;
-- No client policies: rows are written/read only through the functions below.

CREATE OR REPLACE FUNCTION public.record_store_visit(p_owner uuid, p_visitor text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text;
BEGIN
  IF p_owner IS NULL OR p_owner = auth.uid() THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM seller_stores WHERE owner_id = p_owner) THEN RETURN; END IF;
  IF auth.uid() IS NOT NULL THEN k := 'u:' || auth.uid()::text;
  ELSIF p_visitor IS NOT NULL AND p_visitor ~ '^[A-Za-z0-9-]{16,64}$' THEN k := 'a:' || p_visitor;
  ELSE RETURN; END IF;
  INSERT INTO store_visits(owner_id, visitor_key) VALUES (p_owner, k) ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.store_public_stats(p_owner uuid)
RETURNS TABLE(visits_total bigint, visits_today bigint, visitors_7d bigint, followers bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*) FROM store_visits v WHERE v.owner_id = p_owner),
    (SELECT count(*) FROM store_visits v WHERE v.owner_id = p_owner AND v.visited_on = (now() AT TIME ZONE 'Asia/Jakarta')::date),
    (SELECT count(DISTINCT v.visitor_key) FROM store_visits v WHERE v.owner_id = p_owner AND v.visited_on > (now() AT TIME ZONE 'Asia/Jakarta')::date - 7),
    (SELECT count(*) FROM store_follows f WHERE f.seller_id = p_owner);
$$;

REVOKE ALL ON FUNCTION public.record_store_visit(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.store_public_stats(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.record_store_visit(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_public_stats(uuid) TO anon, authenticated;