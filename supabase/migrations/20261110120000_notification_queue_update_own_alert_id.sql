-- Reasignar alert_id en cola propia (p. ej. Revertir tras borrar alerta).
-- ON DELETE SET NULL deja huérfanas las filas; el undo recrea la alerta con otro id.

grant update (alert_id) on public.notification_queue to authenticated;

drop policy if exists "notification_queue_update_own_alert_id" on public.notification_queue;

create policy "notification_queue_update_own_alert_id"
  on public.notification_queue for update to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  )
  with check (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
    and (
      alert_id is null
      or alert_id in (
        select a.id
        from public.alerts a
        where a.user_id in (
          select id from public.users where auth_user_id = (select auth.uid())
        )
      )
    )
  );

comment on policy "notification_queue_update_own_alert_id" on public.notification_queue is
  'El dueño puede reasignar alert_id (undo de borrado de alerta); el resto de columnas las escribe el job trusted.';
