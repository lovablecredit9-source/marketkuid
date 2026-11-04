CREATE SEQUENCE IF NOT EXISTS public.rekber_code_seq START 1;

CREATE TABLE public.rekber_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('RKB-' || lpad(nextval('public.rekber_code_seq')::text, 6, '0')),
  share_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  seller_id uuid NOT NULL,
  buyer_id uuid,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),
  details text CHECK (details IS NULL OR char_length(details) <= 500),
  amount bigint NOT NULL CHECK (amount BETWEEN 10000 AND 50000000),
  fee bigint NOT NULL CHECK (fee >= 0),
  fee_bearer text NOT NULL CHECK (fee_bearer IN ('pembeli','penjual','dibagi')),
  buyer_pays bigint NOT NULL,
  seller_receives bigint NOT NULL,
  status text NOT NULL DEFAULT 'menunggu_deposit' CHECK (status IN ('menunggu_deposit','ditahan','sengketa','selesai','dikembalikan','dibatalkan')),
  dispute_reason text,
  dispute_by uuid,
  admin_note text,
  deposit_deadline timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  funded_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rekber_deals_seller_idx ON public.rekber_deals (seller_id, created_at DESC);
CREATE INDEX rekber_deals_buyer_idx ON public.rekber_deals (buyer_id, created_at DESC);

GRANT SELECT ON public.rekber_deals TO authenticated;
GRANT ALL ON public.rekber_deals TO service_role;
ALTER TABLE public.rekber_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rekber parties and admin read" ON public.rekber_deals FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR buyer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- fee: 1% of amount, rounded up
CREATE OR REPLACE FUNCTION public.create_rekber(p_title text, p_details text, p_amount bigint, p_fee_bearer text)
RETURNS public.rekber_deals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_fee bigint; r public.rekber_deals;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Masuk dulu'; END IF;
  IF public.is_account_banned(uid) THEN RAISE EXCEPTION 'Akun kamu sedang diblokir'; END IF;
  IF NOT EXISTS (SELECT 1 FROM seller_stores WHERE owner_id = uid) THEN RAISE EXCEPTION 'Buka toko dulu untuk membuat rekber'; END IF;
  IF char_length(trim(coalesce(p_title,''))) < 3 THEN RAISE EXCEPTION 'Judul kesepakatan minimal 3 karakter'; END IF;
  IF p_amount IS NULL OR p_amount < 10000 OR p_amount > 50000000 THEN RAISE EXCEPTION 'Nominal Rp10.000 – Rp50.000.000'; END IF;
  IF p_fee_bearer NOT IN ('pembeli','penjual','dibagi') THEN RAISE EXCEPTION 'Penanggung biaya tidak valid'; END IF;
  IF (SELECT count(*) FROM rekber_deals WHERE seller_id = uid AND status = 'menunggu_deposit' AND deposit_deadline > now()) >= 20 THEN
    RAISE EXCEPTION 'Terlalu banyak rekber menunggu deposit';
  END IF;
  v_fee := ceil(p_amount * 0.01);
  INSERT INTO rekber_deals (seller_id, title, details, amount, fee, fee_bearer, buyer_pays, seller_receives)
  VALUES (uid, trim(p_title), NULLIF(trim(coalesce(p_details,'')), ''), p_amount, v_fee, p_fee_bearer,
    p_amount + CASE p_fee_bearer WHEN 'pembeli' THEN v_fee WHEN 'dibagi' THEN ceil(v_fee / 2.0) ELSE 0 END,
    p_amount - CASE p_fee_bearer WHEN 'penjual' THEN v_fee WHEN 'dibagi' THEN floor(v_fee / 2.0) ELSE 0 END)
  RETURNING * INTO r;
  RETURN r;
END $$;

-- public view of a shared rekber (via secret link token)
CREATE OR REPLACE FUNCTION public.rekber_by_token(p_token text)
RETURNS TABLE (id uuid, code text, title text, details text, amount bigint, fee bigint, fee_bearer text, buyer_pays bigint,
  status text, deposit_deadline timestamptz, created_at timestamptz, store_name text, store_slug text, is_seller boolean, is_buyer boolean, taken boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, d.code, d.title, d.details, d.amount, d.fee, d.fee_bearer, d.buyer_pays, d.status, d.deposit_deadline, d.created_at,
    s.store_name, s.slug, d.seller_id = auth.uid(), d.buyer_id = auth.uid(), d.buyer_id IS NOT NULL
  FROM rekber_deals d LEFT JOIN seller_stores s ON s.owner_id = d.seller_id
  WHERE d.share_token = p_token AND auth.uid() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.pay_rekber(p_token text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); d public.rekber_deals; v_bal bigint;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Masuk dulu'; END IF;
  IF public.is_account_banned(uid) THEN RAISE EXCEPTION 'Akun kamu sedang diblokir'; END IF;
  SELECT * INTO d FROM rekber_deals WHERE share_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rekber tidak ditemukan'; END IF;
  IF d.seller_id = uid THEN RAISE EXCEPTION 'Penjual tidak bisa membayar rekbernya sendiri'; END IF;
  IF d.status <> 'menunggu_deposit' OR d.buyer_id IS NOT NULL THEN RAISE EXCEPTION 'Rekber ini sudah dibayar atau ditutup'; END IF;
  IF d.deposit_deadline < now() THEN RAISE EXCEPTION 'Batas deposit sudah lewat'; END IF;
  INSERT INTO wallets (user_id, balance) VALUES (uid, 0) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_bal FROM wallets WHERE user_id = uid FOR UPDATE;
  IF v_bal < d.buyer_pays THEN RAISE EXCEPTION 'Saldo tidak cukup. Saldo kamu Rp%, perlu Rp%', v_bal, d.buyer_pays; END IF;
  UPDATE wallets SET balance = balance - d.buyer_pays, updated_at = now() WHERE user_id = uid RETURNING balance INTO v_bal;
  INSERT INTO wallet_ledger (user_id, amount, kind, ref_id, note) VALUES (uid, -d.buyer_pays, 'rekber_deposit', d.id, 'Deposit rekber ' || d.code);
  UPDATE rekber_deals SET buyer_id = uid, status = 'ditahan', funded_at = now(), updated_at = now() WHERE id = d.id;
  RETURN v_bal;
END $$;

CREATE OR REPLACE FUNCTION public.confirm_rekber(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); d public.rekber_deals;
BEGIN
  SELECT * INTO d FROM rekber_deals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR d.buyer_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'Hanya pembeli yang bisa menyelesaikan rekber'; END IF;
  IF d.status <> 'ditahan' THEN RAISE EXCEPTION 'Rekber tidak dalam status ditahan'; END IF;
  INSERT INTO wallets (user_id, balance) VALUES (d.seller_id, 0) ON CONFLICT (user_id) DO NOTHING;
  UPDATE wallets SET balance = balance + d.seller_receives, updated_at = now() WHERE user_id = d.seller_id;
  INSERT INTO wallet_ledger (user_id, amount, kind, ref_id, note) VALUES (d.seller_id, d.seller_receives, 'rekber_release', d.id, 'Pencairan rekber ' || d.code);
  UPDATE rekber_deals SET status = 'selesai', completed_at = now(), updated_at = now() WHERE id = d.id;
END $$;

CREATE OR REPLACE FUNCTION public.dispute_rekber(p_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); d public.rekber_deals;
BEGIN
  SELECT * INTO d FROM rekber_deals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR (d.buyer_id IS DISTINCT FROM uid AND d.seller_id <> uid) THEN RAISE EXCEPTION 'Rekber tidak ditemukan'; END IF;
  IF d.status <> 'ditahan' THEN RAISE EXCEPTION 'Sengketa hanya bisa diajukan saat dana ditahan'; END IF;
  IF char_length(trim(coalesce(p_reason,''))) < 5 THEN RAISE EXCEPTION 'Tulis alasan sengketa minimal 5 karakter'; END IF;
  UPDATE rekber_deals SET status = 'sengketa', dispute_reason = left(trim(p_reason), 500), dispute_by = uid, updated_at = now() WHERE id = d.id;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_rekber(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  UPDATE rekber_deals SET status = 'dibatalkan', updated_at = now()
  WHERE id = p_id AND seller_id = uid AND status = 'menunggu_deposit' AND buyer_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rekber tidak bisa dibatalkan'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_rekber(p_id uuid, p_release boolean, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.rekber_deals;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Khusus admin'; END IF;
  SELECT * INTO d FROM rekber_deals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR d.status NOT IN ('ditahan','sengketa') THEN RAISE EXCEPTION 'Rekber tidak sedang ditahan'; END IF;
  IF p_release THEN
    INSERT INTO wallets (user_id, balance) VALUES (d.seller_id, 0) ON CONFLICT (user_id) DO NOTHING;
    UPDATE wallets SET balance = balance + d.seller_receives, updated_at = now() WHERE user_id = d.seller_id;
    INSERT INTO wallet_ledger (user_id, amount, kind, ref_id, note) VALUES (d.seller_id, d.seller_receives, 'rekber_release', d.id, 'Pencairan rekber ' || d.code || ' (admin)');
    UPDATE rekber_deals SET status = 'selesai', completed_at = now(), admin_note = NULLIF(trim(coalesce(p_note,'')), ''), updated_at = now() WHERE id = d.id;
  ELSE
    INSERT INTO wallets (user_id, balance) VALUES (d.buyer_id, 0) ON CONFLICT (user_id) DO NOTHING;
    UPDATE wallets SET balance = balance + d.buyer_pays, updated_at = now() WHERE user_id = d.buyer_id;
    INSERT INTO wallet_ledger (user_id, amount, kind, ref_id, note) VALUES (d.buyer_id, d.buyer_pays, 'rekber_refund', d.id, 'Pengembalian rekber ' || d.code);
    UPDATE rekber_deals SET status = 'dikembalikan', completed_at = now(), admin_note = NULLIF(trim(coalesce(p_note,'')), ''), updated_at = now() WHERE id = d.id;
  END IF;
  PERFORM public.admin_log(CASE WHEN p_release THEN 'rekber_release' ELSE 'rekber_refund' END, 'rekber', d.code, coalesce(NULLIF(trim(p_note),''), d.title));
END $$;

REVOKE ALL ON FUNCTION public.create_rekber(text,text,bigint,text), public.rekber_by_token(text), public.pay_rekber(text),
  public.confirm_rekber(uuid), public.dispute_rekber(uuid,text), public.cancel_rekber(uuid), public.admin_resolve_rekber(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_rekber(text,text,bigint,text), public.rekber_by_token(text), public.pay_rekber(text),
  public.confirm_rekber(uuid), public.dispute_rekber(uuid,text), public.cancel_rekber(uuid), public.admin_resolve_rekber(uuid,boolean,text) TO authenticated;