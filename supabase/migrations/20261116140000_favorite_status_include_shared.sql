-- Cambios de estado en buzón: favorites propias ∪ shared_favorites (Común).
-- Watermark = LEAST(created_at) si está en ambos; un aviso por (user, event).
-- Solo Studio / migrate local hasta OK explícito en remoto.

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
      from public.shared_favorites sf
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

comment on function public.has_unread_favorite_status_notifications(uuid) is
  'Nav badge: cambio de estado en favoritos propios o Común sin leer (fuera papelera/deleted).';

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
      from public.shared_favorites sf
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

comment on function public.count_unread_favorite_status_notifications(uuid) is
  'Home métrica: nº avisos de estado (propios o Común) sin leer (fuera papelera/deleted).';

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
      from public.shared_favorites sf
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

comment on function public.list_recent_favorite_status_notifications(uuid, integer) is
  'Home: últimos avisos de estado (favoritos propios o Común; fuera papelera/deleted).';
