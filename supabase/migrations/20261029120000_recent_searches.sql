-- Historial de búsquedas recientes (máx. 5 por usuario).
-- Distinto de saved_searches (favoritos con nombre): se rellena al Buscar.
-- Dedupe por criteria_signature: misma firma → actualiza searched_at (sube).

create table public.recent_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  criteria jsonb not null,
  criteria_signature text not null,
  searched_at timestamptz not null default now(),
  unique (user_id, criteria_signature)
);

comment on table public.recent_searches is
  'Últimas búsquedas del usuario (máx. 5). Automático al Buscar; no es favorito.';

comment on column public.recent_searches.criteria_signature is
  'Firma estable Criteria v1 (misma idea que criteriaSignature en la web).';

create index recent_searches_user_searched_at_idx
  on public.recent_searches (user_id, searched_at desc);

alter table public.recent_searches enable row level security;

create policy "recent_searches_select_own"
  on public.recent_searches for select to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "recent_searches_insert_own"
  on public.recent_searches for insert to authenticated
  with check (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "recent_searches_update_own"
  on public.recent_searches for update to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  )
  with check (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "recent_searches_delete_own"
  on public.recent_searches for delete to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

revoke all on table public.recent_searches from public;
revoke all on table public.recent_searches from anon;
grant select, insert, update, delete on table public.recent_searches to authenticated;

-- Upsert + recorte a 5. SECURITY INVOKER; solo el propio perfil.
create or replace function public.record_recent_search(
  p_criteria jsonb,
  p_signature text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if p_signature is null or length(trim(p_signature)) = 0 then
    raise exception 'record_recent_search: signature required';
  end if;
  if p_criteria is null or jsonb_typeof(p_criteria) <> 'object' then
    raise exception 'record_recent_search: criteria object required';
  end if;

  select u.id into v_user_id
  from public.users u
  where u.auth_user_id = (select auth.uid());

  if v_user_id is null then
    raise exception 'record_recent_search: no profile for auth.uid()';
  end if;

  insert into public.recent_searches (
    user_id, criteria, criteria_signature, searched_at
  )
  values (
    v_user_id, p_criteria, trim(p_signature), now()
  )
  on conflict (user_id, criteria_signature) do update
  set
    criteria = excluded.criteria,
    searched_at = now();

  delete from public.recent_searches rs
  where rs.user_id = v_user_id
    and rs.id not in (
      select id
      from public.recent_searches
      where user_id = v_user_id
      order by searched_at desc
      limit 5
    );
end;
$$;

comment on function public.record_recent_search(jsonb, text) is
  'Registra o sube una búsqueda reciente y deja solo las 5 más nuevas del usuario.';

revoke all on function public.record_recent_search(jsonb, text) from public;
revoke all on function public.record_recent_search(jsonb, text) from anon;
grant execute on function public.record_recent_search(jsonb, text) to authenticated;
