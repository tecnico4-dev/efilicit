-- Aviso al autor original cuando otro quita su licitación de Común.
-- Sin FK a shared_favorites (debe sobrevivir al DELETE).

create table public.notification_common_removed (
  user_id uuid not null references public.users (id) on delete cascade,
  tender_id uuid not null references public.tenders (id) on delete cascade,
  removed_by uuid null references public.users (id) on delete set null,
  removed_by_display_name text null,
  created_at timestamptz not null default now(),
  read_at timestamptz null,
  trashed_at timestamptz null,
  primary key (user_id, tender_id)
);

comment on table public.notification_common_removed is
  'Buzón in-app: aviso al autor cuando otro quita su licitación de Común.';

comment on column public.notification_common_removed.user_id is
  'Destinatario = added_by original de shared_favorites.';

comment on column public.notification_common_removed.removed_by is
  'Quién quitó la licitación de Común.';

comment on column public.notification_common_removed.removed_by_display_name is
  'Copia del display_name al quitar (UI sin leer users ajenos).';

comment on column public.notification_common_removed.read_at is
  'Null = no leída (puntito).';

comment on column public.notification_common_removed.trashed_at is
  'Null = activa; no null = papelera (30 días o eliminar → DELETE fila).';

create index notification_common_removed_user_unread_idx
  on public.notification_common_removed (user_id)
  where read_at is null and trashed_at is null;

create index notification_common_removed_user_trashed_at_idx
  on public.notification_common_removed (user_id, trashed_at desc)
  where trashed_at is not null;

alter table public.notification_common_removed enable row level security;

create policy "notification_common_removed_select_own"
  on public.notification_common_removed for select to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "notification_common_removed_update_own"
  on public.notification_common_removed for update to authenticated
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

create policy "notification_common_removed_delete_own"
  on public.notification_common_removed for delete to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

revoke all on table public.notification_common_removed from public;
revoke all on table public.notification_common_removed from anon;
grant select, update, delete on table public.notification_common_removed to authenticated;

-- Tras DELETE en shared_favorites: avisar al autor si otro la quitó.
create or replace function public.fanout_notification_common_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remover_id uuid;
  v_remover_name text;
begin
  select u.id, u.display_name
    into v_remover_id, v_remover_name
  from public.users u
  where u.auth_user_id = (select auth.uid());

  if v_remover_id is null then
    return old;
  end if;

  -- Solo si quien borra no es el autor original.
  if v_remover_id is not distinct from old.added_by then
    return old;
  end if;

  insert into public.notification_common_removed (
    user_id,
    tender_id,
    removed_by,
    removed_by_display_name
  )
  values (
    old.added_by,
    old.tender_id,
    v_remover_id,
    nullif(btrim(coalesce(v_remover_name, '')), '')
  )
  on conflict (user_id, tender_id) do update
  set
    removed_by = excluded.removed_by,
    removed_by_display_name = excluded.removed_by_display_name,
    created_at = now(),
    read_at = null,
    trashed_at = null;

  return old;
end;
$$;

comment on function public.fanout_notification_common_removed() is
  'Tras DELETE en shared_favorites, avisa al added_by si otro quitó la licitación.';

revoke all on function public.fanout_notification_common_removed() from public;
revoke all on function public.fanout_notification_common_removed() from anon;
revoke all on function public.fanout_notification_common_removed() from authenticated;

drop trigger if exists trg_shared_favorites_fanout_notification_common_removed
  on public.shared_favorites;

create trigger trg_shared_favorites_fanout_notification_common_removed
  after delete on public.shared_favorites
  for each row
  execute function public.fanout_notification_common_removed();

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
    );
$$;

comment on function public.has_unread_notifications(uuid) is
  'Nav badge: favoritos-estado, digest, Común añadida o Común quitada sin leer.';

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
    );
$$;

comment on function public.count_unread_notifications(uuid) is
  'Home: nº de avisos no leídos (favoritos-estado + emails + Común add/remove).';
