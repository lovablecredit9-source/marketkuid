-- Platform referral program: invite codes, one referral per invited buyer, admin-set rules,
-- reward only after the invited buyer's first qualifying order is released to the seller.

CREATE TABLE public.referral_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_enabled boolean NOT NULL DEFAULT false,
  referrer_reward bigint NOT NULL DEFAULT 2000 CHECK (referrer_reward >= 0 AND referrer_reward <= 1000000),
  referee_reward bigint NOT NULL DEFAULT 0 CHECK (referee_reward >= 0 AND referee_reward <= 1000000),
  min_order bigint NOT NULL DEFAULT 10000 CHECK (min_order >= 0),
  max_rewards_per_referrer integer NOT NULL DEFAULT 50 CHECK (max_rewards_per_referrer BETWEEN 0 AND 10000),
  claim_window_days integer NOT NULL DEFAULT 7 CHECK (claim_window_days BETWEEN 1 AND 90),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.referral_settings TO anon, authenticated;
GRANT ALL ON public.referral_settings TO service_role;
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Referral rules are public" ON public.referral_settings FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.referral_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.referral_codes (
  user_id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_codes TO authenticated;
GRANT ALL ON public.referral_codes TO service_role;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own referral code" ON public.referral_codes FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.referrals (
  referee_id uuid PRIMARY KEY,
  referrer_id uuid NOT NULL,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','rewarded','rejected')),
  order_id uuid,
  referrer_reward bigint NOT NULL DEFAULT 0,
  referee_reward bigint NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  rewarded_at timestamptz,
  CHECK (referee_id <> referrer_id)
);
CREATE INDEX referrals_referrer_idx ON public.referrals (referrer_id, created_at DESC);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants or admin read referrals" ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referee_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Get (or create) the caller's invite code.
CREATE OR REPLACE FUNCTION public.my_referral_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_code text; i int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Masuk dulu'; END IF;
  SELECT code INTO v_code FROM referral_codes WHERE user_id = v_uid;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;
  LOOP
    i := i + 1;
    v_code := 'MK' || upper(substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=0O1IL', ''), 1, 6));
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

-- Invited buyer enters a code: new accounts only, no self-invite, once, before any paid order.
CREATE OR REPLACE FUNCTION public.claim_referral(p_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); s referral_settings%ROWTYPE; v_ref uuid; v_created timestamptz; v_code text := upper(btrim(coalesce(p_code, '')));
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Masuk dulu'; END IF;
  SELECT * INTO s FROM referral_settings WHERE id = 1;
  IF NOT coalesce(s.is_enabled, false) THEN RAISE EXCEPTION 'Program referral sedang tidak aktif'; END IF;
  IF v_code !~ '^[A-Z0-9]{4,16}$' THEN RAISE EXCEPTION 'Kode undangan tidak valid'; END IF;
  IF EXISTS (SELECT 1 FROM referrals WHERE referee_id = v_uid) THEN RAISE EXCEPTION 'Kamu sudah memakai kode undangan'; END IF;
  SELECT user_id INTO v_ref FROM referral_codes WHERE code = v_code;
  IF v_ref IS NULL THEN RAISE EXCEPTION 'Kode undangan tidak ditemukan'; END IF;
  IF v_ref = v_uid THEN RAISE EXCEPTION 'Tidak bisa memakai kode sendiri'; END IF;
  IF EXISTS (SELECT 1 FROM guest_buyers WHERE user_id = v_uid) THEN RAISE EXCEPTION 'Akun tamu tidak bisa ikut referral'; END IF;
  IF public.is_account_banned(v_uid) THEN RAISE EXCEPTION 'Akun sedang dibatasi'; END IF;
  SELECT created_at INTO v_created FROM profiles WHERE id = v_uid;
  IF v_created IS NULL OR v_created < now() - make_interval(days => s.claim_window_days) THEN
    RAISE EXCEPTION 'Kode undangan hanya untuk akun baru (maks % hari setelah daftar)', s.claim_window_days;
  END IF;
  IF EXISTS (SELECT 1 FROM orders WHERE buyer_id = v_uid AND paid_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Kode undangan harus dipakai sebelum pesanan pertama';
  END IF;
  INSERT INTO referrals (referee_id, referrer_id, code) VALUES (v_uid, v_ref, v_code);
END $$;

-- Caller's referral dashboard: code, rules, invited list (usernames only).
CREATE OR REPLACE FUNCTION public.my_referrals()
RETURNS TABLE (referee_label text, status text, referrer_reward bigint, created_at timestamptz, rewarded_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.review_public_label(p.username), r.status, r.referrer_reward, r.created_at, r.rewarded_at
  FROM referrals r LEFT JOIN profiles p ON p.id = r.referee_id
  WHERE r.referrer_id = auth.uid()
  ORDER BY r.created_at DESC LIMIT 200
$$;

-- Reward once the invited buyer's order is released to the seller (seller 'sale' credit = qualifying transaction).
CREATE OR REPLACE FUNCTION public.referral_reward_on_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o orders%ROWTYPE; r referrals%ROWTYPE; s referral_settings%ROWTYPE; v_count int;
BEGIN
  IF NEW.kind <> 'sale' OR NEW.ref_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO o FROM orders WHERE id = NEW.ref_id;
  IF o.id IS NULL OR o.status <> 'completed' THEN RETURN NEW; END IF;
  SELECT * INTO r FROM referrals WHERE referee_id = o.buyer_id AND status = 'pending' FOR UPDATE;
  IF r.referee_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO s FROM referral_settings WHERE id = 1;
  IF NOT coalesce(s.is_enabled, false) THEN RETURN NEW; END IF;
  IF o.total < s.min_order THEN RETURN NEW; END IF; -- stays pending for a bigger order
  IF o.seller_id = r.referrer_id THEN
    UPDATE referrals SET status = 'rejected', order_id = o.id, note = 'Pesanan dari toko pengundang sendiri' WHERE referee_id = r.referee_id;
    RETURN NEW;
  END IF;
  IF public.is_account_banned(r.referrer_id) THEN
    UPDATE referrals SET status = 'rejected', order_id = o.id, note = 'Akun pengundang dibatasi' WHERE referee_id = r.referee_id;
    RETURN NEW;
  END IF;
  SELECT count(*) INTO v_count FROM referrals WHERE referrer_id = r.referrer_id AND status = 'rewarded';
  IF v_count >= s.max_rewards_per_referrer THEN
    UPDATE referrals SET status = 'rejected', order_id = o.id, note = 'Batas hadiah pengundang tercapai' WHERE referee_id = r.referee_id;
    RETURN NEW;
  END IF;
  IF s.referrer_reward > 0 THEN
    INSERT INTO wallets (user_id, balance) VALUES (r.referrer_id, s.referrer_reward)
      ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + EXCLUDED.balance, updated_at = now();
    INSERT INTO wallet_ledger (user_id, amount, kind, ref_id, note) VALUES (r.referrer_id, s.referrer_reward, 'referral', o.id, 'Hadiah referral (pesanan M-' || o.order_no || ')');
  END IF;
  IF s.referee_reward > 0 THEN
    INSERT INTO wallets (user_id, balance) VALUES (r.referee_id, s.referee_reward)
      ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + EXCLUDED.balance, updated_at = now();
    INSERT INTO wallet_ledger (user_id, amount, kind, ref_id, note) VALUES (r.referee_id, s.referee_reward, 'referral', o.id, 'Bonus pengguna baru (kode ' || r.code || ')');
  END IF;
  UPDATE referrals SET status = 'rewarded', order_id = o.id, referrer_reward = s.referrer_reward, referee_reward = s.referee_reward, rewarded_at = now()
    WHERE referee_id = r.referee_id;
  RETURN NEW;
END $$;
CREATE TRIGGER referral_reward_on_sale AFTER INSERT ON public.wallet_ledger
  FOR EACH ROW WHEN (NEW.kind = 'sale') EXECUTE FUNCTION public.referral_reward_on_sale();

-- Admin: change rules (audited).
CREATE OR REPLACE FUNCTION public.admin_update_referral_settings(p_enabled boolean, p_referrer_reward bigint, p_referee_reward bigint, p_min_order bigint, p_max_rewards integer, p_window_days integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Khusus admin'; END IF;
  UPDATE referral_settings SET is_enabled = p_enabled, referrer_reward = p_referrer_reward, referee_reward = p_referee_reward,
    min_order = p_min_order, max_rewards_per_referrer = p_max_rewards, claim_window_days = p_window_days, updated_at = now(), updated_by = auth.uid()
  WHERE id = 1;
  PERFORM public.admin_log('referral_settings', 'referral', '1',
    (CASE WHEN p_enabled THEN 'aktif' ELSE 'nonaktif' END) || ' • pengundang Rp' || p_referrer_reward || ' • baru Rp' || p_referee_reward || ' • min Rp' || p_min_order || ' • maks ' || p_max_rewards || ' • ' || p_window_days || ' hari');
END $$;

-- Admin: list referrals with usernames.
CREATE OR REPLACE FUNCTION public.admin_referrals()
RETURNS TABLE (referee_id uuid, referee text, referrer_id uuid, referrer text, code text, status text, order_id uuid, referrer_reward bigint, referee_reward bigint, note text, created_at timestamptz, rewarded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Khusus admin'; END IF;
  RETURN QUERY SELECT r.referee_id, coalesce(a.username, a.full_name), r.referrer_id, coalesce(b.username, b.full_name), r.code, r.status, r.order_id,
    r.referrer_reward, r.referee_reward, r.note, r.created_at, r.rewarded_at
  FROM referrals r LEFT JOIN profiles a ON a.id = r.referee_id LEFT JOIN profiles b ON b.id = r.referrer_id
  ORDER BY r.created_at DESC LIMIT 500;
END $$;

-- Admin: reject a suspicious pending referral (audited).
CREATE OR REPLACE FUNCTION public.admin_reject_referral(p_referee uuid, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Khusus admin'; END IF;
  IF NULLIF(btrim(p_note), '') IS NULL THEN RAISE EXCEPTION 'Alasan wajib diisi'; END IF;
  UPDATE referrals SET status = 'rejected', note = btrim(p_note) WHERE referee_id = p_referee AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Referral tidak ditemukan atau sudah diproses'; END IF;
  PERFORM public.admin_log('referral_reject', 'user', p_referee::text, btrim(p_note));
END $$;

REVOKE ALL ON FUNCTION public.referral_reward_on_sale() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_referral_code() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_referral(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_referrals() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_referral_settings(boolean, bigint, bigint, bigint, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_referrals() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reject_referral(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_referral_code(), public.claim_referral(text), public.my_referrals(),
  public.admin_update_referral_settings(boolean, bigint, bigint, bigint, integer, integer), public.admin_referrals(), public.admin_reject_referral(uuid, text) TO authenticated;
