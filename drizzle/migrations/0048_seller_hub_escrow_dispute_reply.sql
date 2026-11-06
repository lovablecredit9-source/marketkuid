ALTER TABLE public.seller_hub_notifications DROP CONSTRAINT seller_hub_notifications_kind_check;
ALTER TABLE public.seller_hub_notifications ADD CONSTRAINT seller_hub_notifications_kind_check CHECK (kind = ANY (ARRAY['order_new','order_paid','order_completed','order_cancelled','order_expired','order_released','dispute_open','dispute_done','chat','deposit']));
ALTER TABLE public.seller_hub_notifications ADD COLUMN IF NOT EXISTS tg_message_id bigint, ADD COLUMN IF NOT EXISTS tg_chat_id bigint;
CREATE INDEX IF NOT EXISTS seller_hub_notifications_tgmsg_idx ON public.seller_hub_notifications (tg_chat_id, tg_message_id) WHERE tg_message_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.seller_hub_ledger_trg() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.kind = 'sale' AND NEW.ref_id IS NOT NULL THEN
    BEGIN PERFORM enqueue_seller_hub(NEW.user_id, 'order_released', NEW.ref_id, NULL);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS wallet_ledger_seller_hub ON public.wallet_ledger;
CREATE TRIGGER wallet_ledger_seller_hub AFTER INSERT ON public.wallet_ledger FOR EACH ROW EXECUTE FUNCTION public.seller_hub_ledger_trg();

CREATE OR REPLACE FUNCTION public.seller_hub_dispute_trg() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN PERFORM enqueue_seller_hub(NEW.seller_id, 'dispute_open', NEW.order_id, NEW.id);
    ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('dilepas','refund','ditutup') THEN
      PERFORM enqueue_seller_hub(NEW.seller_id, 'dispute_done', NEW.order_id, NEW.id);
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS order_disputes_seller_hub ON public.order_disputes;
CREATE TRIGGER order_disputes_seller_hub AFTER INSERT OR UPDATE ON public.order_disputes FOR EACH ROW EXECUTE FUNCTION public.seller_hub_dispute_trg();