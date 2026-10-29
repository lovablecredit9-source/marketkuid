ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS seller_seen_at timestamptz;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS buyer_typing_at timestamptz;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS seller_typing_at timestamptz;

-- existing messages count as delivered+read so old chats don't show single ticks
UPDATE public.messages SET delivered_at = created_at, read_at = created_at WHERE delivered_at IS NULL;

-- Server decides delivery/read state; validates the attached product belongs to the conversation seller.
CREATE OR REPLACE FUNCTION public.on_message_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.conversations; seen timestamptz;
BEGIN
  SELECT * INTO c FROM public.conversations WHERE id = NEW.conversation_id;
  NEW.read_at := NULL;
  NEW.delivered_at := NULL;
  IF NEW.product_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.products p WHERE p.id = NEW.product_id AND p.owner_id = c.seller_id
  ) THEN
    NEW.product_id := NULL;
  END IF;
  IF NEW.sender_id = c.buyer_id THEN
    SELECT seller_seen_at INTO seen FROM public.profiles WHERE id = c.seller_id;
  ELSE
    SELECT last_seen_at INTO seen FROM public.profiles WHERE id = c.buyer_id;
  END IF;
  IF seen IS NOT NULL AND seen > now() - interval '2 minutes' THEN NEW.delivered_at := now(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS messages_before_insert ON public.messages;
CREATE TRIGGER messages_before_insert BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.on_message_before_insert();

-- stop the "typing" flag of the sender once a message lands
CREATE OR REPLACE FUNCTION public.on_message_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations c SET
    last_message = left(NEW.body, 200),
    last_sender_id = NEW.sender_id,
    last_at = NEW.created_at,
    buyer_unread = CASE WHEN NEW.sender_id = c.seller_id THEN c.buyer_unread + 1 ELSE c.buyer_unread END,
    seller_unread = CASE WHEN NEW.sender_id = c.buyer_id THEN c.seller_unread + 1 ELSE c.seller_unread END,
    buyer_typing_at = CASE WHEN NEW.sender_id = c.buyer_id THEN NULL ELSE c.buyer_typing_at END,
    seller_typing_at = CASE WHEN NEW.sender_id = c.seller_id THEN NULL ELSE c.seller_typing_at END,
    buyer_hidden = false, seller_hidden = false
  WHERE c.id = NEW.conversation_id;
  RETURN NEW;
END $$;

-- Presence heartbeat: buyer presence = any visit, seller presence = inside Seller Center.
CREATE OR REPLACE FUNCTION public.touch_presence(p_seller boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.profiles SET last_seen_at = now(),
    seller_seen_at = CASE WHEN p_seller THEN now() ELSE seller_seen_at END
  WHERE id = auth.uid();
  UPDATE public.messages m SET delivered_at = now()
  FROM public.conversations c
  WHERE m.conversation_id = c.id AND m.delivered_at IS NULL AND m.sender_id <> auth.uid()
    AND (c.buyer_id = auth.uid() OR (p_seller AND c.seller_id = auth.uid()));
END $$;
REVOKE ALL ON FUNCTION public.touch_presence(boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.touch_presence(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET
    buyer_unread = CASE WHEN buyer_id = auth.uid() THEN 0 ELSE buyer_unread END,
    seller_unread = CASE WHEN seller_id = auth.uid() THEN 0 ELSE seller_unread END
  WHERE id = p_id AND (buyer_id = auth.uid() OR seller_id = auth.uid());
  UPDATE public.messages m SET read_at = now(), delivered_at = coalesce(m.delivered_at, now())
  FROM public.conversations c
  WHERE m.conversation_id = p_id AND c.id = p_id AND m.read_at IS NULL AND m.sender_id <> auth.uid()
    AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.set_typing(p_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.conversations SET
    buyer_typing_at = CASE WHEN buyer_id = auth.uid() THEN now() ELSE buyer_typing_at END,
    seller_typing_at = CASE WHEN seller_id = auth.uid() THEN now() ELSE seller_typing_at END
  WHERE id = p_id AND (buyer_id = auth.uid() OR seller_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.set_typing(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.set_typing(uuid) TO authenticated;

-- Partner presence for the open chat: last seen in their role + whether they are typing now.
CREATE OR REPLACE FUNCTION public.chat_partner_state(p_id uuid)
RETURNS TABLE (seen_at timestamptz, typing boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    CASE WHEN c.buyer_id = auth.uid() THEN p.seller_seen_at ELSE p.last_seen_at END,
    coalesce(CASE WHEN c.buyer_id = auth.uid() THEN c.seller_typing_at ELSE c.buyer_typing_at END > now() - interval '6 seconds', false)
  FROM public.conversations c
  JOIN public.profiles p ON p.id = CASE WHEN c.buyer_id = auth.uid() THEN c.seller_id ELSE c.buyer_id END
  WHERE c.id = p_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.chat_partner_state(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.chat_partner_state(uuid) TO authenticated;