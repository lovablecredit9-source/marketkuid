CREATE TABLE public.seller_hub_bot (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tg_bot_id bigint NOT NULL,
  username text NOT NULL,
  name text NOT NULL,
  token text NOT NULL,
  webhook_secret text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  webhook_ok boolean NOT NULL DEFAULT false,
  webhook_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.seller_hub_bot TO service_role;
ALTER TABLE public.seller_hub_bot ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.seller_hub_links (
  owner_id uuid PRIMARY KEY,
  tg_user_id bigint NOT NULL UNIQUE,
  tg_name text,
  linked_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.seller_hub_links TO service_role;
GRANT SELECT ON public.seller_hub_links TO authenticated;
ALTER TABLE public.seller_hub_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seller reads own hub link" ON public.seller_hub_links FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE TABLE public.seller_hub_link_codes (
  code text PRIMARY KEY,
  owner_id uuid NOT NULL,
  expires_at timestamptz NOT NULL
);
GRANT ALL ON public.seller_hub_link_codes TO service_role;
ALTER TABLE public.seller_hub_link_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.seller_hub_updates (
  update_id bigint PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.seller_hub_updates TO service_role;
ALTER TABLE public.seller_hub_updates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.seller_hub_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('order_new','order_paid','order_completed','order_cancelled','order_expired','chat','deposit')),
  order_id uuid,
  ref_id uuid,
  attempts smallint NOT NULL DEFAULT 0,
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX seller_hub_notifications_pending_idx ON public.seller_hub_notifications (created_at) WHERE sent_at IS NULL;
CREATE UNIQUE INDEX seller_hub_notifications_order_kind_uq ON public.seller_hub_notifications (order_id, kind) WHERE order_id IS NOT NULL;
GRANT ALL ON public.seller_hub_notifications TO service_role;
ALTER TABLE public.seller_hub_notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enqueue_seller_hub(p_owner uuid, p_kind text, p_order uuid, p_ref uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_owner IS NULL OR NOT EXISTS (SELECT 1 FROM seller_hub_bot WHERE is_active)
     OR NOT EXISTS (SELECT 1 FROM seller_hub_links WHERE owner_id = p_owner) THEN RETURN; END IF;
  INSERT INTO seller_hub_notifications (owner_id, kind, order_id, ref_id)
  VALUES (p_owner, p_kind, p_order, p_ref) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_seller_hub(uuid, text, uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.seller_hub_orders_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    k := CASE WHEN NEW.status = 'pending' THEN 'order_new' WHEN NEW.status IN ('paid','processing','completed') THEN 'order_paid' END;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    k := CASE
      WHEN NEW.status IN ('paid','processing') AND OLD.status = 'pending' THEN 'order_paid'
      WHEN NEW.status = 'completed' AND OLD.status = 'pending' THEN 'order_paid'
      WHEN NEW.status = 'completed' THEN 'order_completed'
      WHEN NEW.status IN ('cancelled','failed') THEN 'order_cancelled'
    END;
  END IF;
  IF k IS NOT NULL THEN PERFORM enqueue_seller_hub(NEW.seller_id, k, NEW.id, NULL); END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.seller_hub_orders_trg() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER orders_seller_hub AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.seller_hub_orders_trg();

CREATE OR REPLACE FUNCTION public.seller_hub_messages_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s uuid;
BEGIN
  SELECT seller_id INTO s FROM conversations WHERE id = NEW.conversation_id;
  IF s IS NOT NULL AND NEW.sender_id <> s THEN PERFORM enqueue_seller_hub(s, 'chat', NULL, NEW.id); END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.seller_hub_messages_trg() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER messages_seller_hub AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.seller_hub_messages_trg();

CREATE OR REPLACE FUNCTION public.seller_hub_deposits_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM enqueue_seller_hub(NEW.user_id, 'deposit', NULL, NEW.id);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.seller_hub_deposits_trg() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER deposit_requests_seller_hub AFTER INSERT OR UPDATE OF status ON public.deposit_requests
  FOR EACH ROW EXECUTE FUNCTION public.seller_hub_deposits_trg();