-- offer_tasks: sin created_at / updated_at (sin uso de producto; como eficen_members).
-- Solo local/Studio. Enmienda ADR 026.

drop trigger if exists offer_tasks_set_updated_at on public.offer_tasks;
drop function if exists public.offer_tasks_set_updated_at();

alter table public.offer_tasks
  drop column if exists created_at,
  drop column if exists updated_at;
