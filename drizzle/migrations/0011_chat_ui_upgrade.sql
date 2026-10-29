ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_sender_id uuid;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_path text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

UPDATE public.conversations c SET last_sender_id = m.sender_id
FROM (SELECT DISTINCT ON (conversation_id) conversation_id, sender_id FROM public.messages ORDER BY conversation_id, created_at DESC) m
WHERE m.conversation_id = c.id AND c.last_sender_id IS NULL;

CREATE OR REPLACE FUNCTION public.on_message_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations c SET
    last_message = left(NEW.body, 200),
    last_sender_id = NEW.sender_id,
    last_at = NEW.created_at,
    buyer_unread = CASE WHEN NEW.sender_id = c.seller_id THEN c.buyer_unread + 1 ELSE c.buyer_unread END,
    seller_unread = CASE WHEN NEW.sender_id = c.buyer_id THEN c.seller_unread + 1 ELSE c.seller_unread END,
    buyer_hidden = false, seller_hidden = false
  WHERE c.id = NEW.conversation_id;
  RETURN NEW;
END $$;

-- attachment path must live under the conversation folder
ALTER TABLE public.messages ADD CONSTRAINT messages_attachment_path_fmt
  CHECK (attachment_path IS NULL OR (split_part(attachment_path, '/', 1) = conversation_id::text AND char_length(attachment_path) <= 200));

CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET last_seen_at = now() WHERE id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.touch_last_seen() FROM public;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;

CREATE OR REPLACE FUNCTION public.conversation_partner_seen(p_id uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.last_seen_at FROM public.conversations c
  JOIN public.profiles p ON p.id = CASE WHEN c.buyer_id = auth.uid() THEN c.seller_id ELSE c.buyer_id END
  WHERE c.id = p_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.conversation_partner_seen(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.conversation_partner_seen(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id::text = p_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.is_conversation_participant(text) FROM public;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(text) TO authenticated;

CREATE POLICY "Chat participants upload attachments" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND public.is_conversation_participant((storage.foldername(name))[1]));
CREATE POLICY "Chat participants view attachments" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments' AND public.is_conversation_participant((storage.foldername(name))[1]));