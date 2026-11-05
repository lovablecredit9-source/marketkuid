CREATE OR REPLACE FUNCTION public.registration_availability(p_email text, p_username text)
RETURNS TABLE(email_taken boolean, username_taken boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE WHEN coalesce(btrim(p_email), '') = '' THEN false
         ELSE EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(btrim(p_email))) END,
    CASE WHEN coalesce(btrim(p_username), '') = '' THEN false
         ELSE lower(btrim(p_username)) = ANY (ARRAY['admin','administrator','marketku','support','seller','root','system','moderator','cs','official'])
              OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.username = lower(btrim(p_username))) END;
$$;
REVOKE ALL ON FUNCTION public.registration_availability(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registration_availability(text, text) TO anon, authenticated;