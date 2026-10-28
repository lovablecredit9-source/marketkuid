CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  username text UNIQUE,
  whatsapp text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.seller_stores (
  owner_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_name text NOT NULL CHECK (char_length(btrim(store_name)) BETWEEN 3 AND 40),
  telegram_username text CHECK (telegram_username IS NULL OR telegram_username ~ '^[A-Za-z0-9_]{5,32}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.seller_stores TO authenticated;
GRANT ALL ON public.seller_stores TO service_role;
ALTER TABLE public.seller_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own store" ON public.seller_stores FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners create own store" ON public.seller_stores FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own store" ON public.seller_stores FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uname text;
BEGIN
  uname := lower(nullif(btrim(NEW.raw_user_meta_data->>'username'), ''));
  IF uname IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE username = uname) THEN
    uname := NULL;
  END IF;
  INSERT INTO public.profiles (id, full_name, username, whatsapp)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', ''),
    uname,
    nullif(NEW.raw_user_meta_data->>'whatsapp', '')
  );
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();