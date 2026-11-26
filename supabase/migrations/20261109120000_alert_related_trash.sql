-- Papelera de «Licitaciones relacionadas» por alerta (modal /alerts).
-- Independiente del buzón (/notifications). No borra tenders ni notification_queue.
-- Mientras trashed_at esté en los últimos 30 días → visible en pestaña Papelera del modal.
-- Pasado ese plazo → oculto en Activas y Papelera; la fila se conserva (dismiss permanente).

create table public.alert_related_trash (
  user_id uuid not null references public.users (id) on delete cascade,
  queue_id uuid not null references public.notification_queue (id) on delete cascade,
  trashed_at timestamptz not null default now(),
  primary key (user_id, queue_id)
);

comment on table public.alert_related_trash is
  'Licitaciones relacionadas de alerta en papelera (modal); UI 30 días, luego ocultas en el modal.';

create index alert_related_trash_user_id_idx
  on public.alert_related_trash (user_id);

create index alert_related_trash_user_trashed_at_idx
  on public.alert_related_trash (user_id, trashed_at desc);

alter table public.alert_related_trash enable row level security;

create policy "alert_related_trash_select_own"
  on public.alert_related_trash for select to authenticated
  using (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy "alert_related_trash_insert_own"
  on public.alert_related_trash for insert to authenticated
  with check (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy "alert_related_trash_delete_own"
  on public.alert_related_trash for delete to authenticated
  using (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy "alert_related_trash_update_own"
  on public.alert_related_trash for update to authenticated
  using (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  )
  with check (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

revoke all on table public.alert_related_trash from public;
revoke all on table public.alert_related_trash from anon;

grant select, insert, update, delete on table public.alert_related_trash to authenticated;
