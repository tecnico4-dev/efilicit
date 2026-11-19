-- offer_cases: responsable = eficen_members (nullable).
-- Quita owner_name + owner_user_id (doble verdad). created_by (users) se mantiene.
-- Solo Studio/local hasta OK remoto. Enmienda práctica ADR 026 / 032.

alter table public.offer_cases
  add column if not exists owner_member_id uuid null
    references public.eficen_members (id) on delete set null;

comment on column public.offer_cases.owner_member_id is
  'Responsable del expediente (eficen_members). Null = sin asignar. Distinto de created_by.';

-- Backfill si había owner_user_id enlazado a un miembro.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'offer_cases'
      and column_name = 'owner_user_id'
  ) then
    update public.offer_cases oc
    set owner_member_id = em.id
    from public.eficen_members em
    where oc.owner_member_id is null
      and oc.owner_user_id is not null
      and em.user_id = oc.owner_user_id;
  end if;
end $$;

drop index if exists public.offer_cases_owner_user_idx;

alter table public.offer_cases
  drop constraint if exists offer_cases_owner_user_id_fkey;

alter table public.offer_cases
  drop column if exists owner_user_id,
  drop column if exists owner_name;

create index if not exists offer_cases_owner_member_idx
  on public.offer_cases (owner_member_id)
  where owner_member_id is not null;
