-- Columna legacy: watermark global del buzón. La lectura por aviso usa
-- notification_favorites (y tablas hermanas). Sin usos en app.
-- Solo Studio / migrate local hasta OK explícito en remoto.

alter table public.users
  drop column if exists notifications_read_at;
