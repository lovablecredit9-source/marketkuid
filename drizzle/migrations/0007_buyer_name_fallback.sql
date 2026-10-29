CREATE OR REPLACE FUNCTION public.default_order_buyer_name()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.buyer_name := coalesce(nullif(NEW.buyer_name, ''), 'Pembeli');
  RETURN NEW;
END $$;
CREATE TRIGGER orders_default_buyer_name BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.default_order_buyer_name();