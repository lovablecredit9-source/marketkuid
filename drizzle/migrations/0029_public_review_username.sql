CREATE OR REPLACE FUNCTION public.review_public_label(p_username text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT coalesce(nullif(btrim(p_username), ''), 'Pembeli') $$;
CREATE OR REPLACE FUNCTION public.set_review_label()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE n text;
BEGIN
  SELECT username INTO n FROM public.profiles WHERE id = NEW.buyer_id;
  NEW.buyer_label := public.review_public_label(n);
  NEW.helpful_count := 0;
  RETURN NEW;
END $$;