-- offer_case_members: equipo preparador vía eficen_members.
-- user_id → member_id; se elimina created_at. Solo Studio/local.

alter table public.offer_case_members
  add column if not exists member_id uuid null
    references public.eficen_members (id) on delete cascade;

comment on column public.offer_case_members.member_id is
  'Miembro del directorio Eficen en el equipo del expediente.';

-- Backfill desde users → eficen_members.user_id
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'offer_case_members'
      and column_name = 'user_id'
  ) then
    update public.offer_case_members ocm
    set member_id = em.id
    from public.eficen_members em
    where ocm.member_id is null
      and ocm.user_id is not null
      and em.user_id = ocm.user_id;

    -- Filas sin ficha en directorio no se pueden conservar
    delete from public.offer_case_members
    where member_id is null;
  end if;
end $$;

alter table public.offer_case_members
  alter column member_id set not null;

drop index if exists public.offer_case_members_user_idx;

alter table public.offer_case_members
  drop constraint if exists offer_case_members_offer_case_id_user_id_key;

alter table public.offer_case_members
  drop constraint if exists offer_case_members_user_id_fkey;

alter table public.offer_case_members
  drop column if exists user_id,
  drop column if exists created_at;

alter table public.offer_case_members
  drop constraint if exists offer_case_members_offer_case_id_member_id_key;

alter table public.offer_case_members
  add constraint offer_case_members_offer_case_id_member_id_key
    unique (offer_case_id, member_id);

create index if not exists offer_case_members_member_idx
  on public.offer_case_members (member_id);

comment on table public.offer_case_members is
  'Equipo que prepara la oferta (eficen_members + rol). Distinto de adscripción de medios.';
