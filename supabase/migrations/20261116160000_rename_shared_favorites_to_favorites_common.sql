-- Rename shared_favorites → favorites_common (ADR 032).
-- Conserva PK tender_id; notification_common CASCADE sigue válido.

alter table public.shared_favorites rename to favorites_common;

alter index if exists public.shared_favorites_added_by_idx
  rename to favorites_common_added_by_idx;
alter index if exists public.shared_favorites_created_at_idx
  rename to favorites_common_created_at_idx;

alter table public.favorites_common
  rename constraint shared_favorites_pkey to favorites_common_pkey;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'shared_favorites_added_by_fkey'
      and conrelid = 'public.favorites_common'::regclass
  ) then
    alter table public.favorites_common
      rename constraint shared_favorites_added_by_fkey to favorites_common_added_by_fkey;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'shared_favorites_tender_id_fkey'
      and conrelid = 'public.favorites_common'::regclass
  ) then
    alter table public.favorites_common
      rename constraint shared_favorites_tender_id_fkey to favorites_common_tender_id_fkey;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'shared_favorites_notes_check'
      and conrelid = 'public.favorites_common'::regclass
  ) then
    alter table public.favorites_common
      rename constraint shared_favorites_notes_check to favorites_common_notes_check;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'shared_favorites_kind_check'
      and conrelid = 'public.favorites_common'::regclass
  ) then
    alter table public.favorites_common
      rename constraint shared_favorites_kind_check to favorites_common_kind_check;
  end if;
end $$;

alter policy "shared_favorites_select_app" on public.favorites_common
  rename to "favorites_common_select_app";
alter policy "shared_favorites_insert_app" on public.favorites_common
  rename to "favorites_common_insert_app";
alter policy "shared_favorites_delete_app" on public.favorites_common
  rename to "favorites_common_delete_app";

drop trigger if exists trg_shared_favorites_fanout_notification_common
  on public.favorites_common;
drop trigger if exists trg_shared_favorites_fanout_notification_common_removed
  on public.favorites_common;

-- Recrear triggers con nombre nuevo (mismas funciones).
create trigger trg_favorites_common_fanout_notification_common
  after insert on public.favorites_common
  for each row
  execute function public.fanout_notification_common();

create trigger trg_favorites_common_fanout_notification_common_removed
  after delete on public.favorites_common
  for each row
  execute function public.fanout_notification_common_removed();

comment on table public.favorites_common is
  'Carpeta Común: una fila por licitación; added_by = quien la compartió primero. Ex shared_favorites (ADR 032).';

comment on column public.favorites_common.added_by_display_name is
  'Nombre visible al compartir (copia); evita leer users ajenos por RLS.';

comment on column public.favorites_common.notes is
  'Nota opcional al compartir (máx. 500). Visible a todo el equipo.';

-- RPCs de cambios de estado: apuntaban a shared_favorites por nombre.
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
    select tender_id, min(favorited_at) as favorited_at
    from (
      select f.tender_id, f.created_at as favorited_at
      from public.favorites f
      where f.user_id = p_user_id
      union all
      select sf.tender_id, sf.created_at as favorited_at
      from public.favorites_common sf
    ) sources
    group by tender_id
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
    select tender_id, min(favorited_at) as favorited_at
    from (
      select f.tender_id, f.created_at as favorited_at
      from public.favorites f
      where f.user_id = p_user_id
      union all
      select sf.tender_id, sf.created_at as favorited_at
      from public.favorites_common sf
    ) sources
    group by tender_id
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
    select tender_id, min(favorited_at) as favorited_at
    from (
      select f.tender_id, f.created_at as favorited_at
      from public.favorites f
      where f.user_id = p_user_id
      union all
      select sf.tender_id, sf.created_at as favorited_at
      from public.favorites_common sf
    ) sources
    group by tender_id
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
