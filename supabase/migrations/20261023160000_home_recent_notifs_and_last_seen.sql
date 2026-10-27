-- Home: recientes + conteo de no leídas sin montar la lista completa en TS.
-- Favoritos: max(last_seen_at) por tender sin embeber todas las tender_sources.

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
      from public.notification_reads nr
      where nr.user_id = p_user_id
        and nr.event_id = r.event_id
    )
    and not exists (
      select 1
      from public.notification_trash nt
      where nt.user_id = p_user_id
        and nt.event_id = r.event_id
    );
$$;

comment on function public.count_unread_favorite_status_notifications(uuid) is
  'Home métrica: nº de avisos de favoritos sin leer (fuera de papelera).';

revoke all on function public.count_unread_favorite_status_notifications(uuid) from public;
revoke all on function public.count_unread_favorite_status_notifications(uuid) from anon;
grant execute on function public.count_unread_favorite_status_notifications(uuid) to authenticated;

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
        from public.notification_reads nr
        where nr.user_id = p_user_id
          and nr.event_id = r.event_id
      ) as unread
    from ranked r
    inner join public.tenders t on t.id = r.tender_id
    where r.event_type = 'actualizada'
      and r.created_at > r.favorited_at
      and r.prev_status is not null
      and r.event_status is distinct from r.prev_status
      and not exists (
        select 1
        from public.notification_trash nt
        where nt.user_id = p_user_id
          and nt.event_id = r.event_id
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
  'Home: últimos avisos de favoritos (fuera de papelera), sin montar el buzón completo.';

revoke all on function public.list_recent_favorite_status_notifications(uuid, integer) from public;
revoke all on function public.list_recent_favorite_status_notifications(uuid, integer) from anon;
grant execute on function public.list_recent_favorite_status_notifications(uuid, integer) to authenticated;

create or replace function public.tender_max_last_seen(p_tender_ids uuid[])
returns table (
  tender_id uuid,
  last_seen_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    ts.tender_id,
    max(ts.last_seen_at) as last_seen_at
  from public.tender_sources ts
  where p_tender_ids is not null
    and cardinality(p_tender_ids) > 0
    and ts.tender_id = any (p_tender_ids)
  group by ts.tender_id;
$$;

comment on function public.tender_max_last_seen(uuid[]) is
  'Favoritos UI: max(last_seen_at) por licitación sin traer todas las filas source.';

revoke all on function public.tender_max_last_seen(uuid[]) from public;
grant execute on function public.tender_max_last_seen(uuid[]) to anon, authenticated;
