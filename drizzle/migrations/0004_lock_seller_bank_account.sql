CREATE OR REPLACE FUNCTION public.lock_seller_bank_account()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.bank_number IS NOT NULL AND (
    NEW.bank_type IS DISTINCT FROM OLD.bank_type OR
    NEW.bank_provider IS DISTINCT FROM OLD.bank_provider OR
    NEW.bank_number IS DISTINCT FROM OLD.bank_number OR
    NEW.bank_holder IS DISTINCT FROM OLD.bank_holder
  ) AND current_user = 'authenticated' THEN
    RAISE EXCEPTION 'Rekening sudah tersimpan dan hanya bisa diubah melalui admin';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS seller_stores_lock_bank ON public.seller_stores;
CREATE TRIGGER seller_stores_lock_bank BEFORE UPDATE ON public.seller_stores
  FOR EACH ROW EXECUTE FUNCTION public.lock_seller_bank_account();