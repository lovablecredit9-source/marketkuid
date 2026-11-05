ALTER TABLE public.deposit_requests ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'wallet';
ALTER TABLE public.deposit_requests ADD CONSTRAINT deposit_requests_purpose_chk CHECK (purpose IN ('wallet','credits'));

CREATE TABLE public.seller_credits (
  owner_id uuid PRIMARY KEY,
  balance bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seller_credits TO authenticated;
GRANT ALL ON public.seller_credits TO service_role;
ALTER TABLE public.seller_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or admin credits" ON public.seller_credits FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.seller_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  amount bigint NOT NULL,
  kind text NOT NULL,
  ref_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX seller_credit_ledger_owner_idx ON public.seller_credit_ledger (owner_id, created_at DESC);
GRANT SELECT ON public.seller_credit_ledger TO authenticated;
GRANT ALL ON public.seller_credit_ledger TO service_role;
ALTER TABLE public.seller_credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or admin credit ledger" ON public.seller_credit_ledger FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.create_credit_topup(p_amount integer, p_proof text, p_method uuid DEFAULT NULL::uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_label text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Harus masuk dulu'; END IF;
  IF public.is_account_banned(v_uid) THEN RAISE EXCEPTION 'Akun kamu sedang diblokir'; END IF;
  IF NOT EXISTS (SELECT 1 FROM seller_stores WHERE owner_id = v_uid) THEN RAISE EXCEPTION 'Khusus seller'; END IF;
  IF p_amount IS NULL OR p_amount < 1000 THEN RAISE EXCEPTION 'Minimal top up credits Rp1.000'; END IF;
  IF p_amount > 10000000 THEN RAISE EXCEPTION 'Maksimal top up credits Rp10.000.000'; END IF;
  IF p_proof IS NULL OR split_part(p_proof, '/', 1) <> v_uid::text THEN RAISE EXCEPTION 'Bukti transfer tidak valid'; END IF;
  IF p_method IS NOT NULL THEN
    SELECT provider INTO v_label FROM payment_methods WHERE id = p_method AND is_active;
    IF v_label IS NULL THEN RAISE EXCEPTION 'Metode pembayaran tidak tersedia'; END IF;
  END IF;
  IF (SELECT count(*) FROM deposit_requests WHERE user_id = v_uid AND status = 'pending' AND purpose = 'credits') >= 3 THEN
    RAISE EXCEPTION 'Masih ada 3 top up credits menunggu dicek admin';
  END IF;
  INSERT INTO deposit_requests (user_id, amount, proof_path, method_id, method_label, purpose)
    VALUES (v_uid, p_amount, p_proof, p_method, COALESCE(v_label, 'QRIS'), 'credits') RETURNING id INTO v_id;
  RETURN v_id;
END $function$;
REVOKE ALL ON FUNCTION public.create_credit_topup(integer, text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_credit_topup(integer, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_deposit(p_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE d deposit_requests%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Khusus admin'; END IF;
  SELECT * INTO d FROM deposit_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deposit tidak ditemukan'; END IF;
  IF d.status <> 'pending' THEN RAISE EXCEPTION 'Deposit sudah diproses'; END IF;
  UPDATE deposit_requests SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    admin_note = NULLIF(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now() WHERE id = p_id;
  IF p_approve THEN
    IF d.purpose = 'credits' THEN
      INSERT INTO seller_credits (owner_id, balance) VALUES (d.user_id, d.amount)
        ON CONFLICT (owner_id) DO UPDATE SET balance = seller_credits.balance + EXCLUDED.balance, updated_at = now();
      INSERT INTO seller_credit_ledger (owner_id, amount, kind, ref_id, note)
        VALUES (d.user_id, d.amount, 'topup', d.id, 'Top up credits ' || COALESCE(d.method_label, 'QRIS'));
    ELSE
      INSERT INTO wallets (user_id, balance) VALUES (d.user_id, d.amount)
        ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + EXCLUDED.balance, updated_at = now();
      INSERT INTO wallet_ledger (user_id, amount, kind, ref_id, note) VALUES (d.user_id, d.amount, 'deposit', d.id, 'Deposit ' || COALESCE(d.method_label, 'QRIS') || ' disetujui');
    END IF;
  END IF;
  PERFORM public.admin_log(CASE WHEN p_approve THEN 'approve_deposit' ELSE 'reject_deposit' END, 'deposit', p_id::text,
    CASE WHEN d.purpose = 'credits' THEN 'Credits ' ELSE '' END || d.amount || COALESCE(' • ' || NULLIF(trim(p_note), ''), ''));
END $function$;