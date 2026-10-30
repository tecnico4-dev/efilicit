-- Mis licitaciones: pipeline de presentación compartido (Eficen).
-- ADR 023. Distinto de favorites (seguimiento personal owner-only).

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
  'True si auth.uid() tiene fila en public.users (invite-only). Usado por RLS del pipeline compartido.';

revoke all on function public.is_app_user() from public;
grant execute on function public.is_app_user() to authenticated;

-- ---------------------------------------------------------------------------
-- bid_cases
-- ---------------------------------------------------------------------------
create table public.bid_cases (
  id uuid primary key default gen_random_uuid(),
  tender_id uuid not null references public.tenders (id) on delete cascade,
  stage text not null default 'interes'
    check (
      stage in (
        'interes',
        'preparacion',
        'presentada',
        'adjudicada',
        'no_adjudicada',
        'descartada'
      )
    ),
  owner_name text,
  preparation_started_on date,
  presented_on date,
  outcome_on date,
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tender_id)
);

comment on table public.bid_cases is
  'Pipeline de presentación Eficen (compartido). Una fila por licitación canónica.';

comment on column public.bid_cases.stage is
  'interes|preparacion|presentada (activas) · adjudicada|no_adjudicada|descartada (histórico).';

comment on column public.bid_cases.owner_name is
  'Responsable libre (texto). No exige listar public.users (RLS owner-only).';

create index bid_cases_stage_idx on public.bid_cases (stage);
create index bid_cases_presented_on_idx on public.bid_cases (presented_on desc nulls last);
create index bid_cases_outcome_on_idx on public.bid_cases (outcome_on desc nulls last);
create index bid_cases_updated_at_idx on public.bid_cases (updated_at desc);

create or replace function public.bid_cases_set_updated_at()
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

create trigger bid_cases_set_updated_at
  before update on public.bid_cases
  for each row
  execute function public.bid_cases_set_updated_at();

alter table public.bid_cases enable row level security;

create policy "bid_cases_select_app_user"
  on public.bid_cases for select to authenticated
  using (public.is_app_user());

create policy "bid_cases_insert_app_user"
  on public.bid_cases for insert to authenticated
  with check (public.is_app_user());

create policy "bid_cases_update_app_user"
  on public.bid_cases for update to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());

create policy "bid_cases_delete_app_user"
  on public.bid_cases for delete to authenticated
  using (public.is_app_user());

revoke all on table public.bid_cases from public;
revoke all on table public.bid_cases from anon;
grant select, insert, update, delete on table public.bid_cases to authenticated;

-- ---------------------------------------------------------------------------
-- bid_case_checklist_items
-- ---------------------------------------------------------------------------
create table public.bid_case_checklist_items (
  id uuid primary key default gen_random_uuid(),
  bid_case_id uuid not null references public.bid_cases (id) on delete cascade,
  title text not null,
  due_at timestamptz,
  done_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.bid_case_checklist_items is
  'Requisitos del expediente con cuenta atrás (due_at) y cierre (done_at).';

create index bid_case_checklist_items_case_idx
  on public.bid_case_checklist_items (bid_case_id, sort_order, created_at);

alter table public.bid_case_checklist_items enable row level security;

create policy "bid_case_checklist_items_select_app_user"
  on public.bid_case_checklist_items for select to authenticated
  using (public.is_app_user());

create policy "bid_case_checklist_items_insert_app_user"
  on public.bid_case_checklist_items for insert to authenticated
  with check (public.is_app_user());

create policy "bid_case_checklist_items_update_app_user"
  on public.bid_case_checklist_items for update to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());

create policy "bid_case_checklist_items_delete_app_user"
  on public.bid_case_checklist_items for delete to authenticated
  using (public.is_app_user());

revoke all on table public.bid_case_checklist_items from public;
revoke all on table public.bid_case_checklist_items from anon;
grant select, insert, update, delete on table public.bid_case_checklist_items to authenticated;

-- ---------------------------------------------------------------------------
-- bid_case_updates (novedades)
-- ---------------------------------------------------------------------------
create table public.bid_case_updates (
  id uuid primary key default gen_random_uuid(),
  bid_case_id uuid not null references public.bid_cases (id) on delete cascade,
  body text not null,
  happened_on date not null default (
    (timezone('Europe/Madrid', now()))::date
  ),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.bid_case_updates is
  'Novedades / hitos del expediente (texto libre + fecha).';

create index bid_case_updates_case_idx
  on public.bid_case_updates (bid_case_id, happened_on desc, created_at desc);

alter table public.bid_case_updates enable row level security;

create policy "bid_case_updates_select_app_user"
  on public.bid_case_updates for select to authenticated
  using (public.is_app_user());

create policy "bid_case_updates_insert_app_user"
  on public.bid_case_updates for insert to authenticated
  with check (public.is_app_user());

create policy "bid_case_updates_update_app_user"
  on public.bid_case_updates for update to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());

create policy "bid_case_updates_delete_app_user"
  on public.bid_case_updates for delete to authenticated
  using (public.is_app_user());

revoke all on table public.bid_case_updates from public;
revoke all on table public.bid_case_updates from anon;
grant select, insert, update, delete on table public.bid_case_updates to authenticated;

-- ---------------------------------------------------------------------------
-- bid_documents (biblioteca reutilizable) + vínculo a casos
-- ---------------------------------------------------------------------------
create table public.bid_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text,
  tags text[] not null default '{}',
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.bid_documents is
  'Documentación reutilizable (URL externa en MVP; tags para parecidas).';

create index bid_documents_tags_gin on public.bid_documents using gin (tags);
create index bid_documents_created_at_idx on public.bid_documents (created_at desc);

create or replace function public.bid_documents_set_updated_at()
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

create trigger bid_documents_set_updated_at
  before update on public.bid_documents
  for each row
  execute function public.bid_documents_set_updated_at();

alter table public.bid_documents enable row level security;

create policy "bid_documents_select_app_user"
  on public.bid_documents for select to authenticated
  using (public.is_app_user());

create policy "bid_documents_insert_app_user"
  on public.bid_documents for insert to authenticated
  with check (public.is_app_user());

create policy "bid_documents_update_app_user"
  on public.bid_documents for update to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());

create policy "bid_documents_delete_app_user"
  on public.bid_documents for delete to authenticated
  using (public.is_app_user());

revoke all on table public.bid_documents from public;
revoke all on table public.bid_documents from anon;
grant select, insert, update, delete on table public.bid_documents to authenticated;

create table public.bid_case_documents (
  bid_case_id uuid not null references public.bid_cases (id) on delete cascade,
  document_id uuid not null references public.bid_documents (id) on delete cascade,
  linked_at timestamptz not null default now(),
  primary key (bid_case_id, document_id)
);

comment on table public.bid_case_documents is
  'Vínculo N:M entre expediente y documento de la biblioteca.';

create index bid_case_documents_document_idx
  on public.bid_case_documents (document_id);

alter table public.bid_case_documents enable row level security;

create policy "bid_case_documents_select_app_user"
  on public.bid_case_documents for select to authenticated
  using (public.is_app_user());

create policy "bid_case_documents_insert_app_user"
  on public.bid_case_documents for insert to authenticated
  with check (public.is_app_user());

create policy "bid_case_documents_delete_app_user"
  on public.bid_case_documents for delete to authenticated
  using (public.is_app_user());

revoke all on table public.bid_case_documents from public;
revoke all on table public.bid_case_documents from anon;
grant select, insert, delete on table public.bid_case_documents to authenticated;
