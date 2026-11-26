-- Buzón in-app: aviso al receptor al compartir peer (favorites_shared).
-- ADR 037. 1 fila = 1 share; CASCADE si desaparece el share.

create table public.notification_shared (
  share_id uuid primary key
    references public.favorites_shared (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz null,
  trashed_at timestamptz null
);

comment on table public.notification_shared is
  'Buzón in-app: aviso al to_user_id al INSERT/reactivar favorites_shared. CASCADE con el share.';

comment on column public.notification_shared.share_id is
  'PK = favorites_shared.id (quién→quién, tender, kind vía join).';

comment on column public.notification_shared.user_id is
  'Destinatario del aviso (= favorites_shared.to_user_id).';

comment on column public.notification_shared.created_at is
  'Cuándo se creó/recreó el aviso (reactivación reinicia).';

comment on column public.notification_shared.read_at is
  'Null = no leída (puntito).';

comment on column public.notification_shared.trashed_at is
  'Null = activa; no null = papelera (30 días o eliminar → DELETE fila).';

create index notification_shared_user_unread_idx
  on public.notification_shared (user_id)
  where read_at is null and trashed_at is null;

create index notification_shared_user_trashed_at_idx
  on public.notification_shared (user_id, trashed_at desc)
  where trashed_at is not null;

alter table public.notification_shared enable row level security;

create policy "notification_shared_select_own"
  on public.notification_shared for select to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "notification_shared_update_own"
  on public.notification_shared for update to authenticated
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

create policy "notification_shared_delete_own"
  on public.notification_shared for delete to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

revoke all on table public.notification_shared from public;
revoke all on table public.notification_shared from anon;
grant select, update, delete on table public.notification_shared to authenticated;

-- Tras INSERT en favorites_shared → aviso al receptor.
create or replace function public.fanout_notification_shared()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_shared (share_id, user_id)
  values (new.id, new.to_user_id)
  on conflict (share_id) do update
  set
    user_id = excluded.user_id,
    created_at = now(),
    read_at = null,
    trashed_at = null;
  return new;
end;
$$;

comment on function public.fanout_notification_shared() is
  'Tras INSERT en favorites_shared, crea aviso in-app para to_user_id.';

revoke all on function public.fanout_notification_shared() from public;
revoke all on function public.fanout_notification_shared() from anon;
revoke all on function public.fanout_notification_shared() from authenticated;

drop trigger if exists trg_favorites_shared_fanout_notification_shared
  on public.favorites_shared;

create trigger trg_favorites_shared_fanout_notification_shared
  after insert on public.favorites_shared
  for each row
  execute function public.fanout_notification_shared();

-- Reactivar share oculto: recrear/resetear aviso (no dispara INSERT).
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

  insert into public.notification_shared (share_id, user_id)
  values (v_share_id, p_to_user_id)
  on conflict (share_id) do update
  set
    user_id = excluded.user_id,
    created_at = now(),
    read_at = null,
    trashed_at = null;

  return 'reactivated';
end;
$$;

comment on function public.reactivate_favorite_share(uuid, uuid, text, text) is
  'Si el share del caller está oculto en algún lado, limpia hides, actualiza kind/notes y recrea aviso in-app. Devuelve reactivated|already|missing.';

-- Badge / home: incluir peer shares.
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
      where s.user_id = p_user_id
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
      where s.user_id = p_user_id
        and s.read_at is null
        and s.trashed_at is null
    );
$$;

comment on function public.count_unread_notifications(uuid) is
  'Home: nº de avisos no leídos (favoritos-estado + emails + Común + peer share).';
