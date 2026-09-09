-- Fase 0 / Paso 8: Storage RAW + RLS smoke (local only).
-- Not the canonical tenders model (Semana 1). This only proves Storage policies and RLS wiring.

-- ---------------------------------------------------------------------------
-- Storage: private bucket for immutable RAW artifacts
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('raw', 'raw', false, null, null)
on conflict (id) do nothing;

-- No policies grant anon/authenticated any access to bucket "raw".
-- With RLS on storage.objects, that means client roles cannot read/write RAW.
-- Trusted ingestion uses the service role (bypasses Storage RLS).

-- ---------------------------------------------------------------------------
-- RLS smoke table (synthetic; not product schema)
-- ---------------------------------------------------------------------------
create table public.setup_rls_smoke (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

comment on table public.setup_rls_smoke is
  'Fase 0 only: proves RLS locally. Replace/remove when Semana 1 canonical model lands.';

alter table public.setup_rls_smoke enable row level security;

create policy "setup_rls_smoke_select_own"
on public.setup_rls_smoke
for select
to authenticated
using (owner_id = auth.uid());

create policy "setup_rls_smoke_insert_own"
on public.setup_rls_smoke
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "setup_rls_smoke_update_own"
on public.setup_rls_smoke
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "setup_rls_smoke_delete_own"
on public.setup_rls_smoke
for delete
to authenticated
using (owner_id = auth.uid());

revoke all on table public.setup_rls_smoke from public;
revoke all on table public.setup_rls_smoke from anon;
grant select, insert, update, delete on table public.setup_rls_smoke to authenticated;
