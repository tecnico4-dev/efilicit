# Fase 5 / Semana 5 — checklist

Plan: [semana05-plan.md](semana05-plan.md). Criterios: `docs/04-roadmap-mvp.md` § Semana 5.

Los pasos globales (1–11) se mantienen. Los Pasos **2**, **5** y **7** se desglosan en minipasos verificables.  
El estado se marca **aquí**, no con “— OK” en el plan.

## Pasos globales

| Ítem | Estado | Notas |
|---|---|---|
| 1. Contrato de criterios (`alerts` / `saved_searches`) | OK | v1 en `packages/types/src/criteria.ts` + `efilicit_ingestion.alerts.criteria`; comments SQL |
| 2. Esquema FTS + `pg_trgm` (migración) | OK | Minipasos 2.1–2.2; tipos TS regenerados |
| 3. Capa `apps/web/src/lib/queries` | OK | `searchTenders` → RPC `search_tenders`; FTS + trgm + filtros |
| 4. UI mínima de búsqueda | OK | `/search`: texto + CPV + importe; usa `searchTenders` |
| 5. Auth — sesión + perfil `public.users` | OK | Minipasos 5.1–5.2; login/account mínimos |
| 6. Auth UI + RLS verificado (A≠B) | OK | `/register` `/alerts`; `verify:rls` Alice≠Bob |
| 7. Matching batch → `notification_queue` | Pendiente | Minipasos 7.1–7.2 |
| 8. Resend + digest diario (idempotente) | Pendiente | Secretos fuera de Git; `instant` N/A o diferido |
| 9. CLI + workflow alertas | Pendiente | Dry-run default; cron off |
| 10. Recorrido E2E local (buscar → alerta → email) | Pendiente | |
| 11. Cierre (CHANGELOG / tipos / ADR) | Pendiente | ADR N/A salvo decisión estructural |

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
| 7.1 Evaluador de reglas (criteria → tenders) | Pendiente | Tests sin red |
| 7.2 Encolado idempotente (`idempotency_key`) | Pendiente | 2ª pasada no duplica / no reenvía |

## Criterios transversales (cierre Semana 5)

| Ítem | Estado | Notas |
|---|---|---|
| Sin motor de búsqueda externo | Pendiente | Solo PostgreSQL FTS/GIN/trgm |
| `service_role` fuera del frontend | OK | Solo publishable en web |
| Alertas batch-first (no email por INSERT bruto) | Pendiente | |
| Reejecutar batch no reenvía notificaciones `sent` | Pendiente | |
| RLS owner-only verificado (usuario A ≠ B) | OK | `apps/web/scripts/verify-rls-alerts.mjs` |
| Tests relevantes en verde (queries / matching / RLS) | Pendiente | |
| ADRs estructurales (solo si hubo decisión nueva) | Pendiente | Default esperado: N/A |
| CHANGELOG actualizado | Pendiente | |

## Criterios de salida `docs/04` § Semana 5

| Criterio | Estado | Evidencia |
|---|---|---|
| Búsqueda de términos normales → resultados relevantes | Pendiente | |
| Errata razonable cubierta por `pg_trgm` | Pendiente | |
| Un usuario no accede a datos privados de otro | OK | `verify:rls` Alice crea alerta; Bob no la ve |
| Crear alerta → ejecutar batch → recibir email | Pendiente | |
| Reejecutar el batch no reenvía notificaciones ya enviadas | Pendiente | |

**Semana 5 en curso.** No mergear a `main` hasta OK explícito.
