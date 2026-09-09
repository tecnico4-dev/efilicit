# Fase 1 / Semana 1 — checklist

Plan: [semana01-plan.md](semana01-plan.md). Criterios: `docs/04-roadmap-mvp.md` § Semana 1.

| Ítem | Estado | Notas |
|---|---|---|
| Migración operativa (`source_sync`, `source_artifacts`, `errors`) | OK | `20260909103000_semana1_source_sync_artifacts_errors.sql` |
| Migración canónica (`tenders` + relacionadas) | — | |
| Esqueleto users / saved_searches / alerts / notification_queue + RLS | — | |
| `supabase db reset` local OK (esquema Semana 1) | OK | Paso 1 verificado; se revalidará al cerrar migraciones |
| Tipos TS regenerados | — | |
| `SourceConnector` + tests básicos | — | |
| Pipeline común + prueba mínima | — | |
| `source_sync` / `source_artifacts` funcionando | — | Schema listo; “funcionando” = Paso 7 |
| `pytest` en CI | — | |
| ADRs estructurales (solo si hubo decisión nueva) | — | Si no → N/A |
| CHANGELOG actualizado | — | |

Cuando esté en OK → Semana 2 (PLACSP vertical slice).
