-- Fase 0 / Paso 8 — cimientos de Storage + prueba de RLS.
--
-- Esta migración NO define el modelo canónico de licitaciones (eso es Semana 1).
-- Solo deja listo:
--   1) el bucket privado `raw` donde la ingesta guardará artefactos inmutables;
--   2) una tabla mínima para demostrar que RLS owner-only funciona en local.
--
-- Remoto greenfield: historial alineado con `db push` (ver ADR 002).

-- ---------------------------------------------------------------------------
-- Storage: bucket privado `raw`
-- ---------------------------------------------------------------------------
-- Convención del producto: el navegador NUNCA lee/escribe RAW.
-- Sin políticas para anon/authenticated + RLS en storage.objects ⇒ denegado.
-- La ingesta confiable usa service_role (salta RLS de Storage a propósito).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('raw', 'raw', false, null, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Tabla smoke de RLS (datos sintéticos; no es esquema de producto)
-- ---------------------------------------------------------------------------
-- Sirve para el checklist de Auth/RLS: usuario A no ve filas de usuario B.
-- Semana 1 en adelante decidió mantenerla junto al canónico (útil en local/Studio).

create table public.setup_rls_smoke (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

comment on table public.setup_rls_smoke is
  'Fase 0: tabla de prueba RLS (owner_id = auth.uid()). No es dominio de licitaciones.';

alter table public.setup_rls_smoke enable row level security;

-- Políticas owner-only: solo el dueño de la fila puede SELECT/INSERT/UPDATE/DELETE.
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

-- Cierre de privilegios: anon no toca la tabla; authenticated solo vía políticas.
revoke all on table public.setup_rls_smoke from public;
revoke all on table public.setup_rls_smoke from anon;
grant select, insert, update, delete on table public.setup_rls_smoke to authenticated;
