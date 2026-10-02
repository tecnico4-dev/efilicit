-- Semana 1 / Paso 2: núcleo canónico mínimo.
-- La web consume estas tablas; las fuentes no crean modelos propios.
-- Columnas ampliables en Semana 2+ vía migraciones cuando PLACSP lo exija.
--
-- Lectura: SELECT público (anon + authenticated). Escritura: solo ETL / service_role.
-- Ver ADR 003.

-- ---------------------------------------------------------------------------
-- contracting_authorities — quién compra (organismos)
-- ---------------------------------------------------------------------------
create table public.contracting_authorities (
  id uuid primary key default gen_random_uuid(),
  tax_id text,
  tax_id_country text not null default 'ES',
  name text not null,
  name_normalized text,
  identity_confidence text not null default 'UNRESOLVED'
    check (identity_confidence in ('HIGH', 'MEDIUM', 'LOW', 'UNRESOLVED')),
  municipality text,
  country text not null default 'ES',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contracting_authorities is
  'Organismos contratantes canónicos. tax_id (NIF/CIF) es señal primaria cuando existe.';

comment on column public.contracting_authorities.tax_id is
  'Identificador fiscal (NIF/CIF u equivalente). Nunca usar solo el nombre como identidad.';

comment on column public.contracting_authorities.identity_confidence is
  'Confianza de la resolución de identidad: HIGH | MEDIUM | LOW | UNRESOLVED.';

create unique index contracting_authorities_tax_id_country_uidx
  on public.contracting_authorities (tax_id_country, tax_id)
  where tax_id is not null;

create index contracting_authorities_name_normalized_idx
  on public.contracting_authorities (name_normalized);

-- ---------------------------------------------------------------------------
-- suppliers — empresas / adjudicatarios
-- ---------------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tax_id text,
  tax_id_country text not null default 'ES',
  name text not null,
  name_normalized text,
  identity_confidence text not null default 'UNRESOLVED'
    check (identity_confidence in ('HIGH', 'MEDIUM', 'LOW', 'UNRESOLVED')),
  municipality text,
  country text not null default 'ES',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.suppliers is
  'Proveedores/adjudicatarios canónicos. Misma regla de identidad fiscal que organismos.';

create unique index suppliers_tax_id_country_uidx
  on public.suppliers (tax_id_country, tax_id)
  where tax_id is not null;

create index suppliers_name_normalized_idx
  on public.suppliers (name_normalized);

-- ---------------------------------------------------------------------------
-- tenders — licitación canónica (una fila = una oportunidad unificada)
-- ---------------------------------------------------------------------------
create table public.tenders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text,
  procedure_type text,
  contract_type text,
  estimated_value numeric(18, 2),
  currency text not null default 'EUR',
  cpv_code text,
  publication_date date,
  deadline_at timestamptz,
  contracting_authority_id uuid references public.contracting_authorities (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tenders is
  'Licitaciones canónicas. La aplicación lee de aquí, no de formatos de fuente.';

comment on column public.tenders.cpv_code is
  'Código CPV principal (catálogo completo aplazado). Nullable en Semana 1.';

comment on column public.tenders.estimated_value is
  'Importe estimado en la moneda de currency (por defecto EUR).';

create index tenders_contracting_authority_id_idx
  on public.tenders (contracting_authority_id);

create index tenders_publication_date_idx
  on public.tenders (publication_date desc nulls last);

create index tenders_deadline_at_idx
  on public.tenders (deadline_at);

create index tenders_status_idx
  on public.tenders (status);

create index tenders_cpv_code_idx
  on public.tenders (cpv_code);

create index tenders_estimated_value_idx
  on public.tenders (estimated_value);

-- ---------------------------------------------------------------------------
-- tender_sources — esta licitación canónica vista en una fuente concreta
-- ---------------------------------------------------------------------------
create table public.tender_sources (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders (id) on delete cascade,
  source_code text not null,
  source_tender_id text not null,
  source_url text,
  artifact_id uuid references public.source_artifacts (id) on delete set null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source_code, source_tender_id)
);

comment on table public.tender_sources is
  'Enlace multi-fuente: upsert idempotente por (source_code, source_tender_id).';

comment on column public.tender_sources.source_tender_id is
  'Identificador de la licitación en la fuente origen (no confundir con tenders.id).';

create index tender_sources_tender_id_idx
  on public.tender_sources (tender_id);

create index tender_sources_artifact_id_idx
  on public.tender_sources (artifact_id);

-- ---------------------------------------------------------------------------
-- tender_events — historial / línea temporal
-- ---------------------------------------------------------------------------
create table public.tender_events (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders (id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  source_code text,
  payload jsonb,
  created_at timestamptz not null default now()
);

comment on table public.tender_events is
  'Eventos de ciclo de vida (publicada, adjudicada, cancelada, etc.).';

create index tender_events_tender_id_occurred_at_idx
  on public.tender_events (tender_id, occurred_at desc);

create index tender_events_event_type_idx
  on public.tender_events (event_type);

-- ---------------------------------------------------------------------------
-- documents — metadatos/enlaces de documentos (el binario RAW va a Storage)
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders (id) on delete cascade,
  title text,
  document_type text,
  url text,
  source_code text,
  artifact_id uuid references public.source_artifacts (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.documents is
  'Metadatos de documentos de licitación. Ficheros originales: Storage RAW + source_artifacts.';

create index documents_tender_id_idx
  on public.documents (tender_id);

create index documents_artifact_id_idx
  on public.documents (artifact_id);

-- ---------------------------------------------------------------------------
-- RLS: datos de contratación pública — lectura para anon/authenticated;
-- escritura solo vía service_role (ingesta / procesos confiables).
-- ---------------------------------------------------------------------------
alter table public.contracting_authorities enable row level security;
alter table public.suppliers enable row level security;
alter table public.tenders enable row level security;
alter table public.tender_sources enable row level security;
alter table public.tender_events enable row level security;
alter table public.documents enable row level security;

create policy "contracting_authorities_select_public"
  on public.contracting_authorities for select to anon, authenticated using (true);

create policy "suppliers_select_public"
  on public.suppliers for select to anon, authenticated using (true);

create policy "tenders_select_public"
  on public.tenders for select to anon, authenticated using (true);

create policy "tender_sources_select_public"
  on public.tender_sources for select to anon, authenticated using (true);

create policy "tender_events_select_public"
  on public.tender_events for select to anon, authenticated using (true);

create policy "documents_select_public"
  on public.documents for select to anon, authenticated using (true);

revoke all on table public.contracting_authorities from public;
revoke all on table public.suppliers from public;
revoke all on table public.tenders from public;
revoke all on table public.tender_sources from public;
revoke all on table public.tender_events from public;
revoke all on table public.documents from public;

grant select on table public.contracting_authorities to anon, authenticated;
grant select on table public.suppliers to anon, authenticated;
grant select on table public.tenders to anon, authenticated;
grant select on table public.tender_sources to anon, authenticated;
grant select on table public.tender_events to anon, authenticated;
grant select on table public.documents to anon, authenticated;
