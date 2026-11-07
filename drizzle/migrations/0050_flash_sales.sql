CREATE TABLE public.flash_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  percent int NOT NULL CHECK (percent BETWEEN 1 AND 90),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  quota int CHECK (quota IS NULL OR quota BETWEEN 1 AND 10000),
  sold int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX flash_sales_product_idx ON public.flash_sales (product_id, ends_at);
CREATE INDEX flash_sales_owner_idx ON public.flash_sales (owner_id, created_at DESC);

GRANT SELECT ON public.flash_sales TO anon, authenticated;
GRANT ALL ON public.flash_sales TO service_role;
ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads live and upcoming flash sales" ON public.flash_sales FOR SELECT TO anon, authenticated
  USING (status = 'active' AND ends_at > now() AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.status = 'active'));
CREATE POLICY "Owners read their flash sales" ON public.flash_sales FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- Seller schedules a flash sale for one of their own active products.
CREATE OR REPLACE FUNCTION public.create_flash_sale(p_product uuid, p_percent int, p_starts timestamptz, p_hours int, p_quota int)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); v_end timestamptz; v_id uuid; n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Masuk dulu'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = p_product AND p.owner_id = uid AND p.status = 'active') THEN
    RAISE EXCEPTION 'Pilih produk aktif milik toko kamu'; END IF;
  IF p_percent IS NULL OR p_percent < 1 OR p_percent > 90 THEN RAISE EXCEPTION 'Diskon flash sale 1–90%%'; END IF;
  IF p_hours IS NULL OR p_hours < 1 OR p_hours > 72 THEN RAISE EXCEPTION 'Durasi flash sale 1–72 jam'; END IF;
  IF p_quota IS NOT NULL AND (p_quota < 1 OR p_quota > 10000) THEN RAISE EXCEPTION 'Kuota 1–10.000'; END IF;
  IF p_starts IS NULL OR p_starts < now() - interval '5 minutes' THEN p_starts := now(); END IF;
  IF p_starts > now() + interval '30 days' THEN RAISE EXCEPTION 'Jadwal mulai maksimal 30 hari ke depan'; END IF;
  v_end := p_starts + make_interval(hours => p_hours);
  IF EXISTS (SELECT 1 FROM public.flash_sales f WHERE f.product_id = p_product AND f.status = 'active'
             AND f.starts_at < v_end AND f.ends_at > p_starts) THEN
    RAISE EXCEPTION 'Produk ini sudah punya flash sale di waktu tersebut'; END IF;
  SELECT count(*) INTO n FROM public.flash_sales f WHERE f.owner_id = uid AND f.status = 'active' AND f.ends_at > now();
  IF n >= 20 THEN RAISE EXCEPTION 'Maksimal 20 flash sale aktif/terjadwal'; END IF;
  INSERT INTO public.flash_sales (owner_id, product_id, percent, starts_at, ends_at, quota)
  VALUES (uid, p_product, p_percent, p_starts, v_end, p_quota) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_flash_sale(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.flash_sales SET status = 'cancelled' WHERE id = p_id AND owner_id = auth.uid() AND status = 'active' AND ends_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Flash sale tidak ditemukan atau sudah berakhir'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.create_flash_sale(uuid, int, timestamptz, int, int) FROM public, anon;
REVOKE ALL ON FUNCTION public.cancel_flash_sale(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_flash_sale(uuid, int, timestamptz, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_flash_sale(uuid) TO authenticated;

-- Checkout applies a running flash sale (after the variant's quantity discount) and counts its quota.
CREATE OR REPLACE FUNCTION public.place_order(p_items jsonb, p_whatsapp text, p_note text, p_voucher text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  cid uuid := gen_random_uuid();
  it jsonb; v record; avail int; q int; v_price bigint; disc jsonb; fs record;
  sellers uuid[]; s uuid; v_order uuid;
  sub bigint; nqty int; vdisc bigint; vc record; used int; bname text; sname text; v_code text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Masuk dulu untuk checkout'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Keranjang kosong'; END IF;
  IF jsonb_array_length(p_items) > 50 THEN RAISE EXCEPTION 'Maksimal 50 item per checkout'; END IF;
  IF p_whatsapp IS NOT NULL AND p_whatsapp <> '' AND p_whatsapp !~ '^(\+?62|0)8[0-9]{7,12}$' THEN RAISE EXCEPTION 'Nomor WhatsApp tidak valid'; END IF;
  IF length(coalesce(p_note, '')) > 500 THEN RAISE EXCEPTION 'Catatan maksimal 500 karakter'; END IF;
  v_code := nullif(upper(regexp_replace(coalesce(p_voucher, ''), '[^A-Za-z0-9]', '', 'g')), '');
  SELECT coalesce(nullif(username,''), nullif(full_name,''), 'Pembeli') INTO bname FROM public.profiles WHERE id = uid;

  DROP TABLE IF EXISTS _lines;
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
      avail := public.stock_available(v.id);
      IF avail < q THEN RAISE EXCEPTION 'Stok % tidak cukup (tersisa %)', v.vname, avail; END IF;
    END IF;
    v_price := v.price;
    disc := v.discount;
    IF disc IS NOT NULL AND coalesce((disc->>'percent')::numeric, 0) > 0 AND q >= coalesce((disc->>'min_order')::int, 1) THEN
      v_price := v_price - floor(v_price * least((disc->>'percent')::numeric, 100) / 100);
    END IF;
    fs := NULL;
    SELECT f.id, f.percent INTO fs FROM public.flash_sales f
      WHERE f.product_id = v.pid AND f.status = 'active' AND f.starts_at <= now() AND f.ends_at > now()
        AND (f.quota IS NULL OR f.sold + q <= f.quota)
      ORDER BY f.percent DESC LIMIT 1 FOR UPDATE;
    IF fs.id IS NOT NULL THEN
      v_price := v_price - floor(v_price * fs.percent / 100);
      UPDATE public.flash_sales SET sold = sold + q WHERE id = fs.id;
    END IF;
    INSERT INTO _lines VALUES (v.owner_id, v.pid, v.id, v.pname, v.vname, v.product_type, coalesce(v.image_url, v.images[1]), v_price, q, v_price * q, v.require_buyer_note);
  END LOOP;

  IF EXISTS (SELECT 1 FROM _lines l WHERE l.note_req) AND length(btrim(coalesce(p_note, ''))) < 3 THEN
    RAISE EXCEPTION 'Catatan untuk seller wajib diisi';
  END IF;

  SELECT array_agg(DISTINCT l.seller) INTO sellers FROM _lines l;
  FOREACH s IN ARRAY sellers LOOP
    SELECT sum(l.line), sum(l.qty) INTO sub, nqty FROM _lines l WHERE l.seller = s;
    vdisc := 0;
    IF v_code IS NOT NULL THEN
      SELECT * INTO vc FROM public.seller_vouchers sv WHERE sv.owner_id = s AND sv.code = v_code AND sv.is_active
        AND (sv.starts_at IS NULL OR sv.starts_at <= now()) AND (sv.ends_at IS NULL OR sv.ends_at > now());
      IF vc.id IS NOT NULL AND sub >= coalesce(vc.min_spend, 0) AND nqty >= coalesce(vc.min_qty, 1)
         AND (vc.usage_limit IS NULL OR vc.used_count < vc.usage_limit) AND vc.kind <> 'bonus' THEN
        SELECT count(*) INTO used FROM public.orders o WHERE o.buyer_id = uid AND o.seller_id = s AND o.voucher_code = v_code AND o.status NOT IN ('cancelled','failed');
        IF vc.per_user_limit IS NULL OR used < vc.per_user_limit THEN
          vdisc := CASE WHEN vc.value_type = 'percent' THEN floor(sub * vc.value / 100) ELSE vc.value END;
          IF vc.max_discount IS NOT NULL THEN vdisc := least(vdisc, vc.max_discount::bigint); END IF;
          vdisc := least(vdisc, sub);
          UPDATE public.seller_vouchers SET used_count = used_count + 1 WHERE id = vc.id;
        END IF;
      END IF;
    END IF;
    SELECT ss.store_name INTO sname FROM public.seller_stores ss WHERE ss.owner_id = s;
    INSERT INTO public.orders (checkout_id, buyer_id, seller_id, buyer_name, store_name, subtotal, discount, unique_code, total, voucher_code, buyer_whatsapp, buyer_note, expires_at)
    VALUES (cid, uid, s, bname, sname, sub, vdisc, 0, sub - vdisc, CASE WHEN vdisc > 0 THEN v_code END, nullif(p_whatsapp, ''), nullif(btrim(coalesce(p_note, '')), ''), now() + interval '1 hour')
    RETURNING id INTO v_order;
    INSERT INTO public.order_items (order_id, buyer_id, seller_id, product_id, variant_id, product_name, variant_name, product_type, image_path, unit_price, qty, line_total)
      SELECT v_order, uid, s, l.product, l.variant, l.pname, l.vname, l.ptype, l.img, l.price, l.qty, l.line FROM _lines l WHERE l.seller = s;
  END LOOP;

  UPDATE public.orders o SET unique_code = 1 + floor(random() * 99)::int
    WHERE o.id = (SELECT o2.id FROM public.orders o2 WHERE o2.checkout_id = cid ORDER BY o2.created_at, o2.id LIMIT 1);
  UPDATE public.orders o SET total = o.subtotal - o.discount + o.unique_code WHERE o.checkout_id = cid;

  DELETE FROM public.cart_items c WHERE c.user_id = uid AND c.variant_id IN (SELECT l.variant FROM _lines l);
  RETURN cid;
END $function$;