-- Revertir 20261112140000: no ampliar SELECT de public.users entre compañeros.

drop policy if exists "users_select_app_peers" on public.users;
