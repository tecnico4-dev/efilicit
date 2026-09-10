# Fase 1 / Semana 1 — checklist

Plan: [semana01-plan.md](semana01-plan.md). Criterios: `docs/04-roadmap-mvp.md` § Semana 1.

| Ítem | Estado | Notas |
|---|---|---|
| Migración operativa (`source_sync`, `source_artifacts`, `errors`) | OK | `20260909103000_semana1_source_sync_artifacts_errors.sql` |
| Migración canónica (`tenders` + relacionadas) | OK | `20260909120000_semana1_canonical_core.sql` |
| Esqueleto users / saved_searches / alerts / notification_queue + RLS | OK | `20260909133000_semana1_users_alerts_skeleton.sql` |
| `supabase db reset` local OK (esquema Semana 1) | OK | Revalidado en cierre (Paso 9) |
| Tipos TS regenerados | OK | `packages/types/src/database.types.ts` |
| `SourceConnector` + tests básicos | OK | Protocol + stub; `pytest` en `ingestion/tests` |
| Pipeline común + prueba mínima | OK | `run_pipeline` + test con stub (in-memory) |
| `source_sync` / `source_artifacts` funcionando | OK | Persistencia Postgres + tests de integración locales |
| `pytest` en CI | OK | Job ingestion: `3 passed, 3 skipped` en Actions |
| ADRs estructurales (solo si hubo decisión nueva) | N/A | Sin cambio de arquitectura; se implementó lo fijado en `docs/01`–`04` |
| CHANGELOG actualizado | OK | Unreleased con entradas Semana 1 |

Cuando esté en OK → Semana 2 (PLACSP vertical slice).
