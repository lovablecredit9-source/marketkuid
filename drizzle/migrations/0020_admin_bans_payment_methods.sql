CREATE TABLE public.account_bans (
  user_id uuid PRIMARY KEY,
  reason text,
  banned_until timestamptz,
  banned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_bans TO authenticated;
GRANT ALL ON public.account_bans TO service_role;
ALTER TABLE public.account_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or admin account ban" ON public.account_bans FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.store_bans (
  owner_id uuid PRIMARY KEY,
  reason text,
  banned_until timestamptz,
  banned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_bans TO authenticated;
GRANT ALL ON public.store_bans TO service_role;
ALTER TABLE public.store_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or admin store ban" ON public.store_bans FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'ewallet' CHECK (kind IN ('qris','ewallet','bank')),
  provider text NOT NULL,
  account_number text,
  account_name text,
  qr_path text,
  is_active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in read active payment methods" ON public.payment_methods FOR SELECT TO authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert payment methods" ON public.payment_methods FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update payment methods" ON public.payment_methods FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete payment methods" ON public.payment_methods FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.payment_methods (kind, provider, account_name, qr_path, sort)
  SELECT 'qris', 'QRIS', account_name, qris_path, 0 FROM public.payment_settings WHERE id = 1 AND qris_path IS NOT NULL;

CREATE TABLE public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_logs_created_idx ON public.admin_logs (created_at DESC);
GRANT SELECT ON public.admin_logs TO authenticated;
GRANT ALL ON public.admin_logs TO service_role;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read logs" ON public.admin_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.deposit_requests ADD COLUMN method_id uuid, ADD COLUMN method_label text;
ALTER TABLE public.products ADD COLUMN admin_hidden boolean NOT NULL DEFAULT false, ADD COLUMN admin_note text;

CREATE OR REPLACE FUNCTION public.is_account_banned(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM account_bans WHERE user_id = p_user AND (banned_until IS NULL OR banned_until > now()))
$$;
CREATE OR REPLACE FUNCTION public.is_store_banned(p_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM store_bans WHERE owner_id = p_owner AND (banned_until IS NULL OR banned_until > now()))
      OR public.is_account_banned(p_owner)
$$;
GRANT EXECUTE ON FUNCTION public.is_account_banned(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_store_banned(uuid) TO anon, authenticated;

CREATE POLICY "Hide banned stores and taken-down products" ON public.products AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR (NOT admin_hidden AND NOT public.is_store_banned(owner_id)));

CREATE OR REPLACE FUNCTION public.my_bans()
RETURNS TABLE(kind text, reason text, banned_until timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'account', b.reason, b.banned_until FROM account_bans b WHERE b.user_id = auth.uid() AND (b.banned_until IS NULL OR b.banned_until > now())
  UNION ALL
  SELECT 'store', b.reason, b.banned_until FROM store_bans b WHERE b.owner_id = auth.uid() AND (b.banned_until IS NULL OR b.banned_until > now())
$$;
REVOKE EXECUTE ON FUNCTION public.my_bans() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_bans() TO authenticated;

CREATE OR REPLACE FUNCTION public.store_ban_status(p_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT public.is_store_banned(p_owner) $$;
GRANT EXECUTE ON FUNCTION public.store_ban_status(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_banned_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_account_banned(NEW.buyer_id) THEN RAISE EXCEPTION 'Akun kamu sedang diblokir'; END IF;
  IF public.is_store_banned(NEW.seller_id) THEN RAISE EXCEPTION 'Toko ini sedang diblokir'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER orders_guard_banned BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_banned_order();

CREATE OR REPLACE FUNCTION public.guard_hidden_order_item() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.product_id IS NOT NULL AND EXISTS (SELECT 1 FROM products WHERE id = NEW.product_id AND admin_hidden) THEN
    RAISE EXCEPTION 'Produk tidak tersedia';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER order_items_guard_hidden BEFORE INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.guard_hidden_order_item();

CREATE OR REPLACE FUNCTION public.guard_banned_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_account_banned(NEW.sender_id) THEN RAISE EXCEPTION 'Akun kamu sedang diblokir'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER messages_guard_banned BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.guard_banned_message();

CREATE OR REPLACE FUNCTION public.guard_product_admin_fields() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF public.is_store_banned(NEW.owner_id) THEN RAISE EXCEPTION 'Toko kamu sedang diblokir'; END IF;
    NEW.admin_hidden := false; NEW.admin_note := NULL;
  ELSE
    NEW.admin_hidden := OLD.admin_hidden; NEW.admin_note := OLD.admin_note;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER products_guard_admin_fields BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.guard_product_admin_fields();

CREATE OR REPLACE FUNCTION public.admin_log(p_action text, p_type text, p_target text, p_note text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO admin_logs (admin_id, action, target_type, target_id, note) VALUES (auth.uid(), p_action, p_type, p_target, NULLIF(trim(p_note), ''))
$$;
REVOKE EXECUTE ON FUNCTION public.admin_log(text, text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_ban_user(p_user uuid, p_days integer, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_until timestamptz := CASE WHEN COALESCE(p_days, 0) > 0 THEN now() + make_interval(days => p_days) ELSE NULL END;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Khusus admin'; END IF;
  IF p_user = auth.uid() OR public.has_role(p_user, 'admin') THEN RAISE EXCEPTION 'Akun admin tidak bisa diblokir'; END IF;
  IF p_days IS NOT NULL AND (p_days < 0 OR p_days > 3650) THEN RAISE EXCEPTION 'Durasi blokir tidak valid'; END IF;
  INSERT INTO account_bans (user_id, reason, banned_until, banned_by) VALUES (p_user, NULLIF(trim(p_reason), ''), v_until, auth.uid())
    ON CONFLICT (user_id) DO UPDATE SET reason = EXCLUDED.reason, banned_until = EXCLUDED.banned_until, banned_by = EXCLUDED.banned_by, created_at = now();
  PERFORM public.admin_log('ban_user', 'user', p_user::text, CASE WHEN v_until IS NULL THEN 'Permanen' ELSE p_days || ' hari' END || COALESCE(' • ' || NULLIF(trim(p_reason), ''), ''));
END $$;

CREATE OR REPLACE FUNCTION public.admin_unban_user(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Khusus admin'; END IF;
  DELETE FROM account_bans WHERE user_id = p_user;
  PERFORM public.admin_log('unban_user', 'user', p_user::text, NULL);
END $$;

CREATE OR REPLACE FUNCTION public.admin_ban_store(p_owner uuid, p_days integer, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_until timestamptz := CASE WHEN COALESCE(p_days, 0) > 0 THEN now() + make_interval(days => p_days) ELSE NULL END;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Khusus admin'; END IF;
  IF NOT EXISTS (SELECT 1 FROM seller_stores WHERE owner_id = p_owner) THEN RAISE EXCEPTION 'Toko tidak ditemukan'; END IF;
  IF p_days IS NOT NULL AND (p_days < 0 OR p_days > 3650) THEN RAISE EXCEPTION 'Durasi blokir tidak valid'; END IF;
  INSERT INTO store_bans (owner_id, reason, banned_until, banned_by) VALUES (p_owner, NULLIF(trim(p_reason), ''), v_until, auth.uid())
    ON CONFLICT (owner_id) DO UPDATE SET reason = EXCLUDED.reason, banned_until = EXCLUDED.banned_until, banned_by = EXCLUDED.banned_by, created_at = now();
  PERFORM public.admin_log('ban_store', 'store', p_owner::text, CASE WHEN v_until IS NULL THEN 'Permanen' ELSE p_days || ' hari' END || COALESCE(' • ' || NULLIF(trim(p_reason), ''), ''));
END $$;

CREATE OR REPLACE FUNCTION public.admin_unban_store(p_owner uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Khusus admin'; END IF;
  DELETE FROM store_bans WHERE owner_id = p_owner;
  PERFORM public.admin_log('unban_store', 'store', p_owner::text, NULL);
END $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(p_user uuid, p_amount bigint, p_note text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bal bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Khusus admin'; END IF;
  IF p_amount IS NULL OR p_amount = 0 OR abs(p_amount) > 100000000 THEN RAISE EXCEPTION 'Nominal tidak valid'; END IF;
  IF NULLIF(trim(p_note), '') IS NULL THEN RAISE EXCEPTION 'Catatan wajib diisi'; END IF;
  INSERT INTO wallets (user_id, balance) VALUES (p_user, 0) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_bal FROM wallets WHERE user_id = p_user FOR UPDATE;
  IF v_bal + p_amount < 0 THEN RAISE EXCEPTION 'Saldo tidak cukup untuk dikurangi'; END IF;
  UPDATE wallets SET balance = balance + p_amount, updated_at = now() WHERE user_id = p_user RETURNING balance INTO v_bal;
  INSERT INTO wallet_ledger (user_id, amount, kind, note) VALUES (p_user, p_amount, 'admin_adjust', trim(p_note));
  PERFORM public.admin_log(CASE WHEN p_amount > 0 THEN 'wallet_add' ELSE 'wallet_sub' END, 'user', p_user::text, p_amount || ' • ' || trim(p_note));
  RETURN v_bal;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_product_hidden(p_id uuid, p_hidden boolean, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Khusus admin'; END IF;
  UPDATE products SET admin_hidden = p_hidden, admin_note = CASE WHEN p_hidden THEN NULLIF(trim(p_note), '') ELSE NULL END WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produk tidak ditemukan'; END IF;
  PERFORM public.admin_log(CASE WHEN p_hidden THEN 'hide_product' ELSE 'show_product' END, 'product', p_id::text, p_note);
END $$;

CREATE OR REPLACE FUNCTION public.admin_users()
RETURNS TABLE(id uuid, email text, full_name text, username text, whatsapp text, created_at timestamptz, last_seen_at timestamptz,
  balance bigint, is_admin boolean, has_store boolean, ban_reason text, banned_until timestamptz, is_banned boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Khusus admin'; END IF;
  RETURN QUERY
  SELECT p.id, u.email::text, p.full_name, p.username, p.whatsapp, p.created_at, p.last_seen_at,
    COALESCE(w.balance, 0)::bigint, public.has_role(p.id, 'admin'), EXISTS (SELECT 1 FROM seller_stores s WHERE s.owner_id = p.id),
    b.reason, b.banned_until, (b.user_id IS NOT NULL AND (b.banned_until IS NULL OR b.banned_until > now()))
  FROM profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN wallets w ON w.user_id = p.id
  LEFT JOIN account_bans b ON b.user_id = p.id
  ORDER BY p.created_at DESC LIMIT 1000;
END $$;

CREATE OR REPLACE FUNCTION public.admin_stores()
RETURNS TABLE(owner_id uuid, store_name text, slug text, is_open boolean, telegram_username text, contact_phone text, created_at timestamptz,
  owner_email text, products integer, orders integer, revenue bigint, ban_reason text, banned_until timestamptz, is_banned boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Khusus admin'; END IF;
  RETURN QUERY
  SELECT s.owner_id, s.store_name, s.slug, s.is_open, s.telegram_username, s.contact_phone, s.created_at, u.email::text,
    (SELECT count(*)::int FROM products pr WHERE pr.owner_id = s.owner_id),
    (SELECT count(*)::int FROM orders o WHERE o.seller_id = s.owner_id),
    (SELECT COALESCE(sum(o.total), 0)::bigint FROM orders o WHERE o.seller_id = s.owner_id AND o.status = 'completed'),
    b.reason, b.banned_until, (b.owner_id IS NOT NULL AND (b.banned_until IS NULL OR b.banned_until > now()))
  FROM seller_stores s
  LEFT JOIN auth.users u ON u.id = s.owner_id
  LEFT JOIN store_bans b ON b.owner_id = s.owner_id
  ORDER BY s.created_at DESC LIMIT 1000;
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
    INSERT INTO wallet_ledger (user_id, amount, kind, ref_id, note) VALUES (d.user_id, d.amount, 'deposit', d.id, 'Deposit ' || COALESCE(d.method_label, 'QRIS') || ' disetujui');
  END IF;
  PERFORM public.admin_log(CASE WHEN p_approve THEN 'approve_deposit' ELSE 'reject_deposit' END, 'deposit', p_id::text, d.amount || COALESCE(' • ' || NULLIF(trim(p_note), ''), ''));
END $$;

DROP FUNCTION public.create_deposit(integer, text);
CREATE FUNCTION public.create_deposit(p_amount integer, p_proof text, p_method uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_min integer; v_id uuid; v_label text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Harus masuk dulu'; END IF;
  IF public.is_account_banned(v_uid) THEN RAISE EXCEPTION 'Akun kamu sedang diblokir'; END IF;
  SELECT min_deposit INTO v_min FROM payment_settings WHERE id = 1;
  IF p_amount IS NULL OR p_amount < COALESCE(v_min, 10000) THEN RAISE EXCEPTION 'Minimal deposit Rp%', COALESCE(v_min, 10000); END IF;
  IF p_amount > 10000000 THEN RAISE EXCEPTION 'Maksimal deposit Rp10.000.000'; END IF;
  IF p_proof IS NULL OR split_part(p_proof, '/', 1) <> v_uid::text THEN RAISE EXCEPTION 'Bukti transfer tidak valid'; END IF;
  IF p_method IS NOT NULL THEN
    SELECT provider INTO v_label FROM payment_methods WHERE id = p_method AND is_active;
    IF v_label IS NULL THEN RAISE EXCEPTION 'Metode pembayaran tidak tersedia'; END IF;
  END IF;
  IF (SELECT count(*) FROM deposit_requests WHERE user_id = v_uid AND status = 'pending') >= 3 THEN
    RAISE EXCEPTION 'Masih ada 3 deposit menunggu dicek admin';
  END IF;
  INSERT INTO deposit_requests (user_id, amount, proof_path, method_id, method_label) VALUES (v_uid, p_amount, p_proof, p_method, COALESCE(v_label, 'QRIS')) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Khusus admin'; END IF;
  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM profiles),
    'users_today', (SELECT count(*) FROM profiles WHERE created_at > now() - interval '1 day'),
    'stores', (SELECT count(*) FROM seller_stores),
    'products', (SELECT count(*) FROM products),
    'products_hidden', (SELECT count(*) FROM products WHERE admin_hidden),
    'orders', (SELECT count(*) FROM orders),
    'orders_done', (SELECT count(*) FROM orders WHERE status = 'completed'),
    'orders_pending', (SELECT count(*) FROM orders WHERE status = 'pending'),
    'gmv', (SELECT COALESCE(sum(total), 0) FROM orders WHERE paid_at IS NOT NULL),
    'deposits_pending', (SELECT count(*) FROM deposit_requests WHERE status = 'pending'),
    'deposits_approved', (SELECT COALESCE(sum(amount), 0) FROM deposit_requests WHERE status = 'approved'),
    'deposits_today', (SELECT COALESCE(sum(amount), 0) FROM deposit_requests WHERE status = 'approved' AND reviewed_at > now() - interval '1 day'),
    'wallet_total', (SELECT COALESCE(sum(balance), 0) FROM wallets),
    'banned_users', (SELECT count(*) FROM account_bans WHERE banned_until IS NULL OR banned_until > now()),
    'banned_stores', (SELECT count(*) FROM store_bans WHERE banned_until IS NULL OR banned_until > now())
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.create_deposit(integer, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_deposit(integer, text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_ban_user(uuid, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_unban_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_ban_store(uuid, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_unban_store(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, bigint, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_product_hidden(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_stores() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ban_store(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unban_store(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_product_hidden(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_stores() TO authenticated;