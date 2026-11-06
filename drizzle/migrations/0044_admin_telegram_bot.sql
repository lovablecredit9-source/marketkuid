CREATE TABLE public.admin_bot (
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
GRANT ALL ON public.admin_bot TO service_role;
ALTER TABLE public.admin_bot ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_bot_admins (
  tg_user_id bigint PRIMARY KEY,
  user_id uuid NOT NULL,
  tg_name text,
  linked_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_bot_admins TO service_role;
ALTER TABLE public.admin_bot_admins ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_bot_links (
  code text PRIMARY KEY,
  user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL
);
GRANT ALL ON public.admin_bot_links TO service_role;
ALTER TABLE public.admin_bot_links ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_bot_updates (
  update_id bigint PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_bot_updates TO service_role;
ALTER TABLE public.admin_bot_updates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_tg_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('deposit','withdraw','order_payment','dispute','category','store')),
  ref_id uuid,
  amount numeric,
  label text,
  attempts smallint NOT NULL DEFAULT 0,
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_tg_notifications_pending_idx ON public.admin_tg_notifications (created_at) WHERE sent_at IS NULL;
GRANT ALL ON public.admin_tg_notifications TO service_role;
ALTER TABLE public.admin_tg_notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.tg_admin_enqueue()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text; amt numeric; lbl text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_bot WHERE is_active) OR NOT EXISTS (SELECT 1 FROM admin_bot_admins) THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'deposit_requests' THEN k := 'deposit'; amt := NEW.amount; lbl := concat_ws(' · ', NEW.method_label, NEW.purpose);
  ELSIF TG_TABLE_NAME = 'withdrawal_requests' THEN k := 'withdraw'; amt := NEW.amount; lbl := concat_ws(' · ', NEW.bank_provider, CASE WHEN NEW.same_day THEN 'Same day' ELSE 'Reguler' END);
  ELSIF TG_TABLE_NAME = 'order_payments' THEN k := 'order_payment'; amt := NEW.amount; lbl := NEW.method_label;
  ELSIF TG_TABLE_NAME = 'order_disputes' THEN k := 'dispute'; lbl := NEW.code;
  ELSIF TG_TABLE_NAME = 'category_requests' THEN k := 'category'; lbl := NEW.name;
  ELSIF TG_TABLE_NAME = 'seller_stores' THEN k := 'store'; lbl := NEW.store_name;
  END IF;
  INSERT INTO admin_tg_notifications (kind, ref_id, amount, label)
  VALUES (k, CASE WHEN TG_TABLE_NAME = 'seller_stores' THEN NEW.owner_id ELSE NEW.id END, amt, left(lbl, 120));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tg_admin_enqueue() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER deposit_requests_admin_tg AFTER INSERT ON public.deposit_requests FOR EACH ROW EXECUTE FUNCTION public.tg_admin_enqueue();
CREATE TRIGGER withdrawal_requests_admin_tg AFTER INSERT ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.tg_admin_enqueue();
CREATE TRIGGER order_payments_admin_tg AFTER INSERT ON public.order_payments FOR EACH ROW EXECUTE FUNCTION public.tg_admin_enqueue();
CREATE TRIGGER order_disputes_admin_tg AFTER INSERT ON public.order_disputes FOR EACH ROW EXECUTE FUNCTION public.tg_admin_enqueue();
CREATE TRIGGER category_requests_admin_tg AFTER INSERT ON public.category_requests FOR EACH ROW EXECUTE FUNCTION public.tg_admin_enqueue();
CREATE TRIGGER seller_stores_admin_tg AFTER INSERT ON public.seller_stores FOR EACH ROW EXECUTE FUNCTION public.tg_admin_enqueue();