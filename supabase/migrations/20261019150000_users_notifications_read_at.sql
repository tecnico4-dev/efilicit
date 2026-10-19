-- Marca de lectura del buzón in-app (cambios de estado en favoritos).
-- Null = nunca abierto → todos los avisos posteriores al favorito cuentan como no leídos.

alter table public.users
  add column if not exists notifications_read_at timestamptz;

comment on column public.users.notifications_read_at is
  'Última vez que el usuario abrió /notifications. Avisos de favoritos con '
  'occurred_at posterior cuentan como no leídos.';
