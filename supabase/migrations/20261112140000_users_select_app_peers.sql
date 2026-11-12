-- Directorio mínimo entre usuarios app: poder leer display_name de compañeros
-- (Común «añadida por», toasts, Mis licitaciones, etc.). UPDATE/INSERT siguen own-only.
-- Tenant invite-only (ADR 016 / 029); no multi-org.

create policy "users_select_app_peers"
  on public.users for select to authenticated
  using (public.is_app_user());

comment on policy "users_select_app_peers" on public.users is
  'App users pueden leer perfiles de compañeros (OR con users_select_own).';
