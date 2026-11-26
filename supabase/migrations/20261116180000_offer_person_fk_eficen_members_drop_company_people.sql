-- Mis licitaciones: person_id → eficen_members; drop company_people (ADR 032).

-- Limpiar refs huérfanas antes de cambiar FK.
update public.offer_assigned_people set person_id = null where person_id is not null;
update public.offer_requirement_evidence set person_id = null where person_id is not null;

alter table public.offer_assigned_people
  drop constraint if exists offer_assigned_people_person_id_fkey;

alter table public.offer_assigned_people
  add constraint offer_assigned_people_person_id_fkey
  foreign key (person_id) references public.eficen_members (id) on delete set null;

alter table public.offer_requirement_evidence
  drop constraint if exists offer_requirement_evidence_person_id_fkey;

-- Block B usaba RESTRICT hacia company_people; mismo criterio con eficen_members.
alter table public.offer_requirement_evidence
  add constraint offer_requirement_evidence_person_id_fkey
  foreign key (person_id) references public.eficen_members (id) on delete restrict;

drop trigger if exists company_people_set_updated_at on public.company_people;
drop function if exists public.company_people_set_updated_at();

drop table if exists public.company_people;

comment on column public.offer_assigned_people.person_id is
  'Medio/persona del directorio eficen_members (ex company_people).';

comment on column public.offer_requirement_evidence.person_id is
  'Evidencia tipo person → eficen_members (ADR 032).';
