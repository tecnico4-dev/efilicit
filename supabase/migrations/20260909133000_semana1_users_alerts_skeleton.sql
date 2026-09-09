-- Semana 1 / Paso 3: esqueleto de usuarios y alertas (sin lógica de producto aún).
-- RLS owner-only: un usuario no ve datos de otro.

-- ---------------------------------------------------------------------------
-- users — perfil ligado a Supabase Auth
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.users is
  'Perfil de aplicación. auth_user_id enlaza con auth.users.';

-- ---------------------------------------------------------------------------
-- saved_searches
-- ---------------------------------------------------------------------------
create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  criteria jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.saved_searches is
  'Búsquedas guardadas por usuario. criteria es flexible (keywords, CPV, etc.).';

create index saved_searches_user_id_idx on public.saved_searches (user_id);

-- ---------------------------------------------------------------------------
-- alerts
-- ---------------------------------------------------------------------------
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  criteria jsonb not null default '{}'::jsonb,
  frequency text not null default 'daily'
    check (frequency in ('daily', 'weekly', 'instant')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.alerts is
  'Reglas de alerta del usuario. El motor batch llega en Semana 5.';

create index alerts_user_id_idx on public.alerts (user_id);
create index alerts_is_active_idx on public.alerts (is_active) where is_active;

-- ---------------------------------------------------------------------------
-- notification_queue
-- ---------------------------------------------------------------------------
create table public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  alert_id uuid references public.alerts (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  idempotency_key text not null,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (idempotency_key)
);

comment on table public.notification_queue is
  'Cola de notificaciones. idempotency_key evita reenvíos al reejecutar el batch.';

create index notification_queue_user_id_idx on public.notification_queue (user_id);
create index notification_queue_status_scheduled_at_idx
  on public.notification_queue (status, scheduled_at);

-- ---------------------------------------------------------------------------
-- RLS owner-only
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.saved_searches enable row level security;
alter table public.alerts enable row level security;
alter table public.notification_queue enable row level security;

-- users
create policy "users_select_own"
  on public.users for select to authenticated
  using (auth_user_id = auth.uid());

create policy "users_update_own"
  on public.users for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy "users_insert_own"
  on public.users for insert to authenticated
  with check (auth_user_id = auth.uid());

-- saved_searches
create policy "saved_searches_select_own"
  on public.saved_searches for select to authenticated
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "saved_searches_insert_own"
  on public.saved_searches for insert to authenticated
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "saved_searches_update_own"
  on public.saved_searches for update to authenticated
  using (user_id in (select id from public.users where auth_user_id = auth.uid()))
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "saved_searches_delete_own"
  on public.saved_searches for delete to authenticated
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

-- alerts
create policy "alerts_select_own"
  on public.alerts for select to authenticated
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "alerts_insert_own"
  on public.alerts for insert to authenticated
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "alerts_update_own"
  on public.alerts for update to authenticated
  using (user_id in (select id from public.users where auth_user_id = auth.uid()))
  with check (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "alerts_delete_own"
  on public.alerts for delete to authenticated
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

-- notification_queue: el usuario puede ver las suyas; escritura la hace el backend
create policy "notification_queue_select_own"
  on public.notification_queue for select to authenticated
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

revoke all on table public.users from public;
revoke all on table public.users from anon;
revoke all on table public.saved_searches from public;
revoke all on table public.saved_searches from anon;
revoke all on table public.alerts from public;
revoke all on table public.alerts from anon;
revoke all on table public.notification_queue from public;
revoke all on table public.notification_queue from anon;

grant select, insert, update on table public.users to authenticated;
grant select, insert, update, delete on table public.saved_searches to authenticated;
grant select, insert, update, delete on table public.alerts to authenticated;
grant select on table public.notification_queue to authenticated;
