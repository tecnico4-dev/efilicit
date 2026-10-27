# Fase 6 / Semana 6 — checklist

Plan: [semana06-plan.md](semana06-plan.md). Criterios: `docs/04-roadmap-mvp.md` § Semana 6.

Los pasos globales (0–11) se mantienen. El estado se marca **aquí**, no con “— OK” en el plan.

## Pasos globales

| Ítem | Estado | Notas |
|---|---|---|
| 0. Kit visual corporativo (brand) | Hecho | Extraído de efilumen-web → `docs/brand/`; logo oficial pendiente (no bloquea) |
| 1. Design system base en `apps/web` | Hecho | Tokens + shell + Button/Input; tema dark default + toggle claro (`next-themes`) |
| 2. Buscador — UX de producto | Hecho | `/search` con tokens, sin placeholders/ejemplos; layout simple (sin overbuild) |
| 3. Ficha de licitación | Hecho | `/tenders/[id]` + enlace desde `/search`; campos MVP canónicos |
| 4. Multi-fuente en ficha | Hecho | Lista `tender_sources` en `/tenders/[id]` + badge canónica |
| 5. Favoritos / seguimiento | Hecho | Tabla `favorites` + RLS; toggle en ficha (solo sesión); `/favorites`; `verify:rls:favorites` |
| 5b. Notificaciones favoritos | Hecho | Buzón `/notifications`: cambios de estado (`tender_events` ∩ favoritos); puntito vía `users.notifications_read_at` |
| 6. Alertas — gestión de producto | Hecho | `/alerts` crear/editar/activar; criteria v1; crear desde `/search` |
| 7. Dashboard básico | Hecho | `/` autenticada: resumen alertas/favoritos/búsquedas + CTAs |
| 8. Estados + responsive global | Hecho | `ErrorState`/`EmptyState`/`RouteSkeleton`; `loading.tsx` en rutas MVP; nav Favoritos táctil; padding móvil unificado |
| 9. Hardening (RLS, healthchecks, runbooks, CI) | Hecho | Inventario RLS + `verify_rls_enabled.sql`; CLI `source-health`; runbooks; CI en PRs |
| 10. Cron / programación (decisión) | Hecho | Schedules on (ADR 005 enmienda); alertas diario 08:00 UTC; ingestas lun 05–07 UTC |
| 11. Cierre MVP (CHANGELOG / ADR) | Pendiente | |

## Criterios transversales (cierre Semana 6)

| Ítem | Estado | Notas |
|---|---|---|
| Web consume solo modelo canónico | Hecho | Queries/RPC; sin parsers en `apps/web` |
| `service_role` fuera del frontend | Hecho | Solo publishable/anon en web; service en Actions/ingestion |
| RLS owner-only en datos de usuario (favoritos/alertas) | Hecho | `verify:rls` + `verify:rls:favorites`; inventario Paso 9 |
| Brand corporativo documentado y aplicado | Hecho | Documentado + shell y rutas MVP; Paso 8 unifica estados |
| CI verde (lint / typecheck / tests / build) | Hecho | Workflow CI; PRs disparan web + ingestion |
| Cron prod solo con OK explícito | Hecho | Paso 10: schedules activos |
| ADRs estructurales (si hubo) | N/A | Paso 9 sin ADR nuevo |
| CHANGELOG actualizado | En curso | Paso 9 documentado; cierre en Paso 11 |

## Criterios de salida `docs/04` § Semana 6

| Criterio | Estado | Evidencia |
|---|---|---|
| Usuario se registra | N/A / invite-only | [ADR 016](../adr/016-auth-invite-only-sin-registro-publico.md); alta por invitación |
| Busca licitaciones integradas | Hecho | `/search` + ficha + favoritos |
| Consulta la ficha | Hecho | Abrir resultado de búsqueda → `/tenders/[id]` |
| Guarda una búsqueda | Hecho | Botón en `/search` + form en `/alerts` |
| Crea una alerta | Hecho | `/alerts` + «Crear alerta» en `/search` (sesión) |
| Recibe un email | Pendiente | Resend; dominio eficen vía IT si aplica |
| Fuentes se ejecutan programadamente | Hecho | Cron ingestas + digest (Paso 10) |
| Jobs idempotentes | Hecho | Pipelines + alertas; revalidado en corridas S2–S5 |
| Trazabilidad hasta RAW | Hecho | `source_artifacts` + Storage; runbooks |
| Seguridad y CI revisados | Hecho | Paso 9 (RLS inventory + CI) |
| Documentación al día | En curso | Runbooks + RLS; cierre formal Paso 11 |

**Semana 6 en curso** (Pasos 0–10 hechos; siguiente Paso 11 cierre). No mergear a `main` hasta OK explícito.
