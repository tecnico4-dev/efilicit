-- Badge del nav: ¿hay al menos un aviso de favoritos sin leer (fuera de papelera)?
-- Misma semántica que statusChangeNotifications + notification_reads/trash,
-- en un solo EXISTS (sin montar la lista completa en el layout).

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
        from public.notification_reads nr
        where nr.user_id = p_user_id
          and nr.event_id = r.event_id
      )
      and not exists (
        select 1
        from public.notification_trash nt
        where nt.user_id = p_user_id
          and nt.event_id = r.event_id
      )
  );
$$;

comment on function public.has_unread_favorite_status_notifications(uuid) is
  'Nav badge: true si hay cambio de estado en favoritos sin leer y fuera de papelera.';

revoke all on function public.has_unread_favorite_status_notifications(uuid) from public;
revoke all on function public.has_unread_favorite_status_notifications(uuid) from anon;
grant execute on function public.has_unread_favorite_status_notifications(uuid) to authenticated;
