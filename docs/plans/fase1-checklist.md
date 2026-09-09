# Fase 1 / Semana 1 — checklist

Plan: [semana01-plan.md](semana01-plan.md). Criterios: `docs/04-roadmap-mvp.md` § Semana 1.

| Ítem | Estado | Notas |
|---|---|---|
| Migración operativa (`source_sync`, `source_artifacts`, `errors`) | OK | `20260909103000_semana1_source_sync_artifacts_errors.sql` |
| Migración canónica (`tenders` + relacionadas) | OK | `20260909120000_semana1_canonical_core.sql` |
| Esqueleto users / saved_searches / alerts / notification_queue + RLS | OK | `20260909133000_semana1_users_alerts_skeleton.sql` |
| `supabase db reset` local OK (esquema Semana 1) | OK | Revalidado tras Paso 3 |
| Tipos TS regenerados | OK | `packages/types/src/database.types.ts` |
| `SourceConnector` + tests básicos | OK | Protocol + stub; `pytest` en `ingestion/tests` |
| Pipeline común + prueba mínima | — | |
| `source_sync` / `source_artifacts` funcionando | — | Schema listo; “funcionando” = Paso 7 |
| `pytest` en CI | — | |
| ADRs estructurales (solo si hubo decisión nueva) | — | Si no → N/A |
| CHANGELOG actualizado | OK | Entradas Pasos 1–4 en Unreleased |

Cuando esté en OK → Semana 2 (PLACSP vertical slice).
