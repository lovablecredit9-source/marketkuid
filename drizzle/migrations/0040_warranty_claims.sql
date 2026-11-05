CREATE TABLE public.warranty_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('G-' || upper(substr(md5(gen_random_uuid()::text), 1, 8))),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  product_name text NOT NULL,
  reason text NOT NULL,
  proof_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  replacement text[] NOT NULL DEFAULT '{}',
  seller_note text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX warranty_claims_seller_idx ON public.warranty_claims(seller_id, created_at DESC);
CREATE INDEX warranty_claims_item_idx ON public.warranty_claims(order_item_id);
GRANT SELECT ON public.warranty_claims TO authenticated;
GRANT ALL ON public.warranty_claims TO service_role;
ALTER TABLE public.warranty_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read claims" ON public.warranty_claims FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_claim_item_participant(p_item text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM order_items i WHERE i.id::text = p_item AND (i.buyer_id = auth.uid() OR i.seller_id = auth.uid()));
$$;
CREATE OR REPLACE FUNCTION public.is_claim_item_buyer(p_item text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM order_items i WHERE i.id::text = p_item AND i.buyer_id = auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.is_claim_item_participant(text), public.is_claim_item_buyer(text) TO authenticated;

CREATE POLICY "Claim participants read evidence" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'warranty-evidence' AND public.is_claim_item_participant((storage.foldername(name))[1]));
CREATE POLICY "Claim buyer uploads evidence" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'warranty-evidence' AND public.is_claim_item_buyer((storage.foldername(name))[1]));

-- Warranty window end for an order item (paid_at + configured days), and claim allowance
CREATE OR REPLACE FUNCTION public.item_warranty_info(p_item uuid)
RETURNS TABLE(ends_at timestamptz, max_claims int, used int, active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.paid_at + make_interval(days => COALESCE(NULLIF(v.warranty->>'days','')::int, 30)),
         GREATEST(1, COALESCE(NULLIF(v.warranty->>'max_claims','')::int, 1)),
         (SELECT count(*)::int FROM warranty_claims c WHERE c.order_item_id = i.id AND c.status <> 'rejected'),
         o.paid_at IS NOT NULL AND o.status IN ('paid','processing','completed')
           AND now() < o.paid_at + make_interval(days => COALESCE(NULLIF(v.warranty->>'days','')::int, 30))
  FROM order_items i JOIN orders o ON o.id = i.order_id JOIN product_variants v ON v.id = i.variant_id
  WHERE i.id = p_item AND (i.buyer_id = auth.uid() OR i.seller_id = auth.uid())
    AND v.warranty IS NOT NULL AND jsonb_typeof(v.warranty) = 'object';
$$;
GRANT EXECUTE ON FUNCTION public.item_warranty_info(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.open_warranty_claim(p_item uuid, p_reason text, p_proof text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it order_items; w record; new_id uuid;
BEGIN
  SELECT * INTO it FROM order_items WHERE id = p_item AND buyer_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Pesanan tidak ditemukan'; END IF;
  IF length(btrim(coalesce(p_reason,''))) < 5 THEN RAISE EXCEPTION 'Jelaskan masalah minimal 5 karakter'; END IF;
  SELECT * INTO w FROM public.item_warranty_info(p_item);
  IF NOT FOUND THEN RAISE EXCEPTION 'Produk ini tanpa garansi'; END IF;
  IF NOT w.active THEN RAISE EXCEPTION 'Masa garansi sudah berakhir'; END IF;
  IF EXISTS (SELECT 1 FROM warranty_claims WHERE order_item_id = p_item AND status = 'pending') THEN RAISE EXCEPTION 'Klaim sebelumnya masih menunggu seller'; END IF;
  IF w.used >= w.max_claims THEN RAISE EXCEPTION 'Batas klaim garansi sudah habis'; END IF;
  IF p_proof IS NOT NULL AND split_part(p_proof, '/', 1) <> p_item::text THEN RAISE EXCEPTION 'Bukti tidak valid'; END IF;
  INSERT INTO warranty_claims(order_id, order_item_id, buyer_id, seller_id, product_name, reason, proof_path)
    VALUES (it.order_id, it.id, it.buyer_id, it.seller_id, it.product_name || ' — ' || it.variant_name, btrim(p_reason), p_proof)
    RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.seller_review_warranty_claim(p_claim uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c warranty_claims; it order_items; mode text; codes text[]; first_c text;
BEGIN
  SELECT * INTO c FROM warranty_claims WHERE id = p_claim AND seller_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Klaim tidak ditemukan'; END IF;
  IF c.status <> 'pending' THEN RAISE EXCEPTION 'Klaim sudah diproses'; END IF;
  IF NOT p_approve THEN
    IF length(btrim(coalesce(p_note,''))) < 3 THEN RAISE EXCEPTION 'Tulis alasan penolakan'; END IF;
    UPDATE warranty_claims SET status = 'rejected', seller_note = btrim(p_note), reviewed_at = now() WHERE id = p_claim;
    RETURN;
  END IF;
  SELECT * INTO it FROM order_items WHERE id = c.order_item_id;
  IF it.variant_id IS NOT NULL AND it.product_type <> 'preorder' THEN
    SELECT p.stock_mode INTO mode FROM products p JOIN product_variants v ON v.product_id = p.id WHERE v.id = it.variant_id;
    IF public.stock_available(it.variant_id) < it.qty THEN RAISE EXCEPTION 'Stok pengganti habis. Tambah stok dulu atau kirim manual lewat chat.'; END IF;
    IF mode = 'unlimited' THEN
      SELECT content INTO first_c FROM product_stock WHERE variant_id = it.variant_id AND status = 'available' ORDER BY created_at LIMIT 1;
      codes := array_fill(first_c, ARRAY[it.qty]);
    ELSE
      WITH picked AS (
        SELECT id, content FROM product_stock WHERE variant_id = it.variant_id
          AND (status = 'available' OR (mode = 'reusable' AND status = 'sold' AND reuse_at IS NOT NULL AND reuse_at <= now()))
          ORDER BY coalesce(reuse_at, created_at) LIMIT it.qty FOR UPDATE
      ), upd AS (UPDATE product_stock s SET status = 'sold' FROM picked WHERE s.id = picked.id RETURNING picked.content)
      SELECT array_agg(content) INTO codes FROM upd;
    END IF;
    UPDATE order_items SET delivered = delivered || COALESCE(codes, '{}') WHERE id = it.id;
  END IF;
  UPDATE warranty_claims SET status = 'approved', replacement = COALESCE(codes, '{}'), seller_note = NULLIF(btrim(coalesce(p_note,'')), ''), reviewed_at = now() WHERE id = p_claim;
END $$;
REVOKE ALL ON FUNCTION public.open_warranty_claim(uuid, text, text), public.seller_review_warranty_claim(uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.open_warranty_claim(uuid, text, text), public.seller_review_warranty_claim(uuid, boolean, text) TO authenticated;