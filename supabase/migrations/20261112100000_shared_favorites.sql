-- Favoritos Común: vigilancia compartida del equipo (tenant único Eficen).
-- Independiente de favorites (personales) y de offer_* (pipeline de oferta).

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
  'True si auth.uid() tiene fila en public.users (invite-only). RLS compartido tenant.';

revoke all on function public.is_app_user() from public;
grant execute on function public.is_app_user() to authenticated;

create table public.shared_favorites (
  tender_id uuid primary key references public.tenders (id) on delete cascade,
  added_by uuid not null references public.users (id) on delete restrict,
  added_by_display_name text null,
  notes text null
    check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

comment on table public.shared_favorites is
  'Carpeta Común: una fila por licitación; added_by = quien la compartió primero. Tenant único (no multi-org).';

comment on column public.shared_favorites.added_by_display_name is
  'Nombre visible al compartir (copia); evita leer users ajenos por RLS.';

comment on column public.shared_favorites.notes is
  'Nota opcional al compartir (máx. 500). Visible a todo el equipo.';

create index shared_favorites_added_by_idx
  on public.shared_favorites (added_by);

create index shared_favorites_created_at_idx
  on public.shared_favorites (created_at desc);

alter table public.shared_favorites enable row level security;

create policy "shared_favorites_select_app"
  on public.shared_favorites for select to authenticated
  using (public.is_app_user());

create policy "shared_favorites_insert_app"
  on public.shared_favorites for insert to authenticated
  with check (
    public.is_app_user()
    and added_by in (
      select id from public.users where auth_user_id = (select auth.uid())
    )
  );

create policy "shared_favorites_delete_app"
  on public.shared_favorites for delete to authenticated
  using (public.is_app_user());

revoke all on table public.shared_favorites from public;
revoke all on table public.shared_favorites from anon;
grant select, insert, delete on table public.shared_favorites to authenticated;
