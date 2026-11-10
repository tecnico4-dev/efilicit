-- Bloque B (ADR 028): integridad offer_*
-- 1) tender_id ON DELETE RESTRICT (licitación en Mis licitaciones = imborrable)
-- 2) evidencias: CHECK por evidence_kind + RESTRICT a company_*
-- 3) FK compuestas / mismo offer_case_id en puentes (no mezclar expedientes)
-- Solo Studio local hasta OK explícito de remoto.

-- ---------------------------------------------------------------------------
-- 1) offer_cases.tender_id: CASCADE → RESTRICT
-- ---------------------------------------------------------------------------
alter table public.offer_cases
  drop constraint offer_cases_tender_id_fkey;

alter table public.offer_cases
  add constraint offer_cases_tender_id_fkey
  foreign key (tender_id) references public.tenders (id)
  on delete restrict;

comment on column public.offer_cases.tender_id is
  'Licitación canónica del expediente. ON DELETE RESTRICT: no borrar tender si hay oferta (activa o histórica).';

-- ---------------------------------------------------------------------------
-- Uniques (id, offer_case_id) para FK compuestas
-- ---------------------------------------------------------------------------
alter table public.offer_requirements
  add constraint offer_requirements_id_case_key unique (id, offer_case_id);

alter table public.offer_deliverables
  add constraint offer_deliverables_id_case_key unique (id, offer_case_id);

alter table public.offer_case_pliegos
  add constraint offer_case_pliegos_id_case_key unique (id, offer_case_id);

alter table public.offer_sources
  add constraint offer_sources_id_case_key unique (id, offer_case_id);

-- ---------------------------------------------------------------------------
-- 2) offer_requirement_evidence: CHECK tipado + RESTRICT a biblioteca
-- ---------------------------------------------------------------------------
alter table public.offer_requirement_evidence
  drop constraint if exists offer_requirement_evidence_payload_chk;

alter table public.offer_requirement_evidence
  drop constraint if exists offer_requirement_evidence_document_id_fkey;
alter table public.offer_requirement_evidence
  drop constraint if exists offer_requirement_evidence_person_id_fkey;
alter table public.offer_requirement_evidence
  drop constraint if exists offer_requirement_evidence_reference_id_fkey;
alter table public.offer_requirement_evidence
  drop constraint if exists offer_requirement_evidence_financial_id_fkey;

alter table public.offer_requirement_evidence
  add constraint offer_requirement_evidence_document_id_fkey
  foreign key (document_id) references public.company_documents (id) on delete restrict;

alter table public.offer_requirement_evidence
  add constraint offer_requirement_evidence_person_id_fkey
  foreign key (person_id) references public.company_people (id) on delete restrict;

alter table public.offer_requirement_evidence
  add constraint offer_requirement_evidence_reference_id_fkey
  foreign key (reference_id) references public.company_references (id) on delete restrict;

alter table public.offer_requirement_evidence
  add constraint offer_requirement_evidence_financial_id_fkey
  foreign key (financial_id) references public.company_financials (id) on delete restrict;

alter table public.offer_requirement_evidence
  add constraint offer_requirement_evidence_kind_payload_chk check (
    (
      evidence_kind = 'document'
      and document_id is not null
      and person_id is null
      and reference_id is null
      and financial_id is null
    )
    or (
      evidence_kind = 'person'
      and person_id is not null
      and document_id is null
      and reference_id is null
      and financial_id is null
    )
    or (
      evidence_kind = 'reference'
      and reference_id is not null
      and document_id is null
      and person_id is null
      and financial_id is null
    )
    or (
      evidence_kind = 'financial'
      and financial_id is not null
      and document_id is null
      and person_id is null
      and reference_id is null
    )
    or (
      evidence_kind = 'url'
      and url is not null
      and btrim(url) <> ''
      and document_id is null
      and person_id is null
      and reference_id is null
      and financial_id is null
    )
    or (
      evidence_kind = 'other'
      and notes is not null
      and btrim(notes) <> ''
      and document_id is null
      and person_id is null
      and reference_id is null
      and financial_id is null
    )
  );

comment on constraint offer_requirement_evidence_kind_payload_chk on public.offer_requirement_evidence is
  'Exactamente el payload del evidence_kind; biblioteca con ON DELETE RESTRICT.';

-- ---------------------------------------------------------------------------
-- 3a) offer_requirement_deliverables: mismo offer_case_id
-- ---------------------------------------------------------------------------
alter table public.offer_requirement_deliverables
  add column if not exists offer_case_id uuid;

update public.offer_requirement_deliverables rd
set offer_case_id = r.offer_case_id
from public.offer_requirements r
where rd.requirement_id = r.id
  and rd.offer_case_id is null;

-- Filas huérfanas no deberían existir; por seguridad borrar inconsistentes
delete from public.offer_requirement_deliverables rd
where rd.offer_case_id is null
   or not exists (
     select 1
     from public.offer_deliverables d
     where d.id = rd.deliverable_id
       and d.offer_case_id = rd.offer_case_id
   );

alter table public.offer_requirement_deliverables
  alter column offer_case_id set not null;

alter table public.offer_requirement_deliverables
  drop constraint offer_requirement_deliverables_requirement_id_fkey;
alter table public.offer_requirement_deliverables
  drop constraint offer_requirement_deliverables_deliverable_id_fkey;

alter table public.offer_requirement_deliverables
  add constraint offer_requirement_deliverables_requirement_case_fkey
  foreign key (requirement_id, offer_case_id)
  references public.offer_requirements (id, offer_case_id)
  on delete cascade;

alter table public.offer_requirement_deliverables
  add constraint offer_requirement_deliverables_deliverable_case_fkey
  foreign key (deliverable_id, offer_case_id)
  references public.offer_deliverables (id, offer_case_id)
  on delete cascade;

alter table public.offer_requirement_deliverables
  add constraint offer_requirement_deliverables_case_fkey
  foreign key (offer_case_id) references public.offer_cases (id) on delete cascade;

create index if not exists offer_requirement_deliverables_case_idx
  on public.offer_requirement_deliverables (offer_case_id);

-- ---------------------------------------------------------------------------
-- 3b) offer_deliverables.parent_id: mismo caso
-- ---------------------------------------------------------------------------
alter table public.offer_deliverables
  drop constraint if exists offer_deliverables_parent_id_fkey;

-- Romper padres cross-case si existieran
update public.offer_deliverables d
set parent_id = null
where parent_id is not null
  and not exists (
    select 1
    from public.offer_deliverables p
    where p.id = d.parent_id
      and p.offer_case_id = d.offer_case_id
  );

alter table public.offer_deliverables
  add constraint offer_deliverables_parent_case_fkey
  foreign key (parent_id, offer_case_id)
  references public.offer_deliverables (id, offer_case_id)
  on delete cascade;

-- ---------------------------------------------------------------------------
-- 3c) offer_sources.pliego_id: mismo caso + RESTRICT opcional en doc empresa
-- ---------------------------------------------------------------------------
alter table public.offer_sources
  drop constraint if exists offer_sources_pliego_id_fkey;

update public.offer_sources s
set pliego_id = null
where pliego_id is not null
  and not exists (
    select 1
    from public.offer_case_pliegos p
    where p.id = s.pliego_id
      and p.offer_case_id = s.offer_case_id
  );

alter table public.offer_sources
  add constraint offer_sources_pliego_case_fkey
  foreign key (pliego_id, offer_case_id)
  references public.offer_case_pliegos (id, offer_case_id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- 3d) offer_source_links: offer_case_id + FK compuestas
-- ---------------------------------------------------------------------------
alter table public.offer_source_links
  add column if not exists offer_case_id uuid;

update public.offer_source_links sl
set offer_case_id = s.offer_case_id
from public.offer_sources s
where sl.source_id = s.id
  and sl.offer_case_id is null;

delete from public.offer_source_links sl
where sl.offer_case_id is null
   or (
     sl.requirement_id is not null
     and not exists (
       select 1 from public.offer_requirements r
       where r.id = sl.requirement_id and r.offer_case_id = sl.offer_case_id
     )
   )
   or (
     sl.deliverable_id is not null
     and not exists (
       select 1 from public.offer_deliverables d
       where d.id = sl.deliverable_id and d.offer_case_id = sl.offer_case_id
     )
   );

alter table public.offer_source_links
  alter column offer_case_id set not null;

alter table public.offer_source_links
  drop constraint if exists offer_source_links_source_id_fkey;
alter table public.offer_source_links
  drop constraint if exists offer_source_links_requirement_id_fkey;
alter table public.offer_source_links
  drop constraint if exists offer_source_links_deliverable_id_fkey;

alter table public.offer_source_links
  add constraint offer_source_links_source_case_fkey
  foreign key (source_id, offer_case_id)
  references public.offer_sources (id, offer_case_id)
  on delete cascade;

alter table public.offer_source_links
  add constraint offer_source_links_requirement_case_fkey
  foreign key (requirement_id, offer_case_id)
  references public.offer_requirements (id, offer_case_id)
  on delete cascade;

alter table public.offer_source_links
  add constraint offer_source_links_deliverable_case_fkey
  foreign key (deliverable_id, offer_case_id)
  references public.offer_deliverables (id, offer_case_id)
  on delete cascade;

alter table public.offer_source_links
  add constraint offer_source_links_case_fkey
  foreign key (offer_case_id) references public.offer_cases (id) on delete cascade;

create index if not exists offer_source_links_case_idx
  on public.offer_source_links (offer_case_id);

-- ---------------------------------------------------------------------------
-- 3e) offer_case_log.related_*: mismo caso (SET NULL al borrar requisito/entregable)
-- ---------------------------------------------------------------------------
alter table public.offer_case_log
  drop constraint if exists offer_case_log_related_requirement_id_fkey;
alter table public.offer_case_log
  drop constraint if exists offer_case_log_related_deliverable_id_fkey;

update public.offer_case_log l
set related_requirement_id = null
where related_requirement_id is not null
  and not exists (
    select 1 from public.offer_requirements r
    where r.id = l.related_requirement_id and r.offer_case_id = l.offer_case_id
  );

update public.offer_case_log l
set related_deliverable_id = null
where related_deliverable_id is not null
  and not exists (
    select 1 from public.offer_deliverables d
    where d.id = l.related_deliverable_id and d.offer_case_id = l.offer_case_id
  );

alter table public.offer_case_log
  add constraint offer_case_log_related_requirement_case_fkey
  foreign key (related_requirement_id, offer_case_id)
  references public.offer_requirements (id, offer_case_id)
  on delete set null;

alter table public.offer_case_log
  add constraint offer_case_log_related_deliverable_case_fkey
  foreign key (related_deliverable_id, offer_case_id)
  references public.offer_deliverables (id, offer_case_id)
  on delete set null;

-- Índices útiles para filtros por responsable
create index if not exists offer_cases_owner_user_idx
  on public.offer_cases (owner_user_id)
  where owner_user_id is not null;

create index if not exists offer_requirements_owner_user_idx
  on public.offer_requirements (owner_user_id)
  where owner_user_id is not null;

create index if not exists offer_deliverables_owner_user_idx
  on public.offer_deliverables (owner_user_id)
  where owner_user_id is not null;

create index if not exists offer_requirement_evidence_document_idx
  on public.offer_requirement_evidence (document_id)
  where document_id is not null;

create index if not exists offer_requirement_evidence_person_idx
  on public.offer_requirement_evidence (person_id)
  where person_id is not null;
