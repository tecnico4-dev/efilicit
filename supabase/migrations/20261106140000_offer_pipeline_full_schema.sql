-- ADR 026 (ampliación): resto del modelo de oferta para /mis-licitaciones.
-- Local-first; Storage de ficheros sigue aplazado (solo columnas url / storage_path opcionales).

-- ---------------------------------------------------------------------------
-- Ajustes sobre tablas ya creadas
-- ---------------------------------------------------------------------------
alter table public.offer_cases
  add column if not exists target_lots jsonb not null default '[]'::jsonb;

comment on column public.offer_cases.target_lots is
  'Lotes a los que se licita (array JSON de {id, label} o textos). Vacío = expediente entero.';

alter table public.offer_requirements
  add column if not exists validated_by uuid references public.users (id) on delete set null,
  add column if not exists validated_at timestamptz;

comment on column public.offer_requirements.validated_by is
  'Quién validó un requisito propuesto (p. ej. por IA); null si sin validar.';

-- ---------------------------------------------------------------------------
-- Helper: RLS compartido is_app_user() (ya existe desde 023)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- offer_deliverables (sobres / memoria por criterio)
-- ---------------------------------------------------------------------------
create table public.offer_deliverables (
  id uuid primary key default gen_random_uuid(),
  offer_case_id uuid not null references public.offer_cases (id) on delete cascade,
  parent_id uuid references public.offer_deliverables (id) on delete cascade,
  envelope text
    check (
      envelope is null
      or envelope in ('A', 'B', 'C', 'requerimiento', 'ninguno')
    ),
  title text not null,
  status text not null default 'pendiente'
    check (
      status in ('pendiente', 'en_curso', 'en_revision', 'listo')
    ),
  owner_user_id uuid references public.users (id) on delete set null,
  owner_name text,
  due_at timestamptz,
  points_max numeric(8, 2),
  page_limit int,
  final_copy_url text,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.offer_deliverables is
  'Entregables por sobre; parent_id para secciones de memoria técnica.';

create index offer_deliverables_case_idx
  on public.offer_deliverables (offer_case_id, sort_order, created_at);

create or replace function public.offer_deliverables_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger offer_deliverables_set_updated_at
  before update on public.offer_deliverables
  for each row
  execute function public.offer_deliverables_set_updated_at();

alter table public.offer_deliverables enable row level security;

create policy "offer_deliverables_select_app_user"
  on public.offer_deliverables for select to authenticated
  using (public.is_app_user());
create policy "offer_deliverables_insert_app_user"
  on public.offer_deliverables for insert to authenticated
  with check (public.is_app_user());
create policy "offer_deliverables_update_app_user"
  on public.offer_deliverables for update to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());
create policy "offer_deliverables_delete_app_user"
  on public.offer_deliverables for delete to authenticated
  using (public.is_app_user());

revoke all on table public.offer_deliverables from public, anon;
grant select, insert, update, delete on table public.offer_deliverables to authenticated;

-- N:M requisito ↔ entregable
create table public.offer_requirement_deliverables (
  requirement_id uuid not null references public.offer_requirements (id) on delete cascade,
  deliverable_id uuid not null references public.offer_deliverables (id) on delete cascade,
  linked_at timestamptz not null default now(),
  primary key (requirement_id, deliverable_id)
);

alter table public.offer_requirement_deliverables enable row level security;

create policy "offer_requirement_deliverables_select_app_user"
  on public.offer_requirement_deliverables for select to authenticated
  using (public.is_app_user());
create policy "offer_requirement_deliverables_insert_app_user"
  on public.offer_requirement_deliverables for insert to authenticated
  with check (public.is_app_user());
create policy "offer_requirement_deliverables_delete_app_user"
  on public.offer_requirement_deliverables for delete to authenticated
  using (public.is_app_user());

revoke all on table public.offer_requirement_deliverables from public, anon;
grant select, insert, delete on table public.offer_requirement_deliverables to authenticated;

-- ---------------------------------------------------------------------------
-- Biblioteca de empresa
-- ---------------------------------------------------------------------------
create table public.company_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  doc_type text not null default 'otro'
    check (
      doc_type in (
        'deuc',
        'cert_aeat',
        'cert_tgss',
        'iae',
        'rolece',
        'poliza_rc',
        'iso',
        'poderes',
        'cv',
        'cert_buena_ejecucion',
        'aval',
        'otro'
      )
    ),
  issued_on date,
  expires_on date,
  url text,
  storage_path text,
  tags text[] not null default '{}',
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.company_documents is
  'Biblioteca documental de empresa para licitar (caducidad + enlace; Storage opcional).';

create index company_documents_expires_on_idx on public.company_documents (expires_on);
create index company_documents_tags_gin on public.company_documents using gin (tags);

create or replace function public.company_documents_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger company_documents_set_updated_at
  before update on public.company_documents
  for each row
  execute function public.company_documents_set_updated_at();

alter table public.company_documents enable row level security;

create policy "company_documents_select_app_user"
  on public.company_documents for select to authenticated
  using (public.is_app_user());
create policy "company_documents_insert_app_user"
  on public.company_documents for insert to authenticated
  with check (public.is_app_user());
create policy "company_documents_update_app_user"
  on public.company_documents for update to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());
create policy "company_documents_delete_app_user"
  on public.company_documents for delete to authenticated
  using (public.is_app_user());

revoke all on table public.company_documents from public, anon;
grant select, insert, update, delete on table public.company_documents to authenticated;

create table public.company_people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role_title text,
  degrees text,
  certifications text,
  years_experience numeric(5, 1),
  relevant_projects text,
  cv_url text,
  cv_updated_on date,
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.company_people is
  'Perfiles técnicos reutilizables (adscripción de medios / CVs).';

create or replace function public.company_people_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger company_people_set_updated_at
  before update on public.company_people
  for each row
  execute function public.company_people_set_updated_at();

alter table public.company_people enable row level security;

create policy "company_people_select_app_user"
  on public.company_people for select to authenticated
  using (public.is_app_user());
create policy "company_people_insert_app_user"
  on public.company_people for insert to authenticated
  with check (public.is_app_user());
create policy "company_people_update_app_user"
  on public.company_people for update to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());
create policy "company_people_delete_app_user"
  on public.company_people for delete to authenticated
  using (public.is_app_user());

revoke all on table public.company_people from public, anon;
grant select, insert, update, delete on table public.company_people to authenticated;

create table public.company_references (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  object_summary text not null,
  cpv_codes text[] not null default '{}',
  amount numeric(18, 2),
  currency text not null default 'EUR',
  year_from int,
  year_to int,
  certificate_url text,
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.company_references is
  'Trabajos ejecutados / certificados de buena ejecución (solvencia técnica).';

create or replace function public.company_references_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger company_references_set_updated_at
  before update on public.company_references
  for each row
  execute function public.company_references_set_updated_at();

alter table public.company_references enable row level security;

create policy "company_references_select_app_user"
  on public.company_references for select to authenticated
  using (public.is_app_user());
create policy "company_references_insert_app_user"
  on public.company_references for insert to authenticated
  with check (public.is_app_user());
create policy "company_references_update_app_user"
  on public.company_references for update to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());
create policy "company_references_delete_app_user"
  on public.company_references for delete to authenticated
  using (public.is_app_user());

revoke all on table public.company_references from public, anon;
grant select, insert, update, delete on table public.company_references to authenticated;

create table public.company_financials (
  id uuid primary key default gen_random_uuid(),
  fiscal_year int not null,
  annual_turnover numeric(18, 2) not null,
  currency text not null default 'EUR',
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fiscal_year)
);

comment on table public.company_financials is
  'Volumen de negocios por ejercicio (cálculo de solvencia económica).';

create or replace function public.company_financials_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger company_financials_set_updated_at
  before update on public.company_financials
  for each row
  execute function public.company_financials_set_updated_at();

alter table public.company_financials enable row level security;

create policy "company_financials_select_app_user"
  on public.company_financials for select to authenticated
  using (public.is_app_user());
create policy "company_financials_insert_app_user"
  on public.company_financials for insert to authenticated
  with check (public.is_app_user());
create policy "company_financials_update_app_user"
  on public.company_financials for update to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());
create policy "company_financials_delete_app_user"
  on public.company_financials for delete to authenticated
  using (public.is_app_user());

revoke all on table public.company_financials from public, anon;
grant select, insert, update, delete on table public.company_financials to authenticated;

-- ---------------------------------------------------------------------------
-- Evidencias de requisitos
-- ---------------------------------------------------------------------------
create table public.offer_requirement_evidence (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.offer_requirements (id) on delete cascade,
  evidence_kind text not null
    check (
      evidence_kind in (
        'document',
        'person',
        'reference',
        'financial',
        'url',
        'other'
      )
    ),
  document_id uuid references public.company_documents (id) on delete set null,
  person_id uuid references public.company_people (id) on delete set null,
  reference_id uuid references public.company_references (id) on delete set null,
  financial_id uuid references public.company_financials (id) on delete set null,
  url text,
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint offer_requirement_evidence_payload_chk check (
    document_id is not null
    or person_id is not null
    or reference_id is not null
    or financial_id is not null
    or (url is not null and btrim(url) <> '')
    or (notes is not null and btrim(notes) <> '')
  )
);

comment on table public.offer_requirement_evidence is
  'Evidencias ligadas a un requisito (doc/persona/referencia/financiero/URL).';

create index offer_requirement_evidence_req_idx
  on public.offer_requirement_evidence (requirement_id);

alter table public.offer_requirement_evidence enable row level security;

create policy "offer_requirement_evidence_select_app_user"
  on public.offer_requirement_evidence for select to authenticated
  using (public.is_app_user());
create policy "offer_requirement_evidence_insert_app_user"
  on public.offer_requirement_evidence for insert to authenticated
  with check (public.is_app_user());
create policy "offer_requirement_evidence_update_app_user"
  on public.offer_requirement_evidence for update to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());
create policy "offer_requirement_evidence_delete_app_user"
  on public.offer_requirement_evidence for delete to authenticated
  using (public.is_app_user());

revoke all on table public.offer_requirement_evidence from public, anon;
grant select, insert, update, delete on table public.offer_requirement_evidence to authenticated;

-- ---------------------------------------------------------------------------
-- Equipo del expediente + tareas sueltas + personal adscrito
-- ---------------------------------------------------------------------------
create table public.offer_case_members (
  id uuid primary key default gen_random_uuid(),
  offer_case_id uuid not null references public.offer_cases (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  member_role text not null default 'preparador'
    check (
      member_role in ('preparador', 'revisor', 'aprobador', 'otro')
    ),
  created_at timestamptz not null default now(),
  unique (offer_case_id, user_id)
);

comment on table public.offer_case_members is
  'Equipo que prepara la oferta (distinto del personal adscrito al contrato).';

create index offer_case_members_user_idx on public.offer_case_members (user_id);

alter table public.offer_case_members enable row level security;

create policy "offer_case_members_select_app_user"
  on public.offer_case_members for select to authenticated
  using (public.is_app_user());
create policy "offer_case_members_insert_app_user"
  on public.offer_case_members for insert to authenticated
  with check (public.is_app_user());
create policy "offer_case_members_update_app_user"
  on public.offer_case_members for update to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());
create policy "offer_case_members_delete_app_user"
  on public.offer_case_members for delete to authenticated
  using (public.is_app_user());

revoke all on table public.offer_case_members from public, anon;
grant select, insert, update, delete on table public.offer_case_members to authenticated;

create table public.offer_tasks (
  id uuid primary key default gen_random_uuid(),
  offer_case_id uuid not null references public.offer_cases (id) on delete cascade,
  title text not null,
  owner_user_id uuid references public.users (id) on delete set null,
  owner_name text,
  due_at timestamptz,
  done_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.offer_tasks is
  'Tareas sueltas del expediente (no son requisito ni entregable).';

create index offer_tasks_case_idx on public.offer_tasks (offer_case_id, due_at);

create or replace function public.offer_tasks_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger offer_tasks_set_updated_at
  before update on public.offer_tasks
  for each row
  execute function public.offer_tasks_set_updated_at();

alter table public.offer_tasks enable row level security;

create policy "offer_tasks_select_app_user"
  on public.offer_tasks for select to authenticated
  using (public.is_app_user());
create policy "offer_tasks_insert_app_user"
  on public.offer_tasks for insert to authenticated
  with check (public.is_app_user());
create policy "offer_tasks_update_app_user"
  on public.offer_tasks for update to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());
create policy "offer_tasks_delete_app_user"
  on public.offer_tasks for delete to authenticated
  using (public.is_app_user());

revoke all on table public.offer_tasks from public, anon;
grant select, insert, update, delete on table public.offer_tasks to authenticated;

create table public.offer_assigned_people (
  id uuid primary key default gen_random_uuid(),
  offer_case_id uuid not null references public.offer_cases (id) on delete cascade,
  person_id uuid references public.company_people (id) on delete set null,
  required_profile text,
  compliance_status text not null default 'sin_verificar'
    check (
      compliance_status in (
        'cumple',
        'parcial',
        'no_cumple',
        'sin_verificar',
        'no_aplica'
      )
    ),
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.offer_assigned_people is
  'Personal adscrito al contrato (adscripción de medios), distinto del equipo preparador.';

create index offer_assigned_people_case_idx
  on public.offer_assigned_people (offer_case_id);

alter table public.offer_assigned_people enable row level security;

create policy "offer_assigned_people_select_app_user"
  on public.offer_assigned_people for select to authenticated
  using (public.is_app_user());
create policy "offer_assigned_people_insert_app_user"
  on public.offer_assigned_people for insert to authenticated
  with check (public.is_app_user());
create policy "offer_assigned_people_update_app_user"
  on public.offer_assigned_people for update to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());
create policy "offer_assigned_people_delete_app_user"
  on public.offer_assigned_people for delete to authenticated
  using (public.is_app_user());

revoke all on table public.offer_assigned_people from public, anon;
grant select, insert, update, delete on table public.offer_assigned_people to authenticated;

-- ---------------------------------------------------------------------------
-- Calendario / hitos
-- ---------------------------------------------------------------------------
create table public.offer_milestones (
  id uuid primary key default gen_random_uuid(),
  offer_case_id uuid not null references public.offer_cases (id) on delete cascade,
  kind text not null
    check (kind in ('oficial', 'interno')),
  code text,
  title text not null,
  due_at timestamptz,
  completed_at timestamptz,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.offer_milestones is
  'Hitos oficiales e internos del expediente (calendario / plazos).';

create index offer_milestones_case_idx
  on public.offer_milestones (offer_case_id, due_at);

create or replace function public.offer_milestones_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger offer_milestones_set_updated_at
  before update on public.offer_milestones
  for each row
  execute function public.offer_milestones_set_updated_at();

alter table public.offer_milestones enable row level security;

create policy "offer_milestones_select_app_user"
  on public.offer_milestones for select to authenticated
  using (public.is_app_user());
create policy "offer_milestones_insert_app_user"
  on public.offer_milestones for insert to authenticated
  with check (public.is_app_user());
create policy "offer_milestones_update_app_user"
  on public.offer_milestones for update to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());
create policy "offer_milestones_delete_app_user"
  on public.offer_milestones for delete to authenticated
  using (public.is_app_user());

revoke all on table public.offer_milestones from public, anon;
grant select, insert, update, delete on table public.offer_milestones to authenticated;

-- ---------------------------------------------------------------------------
-- Pliegos del expediente + fuentes de información
-- ---------------------------------------------------------------------------
create table public.offer_case_pliegos (
  id uuid primary key default gen_random_uuid(),
  offer_case_id uuid not null references public.offer_cases (id) on delete cascade,
  pliego_type text not null
    check (
      pliego_type in (
        'pcap',
        'ppt',
        'anexo',
        'modelo',
        'aclaracion',
        'anuncio',
        'rectificacion',
        'otro'
      )
    ),
  title text not null,
  url text,
  version_label text,
  published_on date,
  changed_after_case boolean not null default false,
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.offer_case_pliegos is
  'Documentación oficial del expediente (PCAP/PPT/anexos…); enlace o subida manual.';

create index offer_case_pliegos_case_idx on public.offer_case_pliegos (offer_case_id);

create or replace function public.offer_case_pliegos_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger offer_case_pliegos_set_updated_at
  before update on public.offer_case_pliegos
  for each row
  execute function public.offer_case_pliegos_set_updated_at();

alter table public.offer_case_pliegos enable row level security;

create policy "offer_case_pliegos_select_app_user"
  on public.offer_case_pliegos for select to authenticated
  using (public.is_app_user());
create policy "offer_case_pliegos_insert_app_user"
  on public.offer_case_pliegos for insert to authenticated
  with check (public.is_app_user());
create policy "offer_case_pliegos_update_app_user"
  on public.offer_case_pliegos for update to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());
create policy "offer_case_pliegos_delete_app_user"
  on public.offer_case_pliegos for delete to authenticated
  using (public.is_app_user());

revoke all on table public.offer_case_pliegos from public, anon;
grant select, insert, update, delete on table public.offer_case_pliegos to authenticated;

create table public.offer_sources (
  id uuid primary key default gen_random_uuid(),
  offer_case_id uuid not null references public.offer_cases (id) on delete cascade,
  source_type text not null
    check (
      source_type in (
        'pliego',
        'oferta_anterior',
        'documento_empresa',
        'web',
        'normativa',
        'dato_interno',
        'otro'
      )
    ),
  title text not null,
  url text,
  company_document_id uuid references public.company_documents (id) on delete set null,
  pliego_id uuid references public.offer_case_pliegos (id) on delete set null,
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.offer_sources is
  'Fuentes usadas para preparar la oferta (trazabilidad).';

create index offer_sources_case_idx on public.offer_sources (offer_case_id);

alter table public.offer_sources enable row level security;

create policy "offer_sources_select_app_user"
  on public.offer_sources for select to authenticated
  using (public.is_app_user());
create policy "offer_sources_insert_app_user"
  on public.offer_sources for insert to authenticated
  with check (public.is_app_user());
create policy "offer_sources_update_app_user"
  on public.offer_sources for update to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());
create policy "offer_sources_delete_app_user"
  on public.offer_sources for delete to authenticated
  using (public.is_app_user());

revoke all on table public.offer_sources from public, anon;
grant select, insert, update, delete on table public.offer_sources to authenticated;

create table public.offer_source_links (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.offer_sources (id) on delete cascade,
  requirement_id uuid references public.offer_requirements (id) on delete cascade,
  deliverable_id uuid references public.offer_deliverables (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint offer_source_links_target_chk check (
    requirement_id is not null or deliverable_id is not null
  )
);

comment on table public.offer_source_links is
  'Vínculo fuente ↔ requisito y/o sección/entregable.';

create index offer_source_links_source_idx on public.offer_source_links (source_id);

alter table public.offer_source_links enable row level security;

create policy "offer_source_links_select_app_user"
  on public.offer_source_links for select to authenticated
  using (public.is_app_user());
create policy "offer_source_links_insert_app_user"
  on public.offer_source_links for insert to authenticated
  with check (public.is_app_user());
create policy "offer_source_links_delete_app_user"
  on public.offer_source_links for delete to authenticated
  using (public.is_app_user());

revoke all on table public.offer_source_links from public, anon;
grant select, insert, delete on table public.offer_source_links to authenticated;

-- ---------------------------------------------------------------------------
-- Bitácora tipada
-- ---------------------------------------------------------------------------
create table public.offer_case_log (
  id uuid primary key default gen_random_uuid(),
  offer_case_id uuid not null references public.offer_cases (id) on delete cascade,
  event_type text not null
    check (
      event_type in (
        'stage_change',
        'go_decision',
        'aclaracion',
        'rectificacion',
        'ampliacion_plazo',
        'requerimiento',
        'subsanacion',
        'requirement_change',
        'comentario',
        'otro'
      )
    ),
  body text not null,
  happened_on date not null default ((timezone('Europe/Madrid', now()))::date),
  created_by uuid references public.users (id) on delete set null,
  related_requirement_id uuid references public.offer_requirements (id) on delete set null,
  related_deliverable_id uuid references public.offer_deliverables (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.offer_case_log is
  'Bitácora del expediente (cambios de etapa, novedades del órgano, comentarios).';

create index offer_case_log_case_idx
  on public.offer_case_log (offer_case_id, happened_on desc, created_at desc);

alter table public.offer_case_log enable row level security;

create policy "offer_case_log_select_app_user"
  on public.offer_case_log for select to authenticated
  using (public.is_app_user());
create policy "offer_case_log_insert_app_user"
  on public.offer_case_log for insert to authenticated
  with check (public.is_app_user());
create policy "offer_case_log_update_app_user"
  on public.offer_case_log for update to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());
create policy "offer_case_log_delete_app_user"
  on public.offer_case_log for delete to authenticated
  using (public.is_app_user());

revoke all on table public.offer_case_log from public, anon;
grant select, insert, update, delete on table public.offer_case_log to authenticated;
