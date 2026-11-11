-- Buzón: unifica reads+trash de favoritos → notification_favorites;
-- renombra digest_inbox_notifications → notification_emails;
-- emails: DELETE propio para borrado definitivo.

-- ---------------------------------------------------------------------------
-- 1) notification_favorites (estado UI de avisos favorito×evento)
-- ---------------------------------------------------------------------------

create table public.notification_favorites (
  user_id uuid not null references public.users (id) on delete cascade,
  event_id uuid not null references public.tender_events (id) on delete cascade,
  read_at timestamptz null,
  trashed_at timestamptz null,
  deleted boolean not null default false,
  primary key (user_id, event_id),
  constraint notification_favorites_deleted_no_trash
    check (not deleted or trashed_at is null)
);

comment on table public.notification_favorites is
  'Estado UI de avisos de cambio de estado en favoritos (read / papelera / deleted).';

comment on column public.notification_favorites.deleted is
  'true = oculto para siempre en la web (eliminar de papelera o caducidad 30 días).';

create index notification_favorites_user_id_idx
  on public.notification_favorites (user_id);

create index notification_favorites_user_trashed_at_idx
  on public.notification_favorites (user_id, trashed_at desc)
  where trashed_at is not null and deleted = false;

create index notification_favorites_user_active_idx
  on public.notification_favorites (user_id)
  where deleted = false and trashed_at is null;

-- Backfill desde las tablas antiguas.
insert into public.notification_favorites (user_id, event_id, read_at, trashed_at, deleted)
select
  coalesce(r.user_id, t.user_id) as user_id,
  coalesce(r.event_id, t.event_id) as event_id,
  r.read_at,
  case
    when t.trashed_at is not null
      and t.trashed_at > (now() - interval '30 days')
      then t.trashed_at
    else null
  end as trashed_at,
  case
    when t.trashed_at is not null
      and t.trashed_at <= (now() - interval '30 days')
      then true
    else false
  end as deleted
from public.notification_reads r
full outer join public.notification_trash t
  on r.user_id = t.user_id and r.event_id = t.event_id;

alter table public.notification_favorites enable row level security;

create policy "notification_favorites_select_own"
  on public.notification_favorites for select to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "notification_favorites_insert_own"
  on public.notification_favorites for insert to authenticated
  with check (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "notification_favorites_update_own"
  on public.notification_favorites for update to authenticated
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

create policy "notification_favorites_delete_own"
  on public.notification_favorites for delete to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

revoke all on table public.notification_favorites from public;
revoke all on table public.notification_favorites from anon;
grant select, insert, update, delete on table public.notification_favorites to authenticated;

-- ---------------------------------------------------------------------------
-- 2) RPCs favoritos → notification_favorites
-- ---------------------------------------------------------------------------

create or replace function public.has_unread_favorite_status_notifications(
  p_user_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  with fav as (
    select f.tender_id, f.created_at as favorited_at
    from public.favorites f
    where f.user_id = p_user_id
  ),
  ranked as (
    select
      e.id as event_id,
      e.event_type,
      e.event_status,
      e.created_at,
      f.favorited_at,
      lag(e.event_status) over (
        partition by e.tender_id
        order by e.occurred_at asc, e.created_at asc
      ) as prev_status
    from public.tender_events e
    inner join fav f on f.tender_id = e.tender_id
    where e.event_type in ('ingerida', 'actualizada')
      and e.event_status is not null
  )
  select exists (
    select 1
    from ranked r
    where r.event_type = 'actualizada'
      and r.created_at > r.favorited_at
      and r.prev_status is not null
      and r.event_status is distinct from r.prev_status
      and not exists (
        select 1
        from public.notification_favorites nf
        where nf.user_id = p_user_id
          and nf.event_id = r.event_id
          and (
            nf.deleted
            or nf.trashed_at is not null
            or nf.read_at is not null
          )
      )
  );
$$;

comment on function public.has_unread_favorite_status_notifications(uuid) is
  'Nav badge: true si hay cambio de estado en favoritos sin leer y fuera de papelera/deleted.';

create or replace function public.count_unread_favorite_status_notifications(
  p_user_id uuid
)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  with fav as (
    select f.tender_id, f.created_at as favorited_at
    from public.favorites f
    where f.user_id = p_user_id
  ),
  ranked as (
    select
      e.id as event_id,
      e.event_type,
      e.event_status,
      e.created_at,
      f.favorited_at,
      lag(e.event_status) over (
        partition by e.tender_id
        order by e.occurred_at asc, e.created_at asc
      ) as prev_status
    from public.tender_events e
    inner join fav f on f.tender_id = e.tender_id
    where e.event_type in ('ingerida', 'actualizada')
      and e.event_status is not null
  )
  select count(*)::bigint
  from ranked r
  where r.event_type = 'actualizada'
    and r.created_at > r.favorited_at
    and r.prev_status is not null
    and r.event_status is distinct from r.prev_status
    and not exists (
      select 1
      from public.notification_favorites nf
      where nf.user_id = p_user_id
        and nf.event_id = r.event_id
        and (
          nf.deleted
          or nf.trashed_at is not null
          or nf.read_at is not null
        )
    );
$$;

comment on function public.count_unread_favorite_status_notifications(uuid) is
  'Home métrica: nº de avisos de favoritos sin leer (fuera de papelera/deleted).';

create or replace function public.list_recent_favorite_status_notifications(
  p_user_id uuid,
  p_limit integer default 3
)
returns table (
  event_id uuid,
  tender_id uuid,
  title text,
  previous_status text,
  new_status text,
  occurred_at timestamptz,
  detected_at timestamptz,
  source_code text,
  unread boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with fav as (
    select f.tender_id, f.created_at as favorited_at
    from public.favorites f
    where f.user_id = p_user_id
  ),
  ranked as (
    select
      e.id as event_id,
      e.tender_id,
      e.event_type,
      e.event_status,
      e.occurred_at,
      e.created_at,
      e.source_code,
      f.favorited_at,
      lag(e.event_status) over (
        partition by e.tender_id
        order by e.occurred_at asc, e.created_at asc
      ) as prev_status
    from public.tender_events e
    inner join fav f on f.tender_id = e.tender_id
    where e.event_type in ('ingerida', 'actualizada')
      and e.event_status is not null
  ),
  changes as (
    select
      r.event_id,
      r.tender_id,
      coalesce(nullif(trim(t.title), ''), 'Licitación') as title,
      r.prev_status as previous_status,
      r.event_status as new_status,
      r.occurred_at,
      r.created_at as detected_at,
      r.source_code,
      not exists (
        select 1
        from public.notification_favorites nf
        where nf.user_id = p_user_id
          and nf.event_id = r.event_id
          and nf.read_at is not null
      ) as unread
    from ranked r
    inner join public.tenders t on t.id = r.tender_id
    where r.event_type = 'actualizada'
      and r.created_at > r.favorited_at
      and r.prev_status is not null
      and r.event_status is distinct from r.prev_status
      and not exists (
        select 1
        from public.notification_favorites nf
        where nf.user_id = p_user_id
          and nf.event_id = r.event_id
          and (nf.deleted or nf.trashed_at is not null)
      )
  )
  select
    c.event_id,
    c.tender_id,
    c.title,
    c.previous_status,
    c.new_status,
    c.occurred_at,
    c.detected_at,
    c.source_code,
    c.unread
  from changes c
  order by c.detected_at desc
  limit greatest(1, least(coalesce(p_limit, 3), 20));
$$;

comment on function public.list_recent_favorite_status_notifications(uuid, integer) is
  'Home: últimos avisos de favoritos (fuera de papelera/deleted).';

-- ---------------------------------------------------------------------------
-- 3) Drop tablas antiguas
-- ---------------------------------------------------------------------------

drop table if exists public.notification_reads cascade;
drop table if exists public.notification_trash cascade;

comment on column public.users.notifications_read_at is
  'Legacy watermark del buzón; la lectura por aviso usa notification_favorites.';

-- ---------------------------------------------------------------------------
-- 4) Renombrar digest_inbox_notifications → notification_emails
-- ---------------------------------------------------------------------------

alter table public.digest_inbox_notifications
  rename to notification_emails;

alter index if exists digest_inbox_notifications_user_sent_at_idx
  rename to notification_emails_user_sent_at_idx;

alter index if exists digest_inbox_notifications_user_unread_idx
  rename to notification_emails_user_unread_idx;

comment on table public.notification_emails is
  'Buzón in-app: un aviso por digest email enviado (tender_ids = contenido del correo).';

comment on column public.notification_emails.digest_period is
  'Periodo del digest (día YYYY-MM-DD o semana ISO YYYY-Www).';

comment on column public.notification_emails.tender_ids is
  'Licitaciones incluidas en ese correo (orden de envío).';

drop policy if exists "digest_inbox_notifications_select_own" on public.notification_emails;
drop policy if exists "digest_inbox_notifications_update_own" on public.notification_emails;

create policy "notification_emails_select_own"
  on public.notification_emails for select to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "notification_emails_update_own"
  on public.notification_emails for update to authenticated
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

create policy "notification_emails_delete_own"
  on public.notification_emails for delete to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

revoke all on table public.notification_emails from public;
revoke all on table public.notification_emails from anon;
grant select, update, delete on table public.notification_emails to authenticated;

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
    );
$$;

comment on function public.has_unread_notifications(uuid) is
  'Nav badge: true si hay aviso de favoritos o email digest sin leer (fuera de papelera).';

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
    );
$$;

comment on function public.count_unread_notifications(uuid) is
  'Home: nº de avisos no leídos (favoritos-estado + emails digest).';
