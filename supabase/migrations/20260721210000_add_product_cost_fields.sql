alter table public.products
  add column if not exists cost_price numeric not null default 0;

alter table public.order_items
  add column if not exists unit_cost numeric not null default 0,
  add column if not exists total_cost numeric not null default 0;

update public.order_items oi
set
  unit_cost = coalesce(p.cost_price, 0),
  total_cost = oi.quantity * coalesce(p.cost_price, 0)
from public.products p
where oi.product_id = p.id
  and (oi.unit_cost = 0 or oi.total_cost = 0);
