ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS hidden_for uuid[] NOT NULL DEFAULT '{}';

-- Delete a chat message: for me (hide) or for everyone (sender only, within 1 hour of sending).
CREATE OR REPLACE FUNCTION public.delete_message(p_id uuid, p_for_all boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.messages; c public.conversations;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Masuk dulu untuk menghapus pesan'; END IF;
  SELECT * INTO m FROM public.messages WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pesan tidak ditemukan'; END IF;
  SELECT * INTO c FROM public.conversations WHERE id = m.conversation_id;
  IF c.buyer_id <> auth.uid() AND c.seller_id <> auth.uid() THEN RAISE EXCEPTION 'Pesan tidak ditemukan'; END IF;
  IF p_for_all THEN
    IF m.sender_id <> auth.uid() THEN RAISE EXCEPTION 'Hanya pengirim yang bisa menghapus untuk semua orang'; END IF;
    IF m.deleted_at IS NOT NULL THEN RETURN; END IF;
    IF m.created_at < now() - interval '1 hour' THEN RAISE EXCEPTION 'Pesan lebih dari 1 jam tidak bisa dihapus untuk semua orang'; END IF;
    UPDATE public.messages SET deleted_at = now(), body = 'Pesan ini telah dihapus', attachment_path = NULL, product_id = NULL WHERE id = p_id;
    UPDATE public.conversations SET last_message = 'Pesan ini telah dihapus'
      WHERE id = m.conversation_id AND NOT EXISTS (
        SELECT 1 FROM public.messages x WHERE x.conversation_id = m.conversation_id AND x.created_at > m.created_at);
  ELSE
    UPDATE public.messages SET hidden_for = array_append(hidden_for, auth.uid())
      WHERE id = p_id AND NOT (auth.uid() = ANY(hidden_for));
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.delete_message(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_message(uuid, boolean) TO authenticated;