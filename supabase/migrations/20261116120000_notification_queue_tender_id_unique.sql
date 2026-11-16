-- notification_queue: columna tender_id + unicidad lógica alerta×licitación.
-- 1) Añadir columna (nullable al inicio).
-- 2) Backfill desde payload.tender_id.
-- 3) Dedupe: una fila por (alert_id, tender_id); se conserva la más antigua.
-- 4) Normalizar idempotency_key (quitar sufijo :digest:…).
-- 5) UNIQUE parcial (alert_id, tender_id) WHERE alert_id IS NOT NULL.
-- Solo Studio / migrate local hasta OK explícito en remoto.

alter table public.notification_queue
  add column if not exists tender_id uuid
    references public.tenders (id) on delete cascade;

comment on column public.notification_queue.tender_id is
  'Licitación del match (antes solo en payload). Unicidad con alert_id.';

-- Backfill desde JSON (uuid válido).
update public.notification_queue
set tender_id = (payload->>'tender_id')::uuid
where tender_id is null
  and payload ? 'tender_id'
  and (payload->>'tender_id') ~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Filas sin tender_id usable: basura de cola; no sirven para el UNIQUE.
delete from public.notification_queue
where tender_id is null;

-- Dedupe: mismo (alert_id, tender_id) → dejar created_at más antiguo (id como tie-break).
delete from public.notification_queue nq
using (
  select
    id,
    row_number() over (
      partition by alert_id, tender_id
      order by created_at asc, id asc
    ) as rn
  from public.notification_queue
) ranked
where nq.id = ranked.id
  and ranked.rn > 1;

-- Clave canónica sin periodo (histórico :digest:YYYY-MM-DD / :digest:YYYY-Www).
update public.notification_queue
set idempotency_key =
  regexp_replace(idempotency_key, ':digest:.*$', '')
where idempotency_key like '%:digest:%';

-- Por si quedaran dos claves iguales tras normalizar (no debería tras dedupe).
delete from public.notification_queue nq
using (
  select
    id,
    row_number() over (
      partition by idempotency_key
      order by created_at asc, id asc
    ) as rn
  from public.notification_queue
) ranked
where nq.id = ranked.id
  and ranked.rn > 1;

alter table public.notification_queue
  alter column tender_id set not null;

-- Candado de negocio: misma alerta no reencola la misma licitación.
-- alert_id NULL (huérfanos tras borrar alerta) quedan fuera del UNIQUE.
create unique index if not exists notification_queue_alert_tender_uidx
  on public.notification_queue (alert_id, tender_id)
  where alert_id is not null;

create index if not exists notification_queue_tender_id_idx
  on public.notification_queue (tender_id);

comment on table public.notification_queue is
  'Cola de notificaciones. Unicidad alerta×licitación (índice parcial); idempotency_key sin periodo.';
