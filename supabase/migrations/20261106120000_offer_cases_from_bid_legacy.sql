-- ADR 026: expediente de oferta (offer_*) + backfill desde bid_cases (legacy 023).
-- Local-first; no asumir push a remoto sin OK explícito (misma nota operativa que 023).
--
-- is_app_user: 20261030130100 la dropea en reset limpio; se recrea aquí antes del RLS.
-- Backfill bid_*: solo si las tablas legacy existen (tras rollback pueden no estar).

-- ---------------------------------------------------------------------------
-- RLS helper (pipeline compartido invite-only)
-- ---------------------------------------------------------------------------
create or replace function public.is_app_user()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where auth_user_id = (select auth.uid())
  );
$$;

comment on function public.is_app_user() is
  'True si auth.uid() tiene fila en public.users (invite-only). Usado por RLS del pipeline compartido offer_*/company_*.';

revoke all on function public.is_app_user() from public;
grant execute on function public.is_app_user() to authenticated;

-- ---------------------------------------------------------------------------
-- offer_cases
-- ---------------------------------------------------------------------------
create table public.offer_cases (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders (id) on delete cascade,
  stage text not null default 'interes'
    check (
      stage in (
        'interes',
        'analisis',
        'preparacion',
        'presentada',
        'en_evaluacion',
        'requerimiento',
        'adjudicada',
        'no_adjudicada',
        'descartada',
        'subcontrata',
        'desierta'
      )
    ),
  owner_name text,
  owner_user_id uuid references public.users (id) on delete set null,
  preparation_started_on date,
  presented_on date,
  outcome_on date,
  internal_deadline_at timestamptz,
  notes text,
  go_decision text
    check (
      go_decision is null
      or go_decision in ('go', 'no_go', 'pending')
    ),
  go_decided_at timestamptz,
  go_decided_by uuid references public.users (id) on delete set null,
  go_reason text,
  discard_reason text,
  legacy_bid_case_id uuid unique,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tender_id)
);

comment on table public.offer_cases is
  'ADR 026: expediente de oferta Eficen (pipeline compartido). Una fila por licitación canónica.';

comment on column public.offer_cases.stage is
  'Activas: interes|analisis|preparacion|presentada|en_evaluacion|requerimiento. Histórico: adjudicada|no_adjudicada|descartada|subcontrata|desierta.';

comment on column public.offer_cases.legacy_bid_case_id is
  'Origen en bid_cases tras backfill; null si el expediente nació ya en offer_cases.';

create index offer_cases_stage_idx on public.offer_cases (stage);
create index offer_cases_presented_on_idx on public.offer_cases (presented_on desc nulls last);
create index offer_cases_outcome_on_idx on public.offer_cases (outcome_on desc nulls last);
create index offer_cases_updated_at_idx on public.offer_cases (updated_at desc);

create or replace function public.offer_cases_set_updated_at()
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

create trigger offer_cases_set_updated_at
  before update on public.offer_cases
  for each row
  execute function public.offer_cases_set_updated_at();

alter table public.offer_cases enable row level security;

create policy "offer_cases_select_app_user"
  on public.offer_cases for select to authenticated
  using (public.is_app_user());

create policy "offer_cases_insert_app_user"
  on public.offer_cases for insert to authenticated
  with check (public.is_app_user());

create policy "offer_cases_update_app_user"
  on public.offer_cases for update to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());

create policy "offer_cases_delete_app_user"
  on public.offer_cases for delete to authenticated
  using (public.is_app_user());

revoke all on table public.offer_cases from public;
revoke all on table public.offer_cases from anon;
grant select, insert, update, delete on table public.offer_cases to authenticated;

-- ---------------------------------------------------------------------------
-- offer_requirements
-- ---------------------------------------------------------------------------
create table public.offer_requirements (
  id uuid primary key default gen_random_uuid(),
  offer_case_id uuid not null references public.offer_cases (id) on delete cascade,
  title text not null,
  literal_text text,
  category text not null default 'otros'
    check (
      category in (
        'habilitacion',
        'solvencia_economica',
        'solvencia_tecnica',
        'clasificacion',
        'adscripcion_medios',
        'criterio_adjudicacion',
        'garantias',
        'administrativo',
        'otros'
      )
    ),
  requirement_type text not null default 'informativo'
    check (
      requirement_type in ('excluyente', 'puntuable', 'informativo')
    ),
  required_value text,
  our_value text,
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
  prep_status text not null default 'pendiente'
    check (
      prep_status in ('pendiente', 'en_curso', 'en_revision', 'listo')
    ),
  envelope text
    check (
      envelope is null
      or envelope in ('A', 'B', 'C', 'requerimiento', 'ninguno')
    ),
  owner_user_id uuid references public.users (id) on delete set null,
  owner_name text,
  internal_due_at timestamptz,
  pliego_ref text,
  source_kind text not null default 'manual'
    check (source_kind in ('plantilla', 'manual', 'ia', 'legacy_checklist')),
  sort_order int not null default 0,
  legacy_checklist_item_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.offer_requirements is
  'ADR 026: matriz de requisitos del expediente (cumplimiento × preparación).';

create index offer_requirements_case_idx
  on public.offer_requirements (offer_case_id, sort_order, created_at);

create or replace function public.offer_requirements_set_updated_at()
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

create trigger offer_requirements_set_updated_at
  before update on public.offer_requirements
  for each row
  execute function public.offer_requirements_set_updated_at();

alter table public.offer_requirements enable row level security;

create policy "offer_requirements_select_app_user"
  on public.offer_requirements for select to authenticated
  using (public.is_app_user());

create policy "offer_requirements_insert_app_user"
  on public.offer_requirements for insert to authenticated
  with check (public.is_app_user());

create policy "offer_requirements_update_app_user"
  on public.offer_requirements for update to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());

create policy "offer_requirements_delete_app_user"
  on public.offer_requirements for delete to authenticated
  using (public.is_app_user());

revoke all on table public.offer_requirements from public;
revoke all on table public.offer_requirements from anon;
grant select, insert, update, delete on table public.offer_requirements to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill desde legacy bid_* (no-op si ya dropeadas)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.bid_cases') is null then
    raise notice 'bid_cases ausente — omito backfill offer_cases';
    return;
  end if;

  insert into public.offer_cases (
    id,
    tender_id,
    stage,
    owner_name,
    preparation_started_on,
    presented_on,
    outcome_on,
    notes,
    legacy_bid_case_id,
    created_by,
    created_at,
    updated_at
  )
  select
    bc.id,
    bc.tender_id,
    bc.stage,
    bc.owner_name,
    bc.preparation_started_on,
    bc.presented_on,
    bc.outcome_on,
    bc.notes,
    bc.id,
    bc.created_by,
    bc.created_at,
    bc.updated_at
  from public.bid_cases bc
  on conflict (tender_id) do nothing;

  if to_regclass('public.bid_case_checklist_items') is null then
    raise notice 'bid_case_checklist_items ausente — omito backfill offer_requirements';
    return;
  end if;

  insert into public.offer_requirements (
    id,
    offer_case_id,
    title,
    category,
    requirement_type,
    compliance_status,
    prep_status,
    internal_due_at,
    source_kind,
    sort_order,
    legacy_checklist_item_id,
    created_at,
    updated_at
  )
  select
    ci.id,
    ci.bid_case_id,
    ci.title,
    'otros',
    'informativo',
    'sin_verificar',
    case when ci.done_at is not null then 'listo' else 'pendiente' end,
    ci.due_at,
    'legacy_checklist',
    ci.sort_order,
    ci.id,
    ci.created_at,
    coalesce(ci.done_at, ci.created_at)
  from public.bid_case_checklist_items ci
  inner join public.offer_cases oc on oc.id = ci.bid_case_id
  on conflict (id) do nothing;
end;
$$;
