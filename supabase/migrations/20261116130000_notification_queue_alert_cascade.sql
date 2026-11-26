-- Al borrar una alerta, eliminar también sus filas de cola (antes SET NULL → huérfanas).
-- El undo de alerta ya no reasigna cola; el UI confirma borrado irreversible.

alter table public.notification_queue
  drop constraint if exists notification_queue_alert_id_fkey;

alter table public.notification_queue
  add constraint notification_queue_alert_id_fkey
  foreign key (alert_id)
  references public.alerts (id)
  on delete cascade;

comment on column public.notification_queue.alert_id is
  'Alerta de origen. CASCADE: borrar alerta elimina sus coincidencias en cola.';
