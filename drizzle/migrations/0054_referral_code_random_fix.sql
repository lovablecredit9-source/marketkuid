CREATE OR REPLACE FUNCTION public.my_referral_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_code text; i int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Masuk dulu'; END IF;
  SELECT code INTO v_code FROM referral_codes WHERE user_id = v_uid;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;
  LOOP
    i := i + 1;
    v_code := 'MK' || upper(substr(translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/=0Oo1IilL', ''), 1, 6));
    BEGIN
      INSERT INTO referral_codes (user_id, code) VALUES (v_uid, v_code);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      SELECT code INTO v_code FROM referral_codes WHERE user_id = v_uid;
      IF v_code IS NOT NULL THEN RETURN v_code; END IF;
      IF i > 10 THEN RAISE EXCEPTION 'Gagal membuat kode, coba lagi'; END IF;
    END;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.my_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_referral_code() TO authenticated;
