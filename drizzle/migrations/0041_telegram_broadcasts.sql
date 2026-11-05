CREATE TABLE public.telegram_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  bot_id uuid NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
  image_path text,
  recipients integer NOT NULL DEFAULT 0,
  sent integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','done','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX telegram_broadcasts_owner_idx ON public.telegram_broadcasts (owner_id, created_at DESC);
GRANT SELECT ON public.telegram_broadcasts TO authenticated;
GRANT ALL ON public.telegram_broadcasts TO service_role;
ALTER TABLE public.telegram_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own broadcasts" ON public.telegram_broadcasts FOR SELECT TO authenticated USING (owner_id = auth.uid());