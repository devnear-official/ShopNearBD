-- RLS speed: `using (is_admin())` calls the function once per row, so an admin reading 60k orders
-- paid for 60k function calls (count(*) took ~1 s, the analytics page ~9 s). Wrapping the call in a
-- scalar sub-select lets Postgres evaluate it once per query (an InitPlan). Same rules, same results.
do $$
declare
  p record;
  q text;
  w text;
  clauses text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check from pg_policies
    where schemaname = 'public' and (qual ~* '(is_admin|auth\.uid)\(\)' or with_check ~* '(is_admin|auth\.uid)\(\)')
  loop
    q := p.qual;
    w := p.with_check;
    if q is not null and q !~* 'select\s+(public\.)?(is_admin|auth\.uid)\(' then
      q := regexp_replace(regexp_replace(q, 'public\.is_admin\(\)', 'is_admin()', 'gi'), '\mis_admin\(\)', '(select public.is_admin())', 'gi');
      q := regexp_replace(q, 'auth\.uid\(\)', '(select auth.uid())', 'gi');
    end if;
    if w is not null and w !~* 'select\s+(public\.)?(is_admin|auth\.uid)\(' then
      w := regexp_replace(regexp_replace(w, 'public\.is_admin\(\)', 'is_admin()', 'gi'), '\mis_admin\(\)', '(select public.is_admin())', 'gi');
      w := regexp_replace(w, 'auth\.uid\(\)', '(select auth.uid())', 'gi');
    end if;
    clauses := concat_ws(' ', case when q is not null then format('using (%s)', q) end, case when w is not null then format('with check (%s)', w) end);
    if clauses <> '' then
      execute format('alter policy %I on %I.%I %s', p.policyname, p.schemaname, p.tablename, clauses);
    end if;
  end loop;
end $$;
