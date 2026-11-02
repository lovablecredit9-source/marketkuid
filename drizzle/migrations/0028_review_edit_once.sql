ALTER TABLE public.product_reviews ADD COLUMN IF NOT EXISTS edited_at timestamptz;

CREATE OR REPLACE FUNCTION public.edit_review(p_id uuid, p_rating smallint, p_comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.product_reviews;
BEGIN
  SELECT * INTO r FROM public.product_reviews WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL OR r.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'Ulasan tidak ditemukan'; END IF;
  IF r.edited_at IS NOT NULL THEN RAISE EXCEPTION 'Ulasan hanya bisa diedit satu kali'; END IF;
  IF now() > r.created_at + interval '7 days' THEN RAISE EXCEPTION 'Batas edit ulasan (7 hari) sudah lewat'; END IF;
  IF p_rating < 1 OR p_rating > 5 THEN RAISE EXCEPTION 'Rating harus 1-5'; END IF;
  UPDATE public.product_reviews
     SET rating = p_rating, comment = NULLIF(left(trim(coalesce(p_comment,'')), 1000), ''), edited_at = now()
   WHERE id = p_id;
END $$;

REVOKE ALL ON FUNCTION public.edit_review(uuid, smallint, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.edit_review(uuid, smallint, text) TO authenticated;