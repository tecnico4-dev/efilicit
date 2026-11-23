-- Responsable del requisito = eficen_members (alineado con offer_cases).
-- Quita owner_user_id / owner_name. Solo local.

alter table public.offer_requirements
  add column if not exists owner_member_id uuid null
    references public.eficen_members (id) on delete set null;

comment on column public.offer_requirements.owner_member_id is
  'Responsable del requisito (eficen_members). Null = sin asignar.';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'offer_requirements'
      and column_name = 'owner_user_id'
  ) then
    update public.offer_requirements r
    set owner_member_id = em.id
    from public.eficen_members em
    where r.owner_member_id is null
      and r.owner_user_id is not null
      and em.user_id = r.owner_user_id;
  end if;
end $$;

drop index if exists public.offer_requirements_owner_user_idx;

alter table public.offer_requirements
  drop constraint if exists offer_requirements_owner_user_id_fkey;

alter table public.offer_requirements
  drop column if exists owner_user_id,
  drop column if exists owner_name;

create index if not exists offer_requirements_owner_member_idx
  on public.offer_requirements (owner_member_id)
  where owner_member_id is not null;
