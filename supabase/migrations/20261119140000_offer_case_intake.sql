-- ADR 035: intake de pliegos del expediente (PLACSP).
-- Cola offer_case_intake, columnas de trazabilidad/idempotencia en offer_*,
-- bucket privado offer-docs. Local-first.

-- ---------------------------------------------------------------------------
-- 1) Cola de intake
-- ---------------------------------------------------------------------------
create table public.offer_case_intake (
  id uuid primary key default gen_random_uuid(),
  offer_case_id uuid not null references public.offer_cases (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed')),
  attempts int not null default 0,
  last_error text,
  stats jsonb not null default '{}'::jsonb,
  requested_by uuid references public.users (id) on delete set null,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

comment on table public.offer_case_intake is
  'Trabajos de intake de pliegos por expediente (ADR 035). Web inserta pending; worker batch procesa.';

create unique index offer_case_intake_one_open_idx
  on public.offer_case_intake (offer_case_id)
  where status in ('pending', 'processing');

create index offer_case_intake_status_idx
  on public.offer_case_intake (status, requested_at);

create index offer_case_intake_case_idx
  on public.offer_case_intake (offer_case_id, requested_at desc);

alter table public.offer_case_intake enable row level security;

create policy "offer_case_intake_select_app_user"
  on public.offer_case_intake for select to authenticated
  using (public.is_app_user());

create policy "offer_case_intake_insert_app_user"
  on public.offer_case_intake for insert to authenticated
  with check (
    public.is_app_user()
    and status = 'pending'
    and attempts = 0
    and started_at is null
    and finished_at is null
  );

revoke all on table public.offer_case_intake from public, anon;
grant select, insert on table public.offer_case_intake to authenticated;

-- ---------------------------------------------------------------------------
-- 2) offer_case_pliegos: fichero en Storage + origen
-- ---------------------------------------------------------------------------
alter table public.offer_case_pliegos
  add column if not exists source_key text,
  add column if not exists source_uri text,
  add column if not exists source_hash text,
  add column if not exists storage_path text,
  add column if not exists checksum text,
  add column if not exists byte_size bigint,
  add column if not exists content_type text,
  add column if not exists fetch_status text
    check (
      fetch_status is null
      or fetch_status in ('pendiente', 'descargado', 'solo_enlace', 'error')
    ),
  add column if not exists fetch_error text,
  add column if not exists fetched_at timestamptz;

comment on column public.offer_case_pliegos.source_key is
  'Clave estable del documento en la fuente (intake idempotente). Null = alta manual.';
comment on column public.offer_case_pliegos.storage_path is
  'Ruta en bucket offer-docs ({offer_case_id}/{sha256}.{ext}). Null = solo enlace.';

alter table public.offer_case_pliegos
  add constraint offer_case_pliegos_case_source_key_key
  unique (offer_case_id, source_key);

-- ---------------------------------------------------------------------------
-- 3) offer_requirements: origen pliego_xml + trazabilidad
-- ---------------------------------------------------------------------------
alter table public.offer_requirements
  drop constraint if exists offer_requirements_source_kind_check;

alter table public.offer_requirements
  add constraint offer_requirements_source_kind_check
  check (
    source_kind in ('plantilla', 'manual', 'ia', 'legacy_checklist', 'pliego_xml')
  );

alter table public.offer_requirements
  add column if not exists source_key text,
  add column if not exists pliego_id uuid;

alter table public.offer_requirements
  add constraint offer_requirements_case_source_key_key
  unique (offer_case_id, source_key);

alter table public.offer_requirements
  add constraint offer_requirements_pliego_case_fkey
  foreign key (pliego_id, offer_case_id)
  references public.offer_case_pliegos (id, offer_case_id)
  on delete set null (pliego_id);

create index if not exists offer_requirements_pliego_idx
  on public.offer_requirements (pliego_id)
  where pliego_id is not null;

comment on column public.offer_requirements.source_key is
  'Clave estable del requisito en la fuente (intake idempotente). Null = alta manual.';

-- ---------------------------------------------------------------------------
-- 4) offer_deliverables / offer_milestones: idempotencia del intake
-- ---------------------------------------------------------------------------
alter table public.offer_deliverables
  add column if not exists source_key text;

alter table public.offer_deliverables
  add constraint offer_deliverables_case_source_key_key
  unique (offer_case_id, source_key);

alter table public.offer_milestones
  add column if not exists source_key text;

alter table public.offer_milestones
  add constraint offer_milestones_case_source_key_key
  unique (offer_case_id, source_key);

-- ---------------------------------------------------------------------------
-- 5) Storage: bucket privado offer-docs (lectura app users; escritura worker)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('offer-docs', 'offer-docs', false, 52428800, null)
on conflict (id) do nothing;

drop policy if exists "offer_docs_select_app_user" on storage.objects;
create policy "offer_docs_select_app_user"
  on storage.objects for select to authenticated
  using (bucket_id = 'offer-docs' and public.is_app_user());
