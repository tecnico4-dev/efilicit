-- Semana 1 / Paso 1: operational ingestion tables (not the canonical tenders model yet).
-- source_sync = bitácora de cada ejecución de una fuente.
-- source_artifacts = registro de cada fichero/artefacto (checksum + ruta RAW).
-- errors = errores operativos clasificables vinculados a sync/artifact cuando aplique.

-- ---------------------------------------------------------------------------
-- source_sync
-- ---------------------------------------------------------------------------
create table public.source_sync (
  id uuid primary key default gen_random_uuid(),
  source_code text not null,
  run_id text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'success', 'failed', 'partial')),
  cursor text,
  last_artifact text,
  checksum text,
  records_seen integer not null default 0 check (records_seen >= 0),
  records_new integer not null default 0 check (records_new >= 0),
  records_updated integer not null default 0 check (records_updated >= 0),
  records_failed integer not null default 0 check (records_failed >= 0),
  error_message text,
  created_at timestamptz not null default now(),
  unique (source_code, run_id)
);

comment on table public.source_sync is
  'Estado y contadores de cada ejecución de sincronización por fuente.';

create index source_sync_source_code_started_at_idx
  on public.source_sync (source_code, started_at desc);

create index source_sync_status_idx
  on public.source_sync (status);

-- ---------------------------------------------------------------------------
-- source_artifacts
-- ---------------------------------------------------------------------------
create table public.source_artifacts (
  id uuid primary key default gen_random_uuid(),
  source_code text not null,
  sync_id uuid references public.source_sync (id) on delete set null,
  artifact_key text not null,
  storage_path text,
  checksum text not null,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  content_type text,
  source_url text,
  downloaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source_code, artifact_key),
  unique (source_code, checksum)
);

comment on table public.source_artifacts is
  'Artefactos descargados: trazabilidad a Storage RAW vía storage_path y checksum.';

create index source_artifacts_source_code_downloaded_at_idx
  on public.source_artifacts (source_code, downloaded_at desc);

create index source_artifacts_sync_id_idx
  on public.source_artifacts (sync_id);

-- ---------------------------------------------------------------------------
-- errors
-- ---------------------------------------------------------------------------
create table public.errors (
  id uuid primary key default gen_random_uuid(),
  source_code text,
  sync_id uuid references public.source_sync (id) on delete set null,
  artifact_id uuid references public.source_artifacts (id) on delete set null,
  error_class text not null default 'unknown',
  message text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

comment on table public.errors is
  'Errores operativos de ingesta (clasificados); enlazables a sync y/o artifact.';

create index errors_source_code_created_at_idx
  on public.errors (source_code, created_at desc);

create index errors_sync_id_idx
  on public.errors (sync_id);

create index errors_error_class_idx
  on public.errors (error_class);

-- ---------------------------------------------------------------------------
-- RLS: tablas operativas de ETL — sin acceso para anon/authenticated.
-- La ingesta confiable usa service_role (bypassa RLS).
-- ---------------------------------------------------------------------------
alter table public.source_sync enable row level security;
alter table public.source_artifacts enable row level security;
alter table public.errors enable row level security;

revoke all on table public.source_sync from public;
revoke all on table public.source_sync from anon;
revoke all on table public.source_sync from authenticated;

revoke all on table public.source_artifacts from public;
revoke all on table public.source_artifacts from anon;
revoke all on table public.source_artifacts from authenticated;

revoke all on table public.errors from public;
revoke all on table public.errors from anon;
revoke all on table public.errors from authenticated;
