CREATE TABLE public.seller_login_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  via text NOT NULL DEFAULT 'password',
  device_model text,
  device_vendor text,
  os_name text,
  os_version text,
  browser text,
  is_mobile boolean NOT NULL DEFAULT false,
  is_real_device boolean NOT NULL DEFAULT false,
  automation boolean NOT NULL DEFAULT false,
  battery_level smallint,
  battery_charging boolean,
  network_type text,
  network_effective text,
  network_downlink numeric,
  ip text,
  city text,
  region text,
  country text,
  isp text,
  carrier text,
  timezone text,
  screen text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX seller_login_sessions_user_idx ON public.seller_login_sessions (user_id, created_at DESC);
GRANT SELECT ON public.seller_login_sessions TO authenticated;
GRANT ALL ON public.seller_login_sessions TO service_role;
ALTER TABLE public.seller_login_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own login sessions" ON public.seller_login_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);