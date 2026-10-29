
-- ===== Cart =====
CREATE TABLE public.cart_items (
  user_id uuid NOT NULL,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  qty integer NOT NULL DEFAULT 1 CHECK (qty BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, variant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cart" ON public.cart_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ===== Orders =====
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no bigint GENERATED ALWAYS AS IDENTITY (START WITH 120001),
  checkout_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  buyer_name text,
  store_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','processing','completed','cancelled','refunded','failed')),
  subtotal bigint NOT NULL DEFAULT 0,
  discount bigint NOT NULL DEFAULT 0,
  admin_fee bigint NOT NULL DEFAULT 0,
  unique_code integer NOT NULL DEFAULT 0,
  total bigint NOT NULL DEFAULT 0,
  voucher_code text,
  buyer_whatsapp text,
  buyer_note text,
  expires_at timestamptz,
  paid_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_buyer_idx ON public.orders (buyer_id, created_at DESC);
CREATE INDEX orders_seller_idx ON public.orders (seller_id, created_at DESC);
CREATE INDEX orders_checkout_idx ON public.orders (checkout_id);
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyers read own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = buyer_id);
CREATE POLICY "Sellers read own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = seller_id);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  variant_name text NOT NULL,
  product_type text,
  image_path text,
  unit_price bigint NOT NULL,
  qty integer NOT NULL CHECK (qty > 0),
  line_total bigint NOT NULL,
  delivered text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx ON public.order_items (order_id);
GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyers read own order items" ON public.order_items FOR SELECT TO authenticated USING (auth.uid() = buyer_id);
CREATE POLICY "Sellers read own order items" ON public.order_items FOR SELECT TO authenticated USING (auth.uid() = seller_id);

-- ===== Reviews =====
CREATE TABLE public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL UNIQUE REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  buyer_label text NOT NULL DEFAULT 'Pembeli',
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR length(comment) <= 1000),
  topic text CHECK (topic IS NULL OR topic IN ('Kualitas Barang','Kemasan','Sesuai Deskripsi','Pengiriman','Pelayanan Seller')),
  helpful_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_reviews_product_idx ON public.product_reviews (product_id, created_at DESC);
CREATE INDEX product_reviews_seller_idx ON public.product_reviews (seller_id, created_at DESC);
GRANT SELECT ON public.product_reviews TO anon, authenticated;
GRANT INSERT ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads reviews" ON public.product_reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Buyers review completed items" ON public.product_reviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = buyer_id AND EXISTS (
      SELECT 1 FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_id AND oi.buyer_id = auth.uid() AND o.status = 'completed'
        AND oi.product_id = product_reviews.product_id AND oi.seller_id = product_reviews.seller_id
    )
  );

CREATE OR REPLACE FUNCTION public.set_review_label()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n text;
BEGIN
  SELECT coalesce(nullif(username, ''), nullif(full_name, ''), 'Pembeli') INTO n FROM public.profiles WHERE id = NEW.buyer_id;
  n := coalesce(n, 'Pembeli');
  NEW.buyer_label := CASE WHEN length(n) <= 2 THEN left(n, 1) || '***'
                          ELSE left(n, 1) || '***' || right(n, 1) END;
  NEW.helpful_count := 0;
  RETURN NEW;
END $$;
CREATE TRIGGER product_reviews_label BEFORE INSERT ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_review_label();

-- ===== Store follows =====
CREATE TABLE public.store_follows (
  user_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, seller_id)
);
GRANT SELECT, INSERT, DELETE ON public.store_follows TO authenticated;
GRANT ALL ON public.store_follows TO service_role;
ALTER TABLE public.store_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own follows" ON public.store_follows FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ===== Chat =====
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  buyer_name text,
  store_name text,
  last_message text,
  last_at timestamptz NOT NULL DEFAULT now(),
  buyer_unread integer NOT NULL DEFAULT 0,
  seller_unread integer NOT NULL DEFAULT 0,
  buyer_hidden boolean NOT NULL DEFAULT false,
  seller_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, seller_id),
  CHECK (buyer_id <> seller_id)
);
GRANT SELECT ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read conversations" ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conv_idx ON public.messages (conversation_id, created_at);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read messages" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())));
CREATE POLICY "Participants send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())));

CREATE OR REPLACE FUNCTION public.on_message_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations c SET
    last_message = left(NEW.body, 200),
    last_at = NEW.created_at,
    buyer_unread = CASE WHEN NEW.sender_id = c.seller_id THEN c.buyer_unread + 1 ELSE c.buyer_unread END,
    seller_unread = CASE WHEN NEW.sender_id = c.buyer_id THEN c.seller_unread + 1 ELSE c.seller_unread END,
    buyer_hidden = false, seller_hidden = false
  WHERE c.id = NEW.conversation_id;
  RETURN NEW;
END $$;
CREATE TRIGGER messages_after_insert AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.on_message_insert();

CREATE OR REPLACE FUNCTION public.start_conversation(p_seller uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; bname text; sname text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Masuk dulu untuk chat'; END IF;
  IF auth.uid() = p_seller THEN RAISE EXCEPTION 'Tidak bisa chat dengan toko sendiri'; END IF;
  SELECT store_name INTO sname FROM public.seller_stores WHERE owner_id = p_seller;
  IF sname IS NULL THEN RAISE EXCEPTION 'Toko tidak ditemukan'; END IF;
  SELECT id INTO cid FROM public.conversations WHERE buyer_id = auth.uid() AND seller_id = p_seller;
  IF cid IS NOT NULL THEN RETURN cid; END IF;
  SELECT coalesce(nullif(username,''), nullif(full_name,''), 'Pembeli') INTO bname FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.conversations (buyer_id, seller_id, buyer_name, store_name)
  VALUES (auth.uid(), p_seller, coalesce(bname, 'Pembeli'), sname) RETURNING id INTO cid;
  RETURN cid;
END $$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.conversations SET
    buyer_unread = CASE WHEN buyer_id = auth.uid() THEN 0 ELSE buyer_unread END,
    seller_unread = CASE WHEN seller_id = auth.uid() THEN 0 ELSE seller_unread END
  WHERE id = p_id AND (buyer_id = auth.uid() OR seller_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.hide_conversations(p_ids uuid[])
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.conversations SET
    buyer_hidden = CASE WHEN buyer_id = auth.uid() THEN true ELSE buyer_hidden END,
    seller_hidden = CASE WHEN seller_id = auth.uid() THEN true ELSE seller_hidden END,
    buyer_unread = CASE WHEN buyer_id = auth.uid() THEN 0 ELSE buyer_unread END,
    seller_unread = CASE WHEN seller_id = auth.uid() THEN 0 ELSE seller_unread END
  WHERE id = ANY(p_ids) AND (buyer_id = auth.uid() OR seller_id = auth.uid());
$$;

-- ===== Ads =====
CREATE TABLE public.ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 3 AND 60),
  placement text NOT NULL DEFAULT 'beranda' CHECK (placement IN ('beranda','pencarian','semua')),
  daily_budget bigint NOT NULL CHECK (daily_budget >= 5000),
  status text NOT NULL DEFAULT 'menunggu_saldo' CHECK (status IN ('menunggu_saldo','aktif','dijeda','selesai')),
  starts_at date,
  ends_at date,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  spend bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_campaigns TO authenticated;
GRANT ALL ON public.ad_campaigns TO service_role;
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own campaigns" ON public.ad_campaigns FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.owner_id = auth.uid()));

-- Sellers may only create/keep campaigns waiting for balance or paused; activation needs ad balance.
CREATE OR REPLACE FUNCTION public.guard_ad_campaign()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'aktif' AND (TG_OP = 'INSERT' OR OLD.status <> 'aktif') THEN
    RAISE EXCEPTION 'Saldo iklan belum cukup untuk mengaktifkan campaign';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.impressions := OLD.impressions; NEW.clicks := OLD.clicks; NEW.spend := OLD.spend;
  ELSE
    NEW.impressions := 0; NEW.clicks := 0; NEW.spend := 0;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ad_campaigns_guard BEFORE INSERT OR UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.guard_ad_campaign();

-- ===== Public read helpers =====
CREATE OR REPLACE FUNCTION public.public_stores(p_ids uuid[])
RETURNS TABLE (owner_id uuid, store_name text, slug text, description text, is_open boolean, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.owner_id, s.store_name, s.slug, s.description, s.is_open, s.created_at
  FROM public.seller_stores s WHERE s.owner_id = ANY(p_ids);
$$;

CREATE OR REPLACE FUNCTION public.store_by_slug(p_slug text)
RETURNS TABLE (owner_id uuid, store_name text, slug text, description text, is_open boolean, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.owner_id, s.store_name, s.slug, s.description, s.is_open, s.created_at
  FROM public.seller_stores s WHERE s.slug = p_slug OR s.owner_id::text = p_slug LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.variant_stock(p_product_ids uuid[])
RETURNS TABLE (variant_id uuid, available integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.id, (SELECT count(*)::int FROM public.product_stock s WHERE s.variant_id = v.id AND s.status = 'available')
  FROM public.product_variants v JOIN public.products p ON p.id = v.product_id
  WHERE v.product_id = ANY(p_product_ids) AND (p.status = 'active' OR p.owner_id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.public_stores(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.variant_stock(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hide_conversations(uuid[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.start_conversation(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.hide_conversations(uuid[]) FROM anon;

-- ===== Checkout =====
CREATE OR REPLACE FUNCTION public.place_order(p_items jsonb, p_whatsapp text, p_note text, p_voucher text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  cid uuid := gen_random_uuid();
  it jsonb; v record; avail int; q int; price bigint; disc jsonb;
  sellers uuid[]; s uuid; oid uuid;
  sub bigint; nqty int; vdisc bigint; vc record; used int; bname text; sname text; code text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Masuk dulu untuk checkout'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Keranjang kosong'; END IF;
  IF jsonb_array_length(p_items) > 50 THEN RAISE EXCEPTION 'Maksimal 50 item per checkout'; END IF;
  IF p_whatsapp IS NOT NULL AND p_whatsapp <> '' AND p_whatsapp !~ '^(\+?62|0)8[0-9]{7,12}$' THEN RAISE EXCEPTION 'Nomor WhatsApp tidak valid'; END IF;
  IF length(coalesce(p_note, '')) > 500 THEN RAISE EXCEPTION 'Catatan maksimal 500 karakter'; END IF;
  code := nullif(upper(regexp_replace(coalesce(p_voucher, ''), '[^A-Za-z0-9]', '', 'g')), '');
  SELECT coalesce(nullif(username,''), nullif(full_name,''), 'Pembeli') INTO bname FROM public.profiles WHERE id = uid;

  CREATE TEMP TABLE _lines (seller uuid, product uuid, variant uuid, pname text, vname text, ptype text, img text, price bigint, qty int, line bigint, note_req boolean) ON COMMIT DROP;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    q := coalesce((it->>'qty')::int, 0);
    IF q < 1 OR q > 1000 THEN RAISE EXCEPTION 'Jumlah tidak valid'; END IF;
    SELECT pv.id, pv.name AS vname, pv.price, pv.discount, pv.preorder_quota, pv.image_url, p.id AS pid, p.name AS pname, p.owner_id, p.product_type, p.images, p.status, p.require_buyer_note
      INTO v FROM public.product_variants pv JOIN public.products p ON p.id = pv.product_id
      WHERE pv.id = (it->>'variant_id')::uuid;
    IF v.id IS NULL OR v.status <> 'active' THEN RAISE EXCEPTION 'Produk tidak tersedia'; END IF;
    IF v.owner_id = uid THEN RAISE EXCEPTION 'Tidak bisa membeli produk toko sendiri'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.seller_stores ss WHERE ss.owner_id = v.owner_id AND ss.is_open) THEN RAISE EXCEPTION 'Toko % sedang tutup', v.pname; END IF;
    IF v.product_type = 'preorder' THEN
      IF v.preorder_quota IS NOT NULL AND v.preorder_quota > 0 AND q > v.preorder_quota THEN RAISE EXCEPTION 'Kuota pre-order % tidak cukup', v.vname; END IF;
    ELSE
      SELECT count(*) INTO avail FROM public.product_stock st WHERE st.variant_id = v.id AND st.status = 'available';
      IF avail < q THEN RAISE EXCEPTION 'Stok % tidak cukup (tersisa %)', v.vname, avail; END IF;
    END IF;
    price := v.price;
    disc := v.discount;
    IF disc IS NOT NULL AND coalesce((disc->>'percent')::numeric, 0) > 0 AND q >= coalesce((disc->>'min_order')::int, 1) THEN
      price := price - floor(price * least((disc->>'percent')::numeric, 100) / 100);
    END IF;
    INSERT INTO _lines VALUES (v.owner_id, v.pid, v.id, v.pname, v.vname, v.product_type, coalesce(v.image_url, v.images[1]), price, q, price * q, v.require_buyer_note);
  END LOOP;

  IF EXISTS (SELECT 1 FROM _lines WHERE note_req) AND length(btrim(coalesce(p_note, ''))) < 3 THEN
    RAISE EXCEPTION 'Catatan untuk seller wajib diisi';
  END IF;

  SELECT array_agg(DISTINCT seller) INTO sellers FROM _lines;
  FOREACH s IN ARRAY sellers LOOP
    SELECT sum(line), sum(qty) INTO sub, nqty FROM _lines WHERE seller = s;
    vdisc := 0;
    IF code IS NOT NULL THEN
      SELECT * INTO vc FROM public.seller_vouchers sv WHERE sv.owner_id = s AND sv.code = code AND sv.is_active
        AND (sv.starts_at IS NULL OR sv.starts_at <= now()) AND (sv.ends_at IS NULL OR sv.ends_at > now());
      IF vc.id IS NOT NULL AND sub >= coalesce(vc.min_spend, 0) AND nqty >= coalesce(vc.min_qty, 1)
         AND (vc.usage_limit IS NULL OR vc.used_count < vc.usage_limit) AND vc.kind <> 'bonus' THEN
        SELECT count(*) INTO used FROM public.orders o WHERE o.buyer_id = uid AND o.seller_id = s AND o.voucher_code = code AND o.status NOT IN ('cancelled','failed');
        IF vc.per_user_limit IS NULL OR used < vc.per_user_limit THEN
          vdisc := CASE WHEN vc.value_type = 'percent' THEN floor(sub * vc.value / 100) ELSE vc.value END;
          IF vc.max_discount IS NOT NULL THEN vdisc := least(vdisc, vc.max_discount::bigint); END IF;
          vdisc := least(vdisc, sub);
          UPDATE public.seller_vouchers SET used_count = used_count + 1 WHERE id = vc.id;
        END IF;
      END IF;
    END IF;
    SELECT store_name INTO sname FROM public.seller_stores WHERE owner_id = s;
    INSERT INTO public.orders (checkout_id, buyer_id, seller_id, buyer_name, store_name, subtotal, discount, unique_code, total, voucher_code, buyer_whatsapp, buyer_note, expires_at)
    VALUES (cid, uid, s, bname, sname, sub, vdisc, 0, sub - vdisc, CASE WHEN vdisc > 0 THEN code END, nullif(p_whatsapp, ''), nullif(btrim(coalesce(p_note, '')), ''), now() + interval '1 hour')
    RETURNING id INTO oid;
    INSERT INTO public.order_items (order_id, buyer_id, seller_id, product_id, variant_id, product_name, variant_name, product_type, image_path, unit_price, qty, line_total)
      SELECT oid, uid, s, product, variant, pname, vname, ptype, img, price, qty, line FROM _lines WHERE seller = s;
  END LOOP;

  -- one QRIS unique code (1-99) for the whole checkout, put on the first order
  UPDATE public.orders SET unique_code = 1 + floor(random() * 99)::int, total = total + 0
    WHERE id = (SELECT id FROM public.orders WHERE checkout_id = cid ORDER BY created_at, id LIMIT 1);
  UPDATE public.orders SET total = subtotal - discount + unique_code WHERE checkout_id = cid;

  DELETE FROM public.cart_items c WHERE c.user_id = uid AND c.variant_id IN (SELECT variant FROM _lines);
  RETURN cid;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_order(p_order uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order AND buyer_id = auth.uid();
  IF o.id IS NULL THEN RAISE EXCEPTION 'Pesanan tidak ditemukan'; END IF;
  IF o.status <> 'pending' THEN RAISE EXCEPTION 'Hanya pesanan yang belum dibayar yang bisa dibatalkan'; END IF;
  UPDATE public.orders SET status = 'cancelled', updated_at = now() WHERE id = p_order;
  IF o.voucher_code IS NOT NULL THEN
    UPDATE public.seller_vouchers SET used_count = greatest(used_count - 1, 0) WHERE owner_id = o.seller_id AND code = o.voucher_code;
  END IF;
END $$;

-- Seller moves a paid pre-order forward (paid -> processing -> completed).
CREATE OR REPLACE FUNCTION public.seller_advance_order(p_order uuid, p_status text, p_delivery text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order AND seller_id = auth.uid();
  IF o.id IS NULL THEN RAISE EXCEPTION 'Pesanan tidak ditemukan'; END IF;
  IF NOT ((o.status = 'paid' AND p_status IN ('processing','completed')) OR (o.status = 'processing' AND p_status = 'completed')) THEN
    RAISE EXCEPTION 'Status pesanan tidak bisa diubah';
  END IF;
  IF p_status = 'completed' AND p_delivery IS NOT NULL AND btrim(p_delivery) <> '' THEN
    UPDATE public.order_items SET delivered = delivered || ARRAY[left(p_delivery, 4000)] WHERE order_id = p_order;
  END IF;
  UPDATE public.orders SET status = p_status, updated_at = now(), completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE completed_at END WHERE id = p_order;
  IF p_status = 'completed' THEN
    UPDATE public.products p SET sold_count = sold_count + x.q FROM (SELECT product_id, sum(qty) q FROM public.order_items WHERE order_id = p_order GROUP BY product_id) x WHERE p.id = x.product_id;
  END IF;
END $$;

-- Seller's unique customers derived from their orders.
CREATE OR REPLACE FUNCTION public.seller_customers()
RETURNS TABLE (buyer_id uuid, buyer_name text, orders integer, completed integer, spent bigint, last_order timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.buyer_id, max(o.buyer_name), count(*)::int, count(*) FILTER (WHERE o.status = 'completed')::int,
         coalesce(sum(o.total) FILTER (WHERE o.status = 'completed'), 0)::bigint, max(o.created_at)
  FROM public.orders o WHERE o.seller_id = auth.uid()
  GROUP BY o.buyer_id ORDER BY max(o.created_at) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seller_advance_order(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seller_customers() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_order(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.seller_advance_order(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.seller_customers() FROM anon;
