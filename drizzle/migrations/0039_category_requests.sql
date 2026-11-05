CREATE TABLE public.category_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 40),
  icon_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.category_requests TO authenticated;
GRANT ALL ON public.category_requests TO service_role;
ALTER TABLE public.category_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller reads own or admin all" ON public.category_requests FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "seller submits own pending" ON public.category_requests FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND status = 'pending' AND admin_note IS NULL AND reviewed_at IS NULL
    AND EXISTS (SELECT 1 FROM public.seller_stores s WHERE s.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_review_category_request(_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.category_requests;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT * INTO r FROM public.category_requests WHERE id = _id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pengajuan tidak ditemukan'; END IF;
  IF _approve AND NOT EXISTS (SELECT 1 FROM public.product_categories WHERE lower(name) = lower(btrim(r.name)) AND parent_id IS NULL) THEN
    INSERT INTO public.product_categories(name, sort) VALUES (btrim(r.name), (SELECT coalesce(max(sort),0)+1 FROM public.product_categories));
  END IF;
  UPDATE public.category_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, admin_note = _note, reviewed_at = now() WHERE id = _id;
  PERFORM public.admin_log('category_request_' || CASE WHEN _approve THEN 'approve' ELSE 'reject' END, 'category_request', _id::text, _note);
END $$;
REVOKE ALL ON FUNCTION public.admin_review_category_request(uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_category_request(uuid, boolean, text) TO authenticated;