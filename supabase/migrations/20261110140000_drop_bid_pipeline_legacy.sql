-- Retirada pipeline legacy ADR 023 (`bid_*`): sustituido por `offer_*` (ADR 026).
-- Idempotente: en remoto ya se dropeó con 20261030130100; en local aún existían.
-- No tocar remoto sin OK explícito; esta migración es para local / futuros resets.

drop table if exists public.bid_case_documents cascade;
drop table if exists public.bid_case_checklist_items cascade;
drop table if exists public.bid_case_updates cascade;
drop table if exists public.bid_documents cascade;
drop table if exists public.bid_cases cascade;

drop function if exists public.bid_documents_set_updated_at();
drop function if exists public.bid_cases_set_updated_at();
