CREATE OR REPLACE FUNCTION public.chat_partner_state(p_id uuid)
 RETURNS TABLE(seen_at timestamp with time zone, typing boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    NULLIF(GREATEST(
      coalesce(CASE WHEN c.buyer_id = auth.uid() THEN p.seller_seen_at ELSE p.last_seen_at END, '-infinity'::timestamptz),
      coalesce((SELECT max(m.created_at) FROM public.messages m
                 WHERE m.conversation_id = c.id AND m.sender_id = p.id), '-infinity'::timestamptz),
      coalesce((SELECT max(m.read_at) FROM public.messages m
                 WHERE m.conversation_id = c.id AND m.sender_id <> p.id), '-infinity'::timestamptz)
    ), '-infinity'::timestamptz),
    coalesce(CASE WHEN c.buyer_id = auth.uid() THEN c.seller_typing_at ELSE c.buyer_typing_at END > now() - interval '6 seconds', false)
  FROM public.conversations c
  JOIN public.profiles p ON p.id = CASE WHEN c.buyer_id = auth.uid() THEN c.seller_id ELSE c.buyer_id END
  WHERE c.id = p_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid());
$function$;