-- Avisos in-app al enviar un digest por email (1 aviso = 1 correo).
-- El job Python inserta tras Resend OK; la web lista + marca leído/papelera.
-- Lectura/papelera en columnas propias (no reutiliza notification_reads/trash
-- porque esas FKs apuntan a tender_events).

create table public.digest_inbox_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  frequency text not null
    check (frequency in ('diaria', 'semanal')),
  digest_period text not null,
  sent_at timestamptz not null,
  tender_count integer not null check (tender_count > 0),
  tender_ids uuid[] not null default '{}'::uuid[],
  read_at timestamptz null,
  trashed_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (user_id, digest_period, frequency)
);

comment on table public.digest_inbox_notifications is
  'Buzón in-app: un aviso por digest email enviado (tender_ids = contenido del correo).';

comment on column public.digest_inbox_notifications.digest_period is
  'Periodo del digest (día YYYY-MM-DD o semana ISO YYYY-Www), alineado con notification_queue.payload.digest.';

comment on column public.digest_inbox_notifications.tender_ids is
  'Licitaciones incluidas en ese correo (orden de envío; sin carpetas por alerta).';

create index digest_inbox_notifications_user_sent_at_idx
  on public.digest_inbox_notifications (user_id, sent_at desc);

create index digest_inbox_notifications_user_unread_idx
  on public.digest_inbox_notifications (user_id)
  where read_at is null and trashed_at is null;

alter table public.digest_inbox_notifications enable row level security;

create policy "digest_inbox_notifications_select_own"
  on public.digest_inbox_notifications for select to authenticated
  using (
    user_id in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "digest_inbox_notifications_update_own"
  on public.digest_inbox_notifications for update to authenticated
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

revoke all on table public.digest_inbox_notifications from public;
revoke all on table public.digest_inbox_notifications from anon;

-- Solo lectura/marcado desde el cliente; escritura del aviso = job (conexión trusted).
grant select, update on table public.digest_inbox_notifications to authenticated;

-- Badge del nav: favoritos-estado O digest enviado sin leer.
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
      from public.digest_inbox_notifications d
      where d.user_id = p_user_id
        and d.read_at is null
        and d.trashed_at is null
    );
$$;

comment on function public.has_unread_notifications(uuid) is
  'Nav badge: true si hay aviso de favoritos o digest email sin leer (fuera de papelera).';

revoke all on function public.has_unread_notifications(uuid) from public;
revoke all on function public.has_unread_notifications(uuid) from anon;
grant execute on function public.has_unread_notifications(uuid) to authenticated;

-- Conteo home: favoritos + digests no leídos.
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
      from public.digest_inbox_notifications d
      where d.user_id = p_user_id
        and d.read_at is null
        and d.trashed_at is null
    );
$$;

comment on function public.count_unread_notifications(uuid) is
  'Home: nº de avisos no leídos (favoritos-estado + digests email).';

revoke all on function public.count_unread_notifications(uuid) from public;
revoke all on function public.count_unread_notifications(uuid) from anon;
grant execute on function public.count_unread_notifications(uuid) to authenticated;
