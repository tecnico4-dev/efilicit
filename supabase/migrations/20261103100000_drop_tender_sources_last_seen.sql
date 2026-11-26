-- Drop heartbeat last_seen_at (ADR 024): no useful signal with PLACSP incremental
-- skip-by-checksum; UI uses tenders.updated_at / created_at instead.

drop function if exists public.tender_max_last_seen(uuid[]);

alter table public.tender_sources
  drop column if exists last_seen_at;
