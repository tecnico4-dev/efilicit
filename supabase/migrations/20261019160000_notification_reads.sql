-- Lectura por aviso in-app (cambios de estado en favoritos).
-- Un usuario marca cada tender_event como leído al abrirlo; el buzón
-- ya no usa solo users.notifications_read_at como watermark global.

create table public.notification_reads (
  user_id uuid not null references public.users (id) on delete cascade,
  event_id uuid not null references public.tender_events (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

comment on table public.notification_reads is
  'Avisos in-app leídos por usuario (event_id = tender_events de cambio de estado).';

create index notification_reads_user_id_idx
  on public.notification_reads (user_id);

create index notification_reads_event_id_idx
  on public.notification_reads (event_id);

alter table public.notification_reads enable row level security;

create policy "notification_reads_select_own"
  on public.notification_reads for select to authenticated
  using (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy "notification_reads_insert_own"
  on public.notification_reads for insert to authenticated
  with check (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

create policy "notification_reads_delete_own"
  on public.notification_reads for delete to authenticated
  using (
    user_id in (select id from public.users where auth_user_id = auth.uid())
  );

revoke all on table public.notification_reads from public;
revoke all on table public.notification_reads from anon;

grant select, insert, delete on table public.notification_reads to authenticated;

comment on column public.users.notifications_read_at is
  'Legacy watermark del buzón; la lectura por aviso usa notification_reads.';
