-- notification_shared: solo share_id + read_at + trashed_at (ADR 037 enmendado).
-- Emisor/receptor/tender/fecha salen de favorites_shared vía share_id.

drop policy if exists "notification_shared_select_own" on public.notification_shared;
drop policy if exists "notification_shared_update_own" on public.notification_shared;
drop policy if exists "notification_shared_delete_own" on public.notification_shared;

drop index if exists public.notification_shared_user_unread_idx;
drop index if exists public.notification_shared_user_trashed_at_idx;

alter table public.notification_shared
  drop column if exists user_id,
  drop column if exists created_at;

comment on table public.notification_shared is
  'Buzón in-app peer: PK share_id → favorites_shared; read_at/trashed_at; resto vía join.';

comment on column public.notification_shared.share_id is
  'PK = favorites_shared.id (quién→quién, tender, kind, created_at vía join).';

create index notification_shared_unread_idx
  on public.notification_shared (share_id)
  where read_at is null and trashed_at is null;

create index notification_shared_trashed_at_idx
  on public.notification_shared (trashed_at desc)
  where trashed_at is not null;

create policy "notification_shared_select_own"
  on public.notification_shared for select to authenticated
  using (
    share_id in (
      select fs.id
      from public.favorites_shared fs
      where fs.to_user_id in (
        select id from public.users where auth_user_id = (select auth.uid())
      )
    )
  );

create policy "notification_shared_update_own"
  on public.notification_shared for update to authenticated
  using (
    share_id in (
      select fs.id
      from public.favorites_shared fs
      where fs.to_user_id in (
        select id from public.users where auth_user_id = (select auth.uid())
      )
    )
  )
  with check (
    share_id in (
      select fs.id
      from public.favorites_shared fs
      where fs.to_user_id in (
        select id from public.users where auth_user_id = (select auth.uid())
      )
    )
  );

create policy "notification_shared_delete_own"
  on public.notification_shared for delete to authenticated
  using (
    share_id in (
      select fs.id
      from public.favorites_shared fs
      where fs.to_user_id in (
        select id from public.users where auth_user_id = (select auth.uid())
      )
    )
  );

create or replace function public.fanout_notification_shared()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_shared (share_id)
  values (new.id)
  on conflict (share_id) do update
  set
    read_at = null,
    trashed_at = null;
  return new;
end;
$$;

comment on function public.fanout_notification_shared() is
  'Tras INSERT en favorites_shared, crea aviso in-app (share_id) para el receptor.';

create or replace function public.reactivate_favorite_share(
  p_tender_id uuid,
  p_to_user_id uuid,
  p_kind text,
  p_notes text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_share_id uuid;
  v_hidden_from timestamptz;
  v_hidden_to timestamptz;
begin
  if not public.is_app_user() then
    raise exception 'reactivate_favorite_share: not app user';
  end if;

  if p_kind is null or p_kind not in ('propia', 'subcontrata') then
    raise exception 'reactivate_favorite_share: invalid kind';
  end if;

  select u.id into v_user_id
  from public.users u
  where u.auth_user_id = (select auth.uid());

  if v_user_id is null then
    raise exception 'reactivate_favorite_share: no profile';
  end if;

  if p_to_user_id is null or p_to_user_id = v_user_id then
    raise exception 'reactivate_favorite_share: invalid to_user';
  end if;

  select fs.id, fs.hidden_by_from_at, fs.hidden_by_to_at
  into v_share_id, v_hidden_from, v_hidden_to
  from public.favorites_shared fs
  where fs.tender_id = p_tender_id
    and fs.from_user_id = v_user_id
    and fs.to_user_id = p_to_user_id
  for update;

  if not found then
    return 'missing';
  end if;

  if v_hidden_from is null and v_hidden_to is null then
    return 'already';
  end if;

  update public.favorites_shared
  set
    hidden_by_from_at = null,
    hidden_by_to_at = null,
    kind = p_kind,
    notes = case
      when p_notes is null or length(trim(p_notes)) = 0 then null
      else left(trim(p_notes), 500)
    end
  where id = v_share_id;

  insert into public.notification_shared (share_id)
  values (v_share_id)
  on conflict (share_id) do update
  set
    read_at = null,
    trashed_at = null;

  return 'reactivated';
end;
$$;

create or replace function public.has_unread_notifications(
  p_user_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    public.has_unread_favorite_status_notifications(p_user_id)
    or exists (
      select 1
      from public.notification_emails d
      where d.user_id = p_user_id
        and d.read_at is null
        and d.trashed_at is null
    )
    or exists (
      select 1
      from public.notification_common c
      where c.user_id = p_user_id
        and c.read_at is null
        and c.trashed_at is null
    )
    or exists (
      select 1
      from public.notification_common_removed r
      where r.user_id = p_user_id
        and r.read_at is null
        and r.trashed_at is null
    )
    or exists (
      select 1
      from public.notification_shared s
      join public.favorites_shared fs on fs.id = s.share_id
      where fs.to_user_id = p_user_id
        and s.read_at is null
        and s.trashed_at is null
    );
$$;

comment on function public.has_unread_notifications(uuid) is
  'Nav badge: favoritos-estado, digest, Común add/remove, peer share sin leer.';

create or replace function public.count_unread_notifications(
  p_user_id uuid
)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select
    public.count_unread_favorite_status_notifications(p_user_id)
    + (
      select count(*)::bigint
      from public.notification_emails d
      where d.user_id = p_user_id
        and d.read_at is null
        and d.trashed_at is null
    )
    + (
      select count(*)::bigint
      from public.notification_common c
      where c.user_id = p_user_id
        and c.read_at is null
        and c.trashed_at is null
    )
    + (
      select count(*)::bigint
      from public.notification_common_removed r
      where r.user_id = p_user_id
        and r.read_at is null
        and r.trashed_at is null
    )
    + (
      select count(*)::bigint
      from public.notification_shared s
      join public.favorites_shared fs on fs.id = s.share_id
      where fs.to_user_id = p_user_id
        and s.read_at is null
        and s.trashed_at is null
    );
$$;

comment on function public.count_unread_notifications(uuid) is
  'Home: nº de avisos no leídos (favoritos-estado + emails + Común + peer share).';
