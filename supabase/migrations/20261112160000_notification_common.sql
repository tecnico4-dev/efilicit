-- Buzón: aviso al equipo cuando alguien añade a Común (excepto el autor).
-- PK (user_id, tender_id); CASCADE si sale de shared_favorites.

create table public.notification_common (
  user_id uuid not null references public.users (id) on delete cascade,
  tender_id uuid not null
    references public.shared_favorites (tender_id) on delete cascade,
  read_at timestamptz null,
  trashed_at timestamptz null,
  primary key (user_id, tender_id)
);

comment on table public.notification_common is
  'Buzón in-app: aviso por destinatario al añadir a Común. CASCADE con shared_favorites.';

comment on column public.notification_common.read_at is
  'Null = no leída (puntito).';

comment on column public.notification_common.trashed_at is
  'Null = activa; no null = papelera (30 días o eliminar → DELETE fila).';

create index notification_common_user_unread_idx
  on public.notification_common (user_id)
  where read_at is null and trashed_at is null;

create index notification_common_user_trashed_at_idx
  on public.notification_common (user_id, trashed_at desc)
  where trashed_at is not null;

alter table public.notification_common enable row level security;

create policy "notification_common_select_own"
  on public.notification_common for select to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "notification_common_update_own"
  on public.notification_common for update to authenticated
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

create policy "notification_common_delete_own"
  on public.notification_common for delete to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

revoke all on table public.notification_common from public;
revoke all on table public.notification_common from anon;
grant select, update, delete on table public.notification_common to authenticated;

-- Fan-out: todos los usuarios app excepto added_by (SECURITY DEFINER).
create or replace function public.fanout_notification_common()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_common (user_id, tender_id)
  select u.id, new.tender_id
  from public.users u
  where u.id is distinct from new.added_by;
  return new;
end;
$$;

comment on function public.fanout_notification_common() is
  'Tras INSERT en shared_favorites, crea aviso in-app para el resto del equipo.';

revoke all on function public.fanout_notification_common() from public;
revoke all on function public.fanout_notification_common() from anon;
revoke all on function public.fanout_notification_common() from authenticated;

drop trigger if exists trg_shared_favorites_fanout_notification_common
  on public.shared_favorites;

create trigger trg_shared_favorites_fanout_notification_common
  after insert on public.shared_favorites
  for each row
  execute function public.fanout_notification_common();

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
    );
$$;

comment on function public.has_unread_notifications(uuid) is
  'Nav badge: favoritos-estado, digest email o Común sin leer (fuera de papelera).';

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
    );
$$;

comment on function public.count_unread_notifications(uuid) is
  'Home: nº de avisos no leídos (favoritos-estado + emails + Común).';
