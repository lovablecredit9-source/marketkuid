INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE lower(email) = 'panpakarak36@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;