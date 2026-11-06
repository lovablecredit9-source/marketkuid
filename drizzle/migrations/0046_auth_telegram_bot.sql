CREATE TABLE public.auth_bot (
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
GRANT ALL ON public.auth_bot TO service_role;
ALTER TABLE public.auth_bot ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.auth_bot_chats (
  tg_user_id bigint PRIMARY KEY,
  tg_username text,
  first_name text,
  started_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_bot_chats_username_idx ON public.auth_bot_chats (lower(tg_username));
GRANT ALL ON public.auth_bot_chats TO service_role;
ALTER TABLE public.auth_bot_chats ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.auth_bot_updates (
  update_id bigint PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.auth_bot_updates TO service_role;
ALTER TABLE public.auth_bot_updates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.auth_login_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tg_user_id bigint NOT NULL,
  code_hash text NOT NULL,
  magic_hash text NOT NULL UNIQUE,
  attempts smallint NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_login_codes_tg_idx ON public.auth_login_codes (tg_user_id, created_at DESC);
GRANT ALL ON public.auth_login_codes TO service_role;
ALTER TABLE public.auth_login_codes ENABLE ROW LEVEL SECURITY;