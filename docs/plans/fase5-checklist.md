# Fase 5 / Semana 5 — checklist

Plan: [semana05-plan.md](semana05-plan.md). Criterios: `docs/04-roadmap-mvp.md` § Semana 5.

Los pasos globales (1–11) se mantienen. Los Pasos **2**, **5** y **7** se desglosan en minipasos verificables.  
El estado se marca **aquí**, no con “— OK” en el plan.

## Pasos globales

| Ítem | Estado | Notas |
|---|---|---|
| 1. Contrato de criterios (`alerts` / `saved_searches`) | OK | v1 en `packages/types/src/criteria.ts` + `efilicit_ingestion.alerts.criteria`; comments SQL |
| 2. Esquema FTS + `pg_trgm` (migración) | OK | Minipasos 2.1–2.2; tipos TS regenerados |
| 3. Capa `apps/web/src/lib/queries` | OK | `searchTenders` → RPC `search_tenders` ([ADR 011](../adr/011-busqueda-via-rpc-search-tenders.md)); FTS + trgm + filtros |
| 4. UI mínima de búsqueda | OK | `/search`: texto + CPV + importe; usa `searchTenders` |
| 5. Auth — sesión + perfil `public.users` | OK | Minipasos 5.1–5.2; login/account mínimos |
| 6. Auth UI + RLS verificado (A≠B) | OK | `/register` `/alerts`; `verify:rls` Alice≠Bob |
| 7. Matching batch → `notification_queue` | OK | Minipasos 7.1–7.2; tests sin red |
| 8. Resend + digest diario/semanal (idempotente) | OK | `users.digest_frequency`; Edge Function N/A ([ADR 012](../adr/012-digest-email-job-python-sin-edge-function.md)); `instant` diferido ([ADR 013](../adr/013-alert-frequencies-daily-weekly-instant-diferido.md)); weekly = lunes UTC; tests FakeSender |
| 9. CLI + workflow alertas | OK | `run-alerts` dry-run default; `alerts-digest.yml` cron off |
| 10. Recorrido E2E local (buscar → alerta → email) | OK | Guía `semana05-e2e-local.md`; Fake + Resend (correo personal); dominio eficen → IT |
| 11. Cierre (CHANGELOG / tipos / ADR) | OK | CHANGELOG alineado; tipos N/A (RPC sin cambio de firma); ADRs 011–013 (RPC, digest Python, frecuencias) |

## Paso 2 — minipasos (búsqueda DB)

| Minipaso | Estado | Notas |
|---|---|---|
| 2.1 Extensión + `search_vector` (+ trigger/generated) | OK | generated stored; título A > descripción B (`spanish`) |
| 2.2 Índices GIN + `pg_trgm` + B-tree filtros | OK | `tenders_search_vector_gin_idx` + `tenders_title_trgm_idx`; B-tree S1 intactos |

## Paso 5 — minipasos (Auth base)

| Minipaso | Estado | Notas |
|---|---|---|
| 5.1 Clientes Supabase browser/server + sesión | OK | `@supabase/ssr` + middleware; `/login` `/account` |
| 5.2 Sync `auth.users` → `public.users` | OK | trigger `handle_new_user` + seed Alice/Bob |

## Paso 7 — minipasos (motor alertas)

| Minipaso | Estado | Notas |
|---|---|---|
| 7.1 Evaluador de reglas (criteria → tenders) | OK | `alerts/match.py`; `test_alert_match` |
| 7.2 Encolado idempotente (`idempotency_key`) | OK | `alerts/queue.py` + `batch.py`; 2ª pasada no reabre `sent` |

## Criterios transversales (cierre Semana 5)

| Ítem | Estado | Notas |
|---|---|---|
| Sin motor de búsqueda externo | OK | Solo PostgreSQL FTS/GIN/trgm |
| `service_role` fuera del frontend | OK | Solo publishable en web |
| Alertas batch-first (no email por INSERT bruto) | OK | Match → cola; email = Paso 8 |
| Reejecutar batch no reenvía notificaciones `sent` | OK | Digest drain + idempotencia por periodo (día / semana ISO); `test_alert_digest` |
| RLS owner-only verificado (usuario A ≠ B) | OK | `apps/web/scripts/verify-rls-alerts.mjs` |
| Tests relevantes en verde (queries / matching / RLS) | OK | alert match/batch/digest + run-alerts CLI; verify:rls |
| ADRs estructurales (solo si hubo decisión nueva) | OK | [ADR 011](../adr/011-busqueda-via-rpc-search-tenders.md) (RPC búsqueda); [ADR 012](../adr/012-digest-email-job-python-sin-edge-function.md); [ADR 013](../adr/013-alert-frequencies-daily-weekly-instant-diferido.md) |
| CHANGELOG actualizado | OK | Unreleased con entradas Semana 5 + cierre Paso 11 |

## Criterios de salida `docs/04` § Semana 5

| Criterio | Estado | Evidencia |
|---|---|---|
| Búsqueda de términos normales → resultados relevantes | OK | `/search` `software` → resultados locales |
| Errata razonable cubierta por `pg_trgm` | OK | `softwar` / `mntenimiento` vía `strict_word_similarity` / `<<%`; `foas` no debe matchear |
| Un usuario no accede a datos privados de otro | OK | `verify:rls` Alice crea alerta; Bob no la ve |
| Crear alerta → ejecutar batch → recibir email | OK | UI + `--write` Fake + Resend real (personal); Outlook @eficen.com pendiente dominio |
| Reejecutar el batch no reenvía notificaciones ya enviadas | OK | 2ª `--write` mismo digest: `enqueued_new=0`, drain `sent=0` |

**Semana 5 cerrada** (fusionada en `main`). Siguiente: Semana 6 — [semana06-plan.md](semana06-plan.md).
