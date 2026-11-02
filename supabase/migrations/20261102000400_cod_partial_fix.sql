-- Payment audit fix: a partly collected COD amount used to mark the order "partially_refunded", which tells
-- the customer and the admin a refund happened when it did not. Now the order becomes 'paid' only when the
-- verified cash collected reaches the order total; until then it stays 'unpaid' and the collected rows remain
-- visible in the payments list. Over-collection is rejected.
create or replace function public._record_cod_collection(p_order_id uuid, p_amount numeric, p_note text, p_actor uuid, p_label text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  o public.orders;
  v_collected numeric;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.payment_method <> 'cod' then raise exception 'NOT_COD'; end if;
  if o.payment_status = 'paid' then return; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  select coalesce(sum(amount), 0) into v_collected from public.payments where order_id = o.id and method = 'cod' and status = 'verified';
  if v_collected + p_amount > o.total then raise exception 'INVALID_AMOUNT'; end if;
  insert into public.payments (order_id, method, status, amount, note, verified_by, verified_at)
  values (o.id, 'cod', 'verified', p_amount, p_note, p_actor, now());
  if v_collected + p_amount >= o.total then
    update public.orders set payment_status = 'paid' where id = o.id;
  end if;
  insert into public.audit_logs (actor_id, actor_label, action, entity, entity_id, data)
  values (p_actor, p_label, 'payment.cod_collected', 'order', o.id::text, jsonb_build_object('amount', p_amount, 'note', p_note, 'total_collected', v_collected + p_amount));
end $$;

-- Existing rows that were labelled "partially_refunded" only because cash was partly collected (no refund row exists).
update public.orders o set payment_status = 'unpaid'
where o.payment_status = 'partially_refunded' and o.payment_method = 'cod'
  and not exists (select 1 from public.payments p where p.order_id = o.id and p.status = 'refund');
