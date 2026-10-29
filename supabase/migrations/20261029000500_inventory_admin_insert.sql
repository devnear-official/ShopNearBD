-- The product editor records stock set at creation/edit time as inventory movements.
-- Admins may insert movements attributed to themselves; nobody else can.
grant insert on public.inventory_movements to authenticated;
create policy inventory_admin_insert on public.inventory_movements
  for insert to authenticated
  with check (public.is_admin() and (actor_id is null or actor_id = auth.uid()));
