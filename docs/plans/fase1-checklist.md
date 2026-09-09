# Fase 1 / Semana 1 — checklist (modelo canónico + infraestructura de ingesta)

Plan de ejecución: [semana01-plan.md](semana01-plan.md).  
Criterios de salida: `docs/04-roadmap-mvp.md` § Semana 1.

Marcar `OK` / `WIP` / `N/A` / `—` en **Estado** a medida que se cierren pasos. Anotar decisiones en la §7 de `semana01-plan.md`.

## Criterios de salida (roadmap)

| Ítem | Estado | Notas |
|---|---|---|
| `supabase db reset` reconstruye la DB sin errores | — | Incluye migraciones Semana 1 |
| Existen las tablas/índices iniciales necesarios | — | Núcleo canónico + sync/artifacts + esqueleto users |
| `SourceConnector` compila y tiene tests básicos | — | Protocol de `docs/01` bajado a código + stub |
| El pipeline común tiene una prueba mínima | — | Runner con stub |
| `source_sync` y `source_artifacts` están funcionando | — | Alta/cierre de run + artifact + checksum |
| ADRs estructurales escritos | — | Solo si hubo decisión estructural **nueva**; si no → `N/A` (sin cambio de arquitectura) |
| CHANGELOG actualizado (cambio funcional importante) | — | |

## Pasos del plan (seguimiento fino)

| Paso | Ítem | Estado | Notas |
|---|---|---|---|
| 1 | Migración `source_sync` / `source_artifacts` / `errors` | — | |
| 1 | `db reset` OK tras migración operativa | — | |
| 2 | Migración `tenders` + relacionadas | — | |
| 2 | `db reset` OK tras núcleo canónico | — | |
| 3 | Esqueleto `users` / `saved_searches` / `alerts` / `notification_queue` + RLS | — | |
| 4 | Tipos TS regenerados + CHANGELOG | — | |
| 5 | `SourceConnector` + modelos Pydantic + stub | — | |
| 5 | Tests básicos del contrato | — | |
| 6 | Pipeline común mínimo (etapas invocables) | — | |
| 6 | Test mínimo del runner | — | |
| 7 | Persistencia sync/artifacts idempotente | — | |
| 8 | `pytest` en CI | — | |
| 9 | Checklist de salida completo | — | |

## Fuera de alcance (no marcar como fallo de Semana 1)

| Ítem | Notas |
|---|---|
| Conector / parser PLACSP real | Semana 2 |
| Workflows `ingest-*.yml` | Semana 2+ |
| Deduplicación real / FTS / Auth UI / Resend | Semanas posteriores |
| Catálogos `cpv` / `geography` completos | No están en la lista Semana 1 del roadmap |
| Branch protection `main` | Decisión Fase 0; no bloquea Semana 1 |
| ADRs previos “por si acaso” | No; ADR solo ante cambio estructural real |

Cuando este checklist esté en OK, se puede abrir **Semana 2** (PLACSP vertical slice) con su `semana02-plan.md` / `fase2-checklist.md`.
