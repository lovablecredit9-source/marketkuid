ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_mode text NOT NULL DEFAULT 'normal';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS code_subtype text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS custom_fields text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.products ADD CONSTRAINT products_stock_mode_chk CHECK (stock_mode IN ('normal','unlimited','reusable'));
ALTER TABLE public.products ADD CONSTRAINT products_code_subtype_chk CHECK (code_subtype IS NULL OR code_subtype IN ('lisensi','voucher','serial'));
ALTER TABLE public.products ADD CONSTRAINT products_custom_fields_chk CHECK (cardinality(custom_fields) <= 6);
ALTER TABLE public.product_stock ADD COLUMN IF NOT EXISTS reuse_at timestamptz;

CREATE OR REPLACE FUNCTION public.stock_available(p_variant uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE p.stock_mode
    WHEN 'unlimited' THEN CASE WHEN EXISTS (SELECT 1 FROM product_stock s WHERE s.variant_id = v.id AND s.status = 'available') THEN 9999 ELSE 0 END
    WHEN 'reusable' THEN (SELECT count(*)::int FROM product_stock s WHERE s.variant_id = v.id AND (s.status = 'available' OR (s.status = 'sold' AND s.reuse_at IS NOT NULL AND s.reuse_at <= now())))
    ELSE (SELECT count(*)::int FROM product_stock s WHERE s.variant_id = v.id AND s.status = 'available') END
  FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.id = p_variant
$$;
REVOKE EXECUTE ON FUNCTION public.stock_available(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.variant_stock(p_product_ids uuid[])
 RETURNS TABLE(variant_id uuid, available integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT v.id, public.stock_available(v.id)
  FROM public.product_variants v JOIN public.products p ON p.id = v.product_id
  WHERE v.product_id = ANY(p_product_ids) AND (p.status = 'active' OR p.owner_id = auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.fulfill_paid_order(p_order uuid, p_method text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE it record; codes text[]; avail int; all_done boolean := true; mode text; vr record; first_c text;
BEGIN
  UPDATE orders SET status = 'paid', paid_at = now(), payment_method = p_method, updated_at = now() WHERE id = p_order AND status = 'pending';
  IF NOT FOUND THEN RETURN; END IF;
  FOR it IN SELECT * FROM order_items WHERE order_id = p_order LOOP
    IF it.product_type = 'preorder' OR it.variant_id IS NULL THEN all_done := false; CONTINUE; END IF;
    SELECT p.stock_mode INTO mode FROM products p JOIN product_variants v ON v.product_id = p.id WHERE v.id = it.variant_id;
    avail := public.stock_available(it.variant_id);
    IF avail < it.qty THEN all_done := false; CONTINUE; END IF;
    IF mode = 'unlimited' THEN
      SELECT content INTO first_c FROM product_stock WHERE variant_id = it.variant_id AND status = 'available' ORDER BY created_at LIMIT 1;
      codes := array_fill(first_c, ARRAY[it.qty]);
    ELSIF mode = 'reusable' THEN
      SELECT lifetime, duration_value, duration_unit INTO vr FROM product_variants WHERE id = it.variant_id;
      WITH picked AS (
        SELECT id, content FROM product_stock WHERE variant_id = it.variant_id
          AND (status = 'available' OR (status = 'sold' AND reuse_at IS NOT NULL AND reuse_at <= now()))
          ORDER BY coalesce(reuse_at, created_at) LIMIT it.qty FOR UPDATE
      ), upd AS (
        UPDATE product_stock s SET status = 'sold',
          reuse_at = CASE WHEN vr.lifetime OR vr.duration_value IS NULL THEN NULL
            ELSE now() + make_interval(days => CASE vr.duration_unit WHEN 'hari' THEN vr.duration_value ELSE 0 END,
                                       months => CASE vr.duration_unit WHEN 'bulan' THEN vr.duration_value ELSE 0 END,
                                       years => CASE vr.duration_unit WHEN 'tahun' THEN vr.duration_value ELSE 0 END) END
        FROM picked WHERE s.id = picked.id RETURNING picked.content
      ) SELECT array_agg(content) INTO codes FROM upd;
    ELSE
      WITH picked AS (
        SELECT id, content FROM product_stock WHERE variant_id = it.variant_id AND status = 'available' ORDER BY created_at LIMIT it.qty FOR UPDATE
      ), upd AS (
        UPDATE product_stock s SET status = 'sold' FROM picked WHERE s.id = picked.id RETURNING picked.content
      ) SELECT array_agg(content) INTO codes FROM upd;
    END IF;
    UPDATE order_items SET delivered = delivered || COALESCE(codes, '{}') WHERE id = it.id;
  END LOOP;
  IF all_done THEN
    UPDATE orders SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = p_order;
    UPDATE products p SET sold_count = sold_count + x.q FROM (SELECT product_id, sum(qty) q FROM order_items WHERE order_id = p_order GROUP BY product_id) x WHERE p.id = x.product_id;
    PERFORM public.credit_seller_for_order(p_order);
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.place_order(p_items jsonb, p_whatsapp text, p_note text, p_voucher text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  cid uuid := gen_random_uuid();
  it jsonb; v record; avail int; q int; v_price bigint; disc jsonb;
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