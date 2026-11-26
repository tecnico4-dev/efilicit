-- Nombre del autor denormalizado en Común (sin ampliar RLS de users).

alter table public.shared_favorites
  add column if not exists added_by_display_name text;

update public.shared_favorites sf
set added_by_display_name = u.display_name
from public.users u
where u.id = sf.added_by
  and sf.added_by_display_name is null
  and u.display_name is not null
  and trim(both from u.display_name) <> '';

comment on column public.shared_favorites.added_by_display_name is
  'Nombre visible al compartir (copia); evita leer users ajenos por RLS.';
