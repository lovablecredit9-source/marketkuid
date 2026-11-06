CREATE POLICY "Sellers upload own product files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Sellers read own product files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Sellers delete own product files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Buyers read delivered product files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-files' AND EXISTS (
    SELECT 1 FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
    WHERE o.buyer_id = auth.uid() AND ('file:' || storage.objects.name) = ANY (oi.delivered)));