CREATE OR REPLACE FUNCTION public.tg_admin_enqueue()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE k text; amt numeric; lbl text; rid uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_bot WHERE is_active) OR NOT EXISTS (SELECT 1 FROM admin_bot_admins) THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'deposit_requests' THEN k := 'deposit'; rid := NEW.id; amt := NEW.amount; lbl := concat_ws(' · ', NEW.method_label, NEW.purpose);
  ELSIF TG_TABLE_NAME = 'withdrawal_requests' THEN k := 'withdraw'; rid := NEW.id; amt := NEW.amount; lbl := concat_ws(' · ', NEW.bank_provider, CASE WHEN NEW.same_day THEN 'Same day' ELSE 'Reguler' END);
  ELSIF TG_TABLE_NAME = 'order_payments' THEN k := 'order_payment'; rid := NEW.id; amt := NEW.amount; lbl := NEW.method_label;
  ELSIF TG_TABLE_NAME = 'order_disputes' THEN k := 'dispute'; rid := NEW.id; lbl := NEW.code;
  ELSIF TG_TABLE_NAME = 'category_requests' THEN k := 'category'; rid := NEW.id; lbl := NEW.name;
  ELSIF TG_TABLE_NAME = 'seller_stores' THEN k := 'store'; rid := NEW.owner_id; lbl := NEW.store_name;
  ELSE RETURN NEW;
  END IF;
  BEGIN
    INSERT INTO admin_tg_notifications (kind, ref_id, amount, label) VALUES (k, rid, amt, left(lbl, 120));
  EXCEPTION WHEN others THEN NULL;
  END;
  RETURN NEW;
END $function$;