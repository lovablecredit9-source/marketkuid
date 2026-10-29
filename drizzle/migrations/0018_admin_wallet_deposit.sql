CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.wallets (
  user_id uuid PRIMARY KEY,
  balance bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or admin wallet" ON public.wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount bigint NOT NULL,
  kind text NOT NULL,
  ref_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_ledger_user_idx ON public.wallet_ledger (user_id, created_at DESC);
GRANT SELECT ON public.wallet_ledger TO authenticated;
GRANT ALL ON public.wallet_ledger TO service_role;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or admin ledger" ON public.wallet_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.deposit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  proof_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deposit_requests_status_idx ON public.deposit_requests (status, created_at DESC);
GRANT SELECT ON public.deposit_requests TO authenticated;
GRANT ALL ON public.deposit_requests TO service_role;
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or admin deposits" ON public.deposit_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.payment_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  qris_path text,
  account_name text,
  instructions text,
  min_deposit integer NOT NULL DEFAULT 10000,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.payment_settings (id) VALUES (1);
GRANT SELECT, UPDATE ON public.payment_settings TO authenticated;
GRANT ALL ON public.payment_settings TO service_role;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in read payment settings" ON public.payment_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update payment settings" ON public.payment_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read all stores" ON public.seller_stores FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read all products" ON public.products FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read all orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.create_deposit(p_amount integer, p_proof text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_min integer; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Harus masuk dulu'; END IF;
  SELECT min_deposit INTO v_min FROM payment_settings WHERE id = 1;
  IF p_amount IS NULL OR p_amount < COALESCE(v_min, 10000) THEN RAISE EXCEPTION 'Minimal deposit Rp%', COALESCE(v_min, 10000); END IF;
  IF p_amount > 10000000 THEN RAISE EXCEPTION 'Maksimal deposit Rp10.000.000'; END IF;
  IF p_proof IS NULL OR split_part(p_proof, '/', 1) <> v_uid::text THEN RAISE EXCEPTION 'Bukti transfer tidak valid'; END IF;
  IF (SELECT count(*) FROM deposit_requests WHERE user_id = v_uid AND status = 'pending') >= 3 THEN
    RAISE EXCEPTION 'Masih ada 3 deposit menunggu dicek admin';
  END IF;
  INSERT INTO deposit_requests (user_id, amount, proof_path) VALUES (v_uid, p_amount, p_proof) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_review_deposit(p_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d deposit_requests%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Khusus admin'; END IF;
  SELECT * INTO d FROM deposit_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deposit tidak ditemukan'; END IF;
  IF d.status <> 'pending' THEN RAISE EXCEPTION 'Deposit sudah diproses'; END IF;
  UPDATE deposit_requests SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    admin_note = NULLIF(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now() WHERE id = p_id;
  IF p_approve THEN
    INSERT INTO wallets (user_id, balance) VALUES (d.user_id, d.amount)
      ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + EXCLUDED.balance, updated_at = now();
    INSERT INTO wallet_ledger (user_id, amount, kind, ref_id, note) VALUES (d.user_id, d.amount, 'deposit', d.id, 'Deposit QRIS disetujui');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Khusus admin'; END IF;
  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM profiles),
    'stores', (SELECT count(*) FROM seller_stores),
    'products', (SELECT count(*) FROM products),
    'orders', (SELECT count(*) FROM orders),
    'orders_done', (SELECT count(*) FROM orders WHERE status = 'selesai'),
    'gmv', (SELECT COALESCE(sum(total), 0) FROM orders WHERE paid_at IS NOT NULL),
    'deposits_pending', (SELECT count(*) FROM deposit_requests WHERE status = 'pending'),
    'deposits_approved', (SELECT COALESCE(sum(amount), 0) FROM deposit_requests WHERE status = 'approved'),
    'wallet_total', (SELECT COALESCE(sum(balance), 0) FROM wallets)
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.create_deposit(integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_review_deposit(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_deposit(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_deposit(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;

CREATE POLICY "Proof upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Payment assets read own qris or admin" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-assets' AND ((storage.foldername(name))[1] = auth.uid()::text OR (storage.foldername(name))[1] = 'qris' OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Admin upload qris" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-assets' AND (storage.foldername(name))[1] = 'qris' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete qris" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'payment-assets' AND (storage.foldername(name))[1] = 'qris' AND public.has_role(auth.uid(), 'admin'));