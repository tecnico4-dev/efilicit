-- Papelera de avisos in-app (por usuario + tender_event).
-- Mientras trashed_at esté en los últimos 30 días → visible en «Papelera».
-- Pasado ese plazo → no se muestra en ninguna pestaña; la fila se conserva
-- para que el aviso no reaparezca en Todas / No leídas (dismiss permanente).

create table public.notification_trash (
  user_id uuid not null references public.users (id) on delete cascade,
  event_id uuid not null references public.tender_events (id) on delete cascade,
  trashed_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

comment on table public.notification_trash is
  'Avisos de favoritos enviados a papelera; UI 30 días, luego ocultos en todas partes.';

create index notification_trash_user_id_idx
  on public.notification_trash (user_id);

create index notification_trash_user_trashed_at_idx
  on public.notification_trash (user_id, trashed_at desc);

alter table public.notification_trash enable row level security;

create policy "notification_trash_select_own"
  on public.notification_trash for select to authenticated
  using (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy "notification_trash_insert_own"
  on public.notification_trash for insert to authenticated
  with check (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy "notification_trash_delete_own"
  on public.notification_trash for delete to authenticated
  using (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy "notification_trash_update_own"
  on public.notification_trash for update to authenticated
  using (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  )
  with check (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

revoke all on table public.notification_trash from public;
revoke all on table public.notification_trash from anon;

grant select, insert, update, delete on table public.notification_trash to authenticated;
