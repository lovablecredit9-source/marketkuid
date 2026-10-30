CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  fee bigint NOT NULL DEFAULT 0,
  net bigint NOT NULL,
  same_day boolean NOT NULL DEFAULT false,
  auto boolean NOT NULL DEFAULT false,
  bank_type text,
  bank_provider text NOT NULL,
  bank_number text NOT NULL,
  bank_holder text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','rejected')),
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own withdrawals" ON public.withdrawal_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admin withdrawals" ON public.withdrawal_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX withdrawal_requests_user_idx ON public.withdrawal_requests (user_id, created_at DESC);

ALTER TABLE public.seller_stores ADD COLUMN IF NOT EXISTS auto_withdraw boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.request_withdrawal(p_same_day boolean DEFAULT false, p_auto boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s seller_stores%ROWTYPE; v_bal bigint; v_fee bigint; v_id uuid; v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Silakan masuk dulu'; END IF;
  IF public.is_account_banned(auth.uid()) THEN RAISE EXCEPTION 'Akun sedang diblokir'; END IF;
  SELECT * INTO s FROM seller_stores WHERE owner_id = auth.uid();
  IF s.owner_id IS NULL THEN RAISE EXCEPTION 'Toko tidak ditemukan'; END IF;
  IF COALESCE(trim(s.bank_number), '') = '' OR COALESCE(trim(s.bank_provider), '') = '' THEN RAISE EXCEPTION 'Daftarkan rekening dulu di Pengaturan → Keuangan'; END IF;
  IF EXISTS (SELECT 1 FROM withdrawal_requests WHERE user_id = auth.uid() AND status = 'pending') THEN RAISE EXCEPTION 'Masih ada penarikan yang diproses'; END IF;
  IF NOT p_same_day AND EXISTS (SELECT 1 FROM withdrawal_requests WHERE user_id = auth.uid() AND NOT same_day AND status <> 'rejected' AND (created_at AT TIME ZONE 'Asia/Jakarta')::date = v_today) THEN
    RAISE EXCEPTION 'Kuota penarikan reguler hari ini sudah dipakai, pilih Same day processing';
  END IF;
  SELECT balance INTO v_bal FROM wallets WHERE user_id = auth.uid() FOR UPDATE;
  v_bal := COALESCE(v_bal, 0);
  IF v_bal < 50000 THEN RAISE EXCEPTION 'Saldo minimal Rp50.000 untuk tarik dana'; END IF;
  v_fee := CASE WHEN p_same_day THEN 3000 ELSE 2000 END;
  UPDATE wallets SET balance = balance - v_bal, updated_at = now() WHERE user_id = auth.uid();
  INSERT INTO withdrawal_requests (user_id, amount, fee, net, same_day, auto, bank_type, bank_provider, bank_number, bank_holder)
    VALUES (auth.uid(), v_bal, v_fee, v_bal - v_fee, p_same_day, p_auto, s.bank_type, s.bank_provider, s.bank_number, s.bank_holder) RETURNING id INTO v_id;
  INSERT INTO wallet_ledger (user_id, amount, kind, ref_id, note) VALUES (auth.uid(), -v_bal, 'withdraw', v_id, 'Tarik saldo ke ' || s.bank_provider);
  RETURN v_id;
END $$;

-- Auto withdraw: dijalankan saat Seller Center dibuka, setelah 08:00 WIB, sekali per hari
CREATE OR REPLACE FUNCTION public.auto_withdraw_tick()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_on boolean; v_bal bigint;
BEGIN
  SELECT auto_withdraw INTO v_on FROM seller_stores WHERE owner_id = auth.uid();
  IF NOT COALESCE(v_on, false) THEN RETURN NULL; END IF;
  IF extract(hour FROM now() AT TIME ZONE 'Asia/Jakarta') < 8 THEN RETURN NULL; END IF;
  SELECT balance INTO v_bal FROM wallets WHERE user_id = auth.uid();
  IF COALESCE(v_bal, 0) < 50000 THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM withdrawal_requests WHERE user_id = auth.uid() AND (status = 'pending' OR (NOT same_day AND status <> 'rejected' AND (created_at AT TIME ZONE 'Asia/Jakarta')::date = (now() AT TIME ZONE 'Asia/Jakarta')::date))) THEN RETURN NULL; END IF;
  RETURN public.request_withdrawal(false, true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_review_withdrawal(p_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w withdrawal_requests%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Khusus admin'; END IF;
  SELECT * INTO w FROM withdrawal_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Penarikan tidak ditemukan'; END IF;
  IF w.status <> 'pending' THEN RAISE EXCEPTION 'Penarikan sudah diproses'; END IF;
  IF NOT p_approve AND COALESCE(trim(p_note), '') = '' THEN RAISE EXCEPTION 'Isi alasan penolakan'; END IF;
  UPDATE withdrawal_requests SET status = CASE WHEN p_approve THEN 'sent' ELSE 'rejected' END,
    admin_note = NULLIF(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now() WHERE id = p_id;
  IF NOT p_approve THEN
    INSERT INTO wallets (user_id, balance) VALUES (w.user_id, w.amount)
      ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + EXCLUDED.balance, updated_at = now();
    INSERT INTO wallet_ledger (user_id, amount, kind, ref_id, note) VALUES (w.user_id, w.amount, 'withdraw_refund', w.id, 'Penarikan ditolak: ' || trim(p_note));
  END IF;
  PERFORM public.admin_log(CASE WHEN p_approve THEN 'approve_withdrawal' ELSE 'reject_withdrawal' END, 'withdrawal', p_id::text, w.amount || COALESCE(' • ' || NULLIF(trim(p_note), ''), ''));
END $$;

REVOKE EXECUTE ON FUNCTION public.request_withdrawal(boolean, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.auto_withdraw_tick() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_review_withdrawal(uuid, boolean, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_withdraw_tick() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_withdrawal(uuid, boolean, text) TO authenticated;