ALTER TABLE public.telegram_bots
  ADD COLUMN IF NOT EXISTS owner_tg_id bigint,
  ADD COLUMN IF NOT EXISTS owner_tg_name text,
  ADD COLUMN IF NOT EXISTS owner_linked_at timestamptz,
  ADD COLUMN IF NOT EXISTS owner_link_code text,
  ADD COLUMN IF NOT EXISTS owner_link_expires timestamptz;
GRANT SELECT (owner_tg_id, owner_tg_name, owner_linked_at) ON public.telegram_bots TO authenticated;

CREATE TABLE public.telegram_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  chat_id bigint NOT NULL,
  kind text NOT NULL CHECK (kind IN ('order_new','order_paid','order_completed','order_cancelled','order_refunded','dispute_new')),
  order_id uuid,
  dispute_id uuid,
  attempts smallint NOT NULL DEFAULT 0,
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX telegram_notifications_pending_idx ON public.telegram_notifications (created_at) WHERE sent_at IS NULL;
GRANT ALL ON public.telegram_notifications TO service_role;
ALTER TABLE public.telegram_notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enqueue_seller_tg(p_seller uuid, p_kind text, p_order uuid, p_dispute uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO telegram_notifications (bot_id, chat_id, kind, order_id, dispute_id)
  SELECT b.id, b.owner_tg_id, p_kind, p_order, p_dispute
  FROM telegram_bots b
  WHERE b.owner_id = p_seller AND b.is_active AND b.owner_tg_id IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.enqueue_seller_tg(uuid, text, uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_orders_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    k := CASE WHEN NEW.status = 'pending' THEN 'order_new' WHEN NEW.status IN ('paid','processing') THEN 'order_paid' END;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    k := CASE
      WHEN NEW.status IN ('paid','processing') AND OLD.status = 'pending' THEN 'order_paid'
      WHEN NEW.status = 'completed' AND OLD.status IN ('pending') THEN 'order_paid'
      WHEN NEW.status = 'completed' THEN 'order_completed'
      WHEN NEW.status IN ('cancelled','failed') THEN 'order_cancelled'
      WHEN NEW.status = 'refunded' THEN 'order_refunded'
    END;
  END IF;
  IF k IS NOT NULL THEN PERFORM enqueue_seller_tg(NEW.seller_id, k, NEW.id, NULL); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS orders_tg_notify ON public.orders;
CREATE TRIGGER orders_tg_notify AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_orders_notify();

CREATE OR REPLACE FUNCTION public.tg_disputes_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM enqueue_seller_tg(NEW.seller_id, 'dispute_new', NEW.order_id, NEW.id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS order_disputes_tg_notify ON public.order_disputes;
CREATE TRIGGER order_disputes_tg_notify AFTER INSERT ON public.order_disputes
  FOR EACH ROW EXECUTE FUNCTION public.tg_disputes_notify();