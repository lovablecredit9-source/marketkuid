create or replace function public.recent_purchases(_limit int default 12)
returns table(product_id uuid, name text, price bigint, image_path text, paid_at timestamptz)
language sql stable security definer set search_path = public as $$
  select x.product_id, x.name, x.price, x.image_path, x.paid_at from (
    select distinct on (oi.product_id) oi.product_id, p.name, oi.unit_price as price,
      coalesce(p.images[1], oi.image_path) as image_path, o.paid_at
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.products p on p.id = oi.product_id
    where o.paid_at is not null and o.status <> 'cancelled'
      and p.status = 'active' and not coalesce(p.admin_hidden, false)
    order by oi.product_id, o.paid_at desc
  ) x order by x.paid_at desc limit least(greatest(coalesce(_limit, 12), 1), 24);
$$;
revoke all on function public.recent_purchases(int) from public;
grant execute on function public.recent_purchases(int) to anon, authenticated;