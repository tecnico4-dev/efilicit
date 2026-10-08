# Fase 6 / Semana 6 — checklist

Plan: [semana06-plan.md](semana06-plan.md). Criterios: `docs/04-roadmap-mvp.md` § Semana 6.

Los pasos globales (0–11) se mantienen. El estado se marca **aquí**, no con “— OK” en el plan.

## Pasos globales

| Ítem | Estado | Notas |
|---|---|---|
| 0. Kit visual corporativo (brand) | Hecho | Extraído de efilumen-web → `docs/brand/`; logo oficial pendiente (no bloquea) |
| 1. Design system base en `apps/web` | Hecho | Tokens + shell + Button/Input; tema dark default + toggle claro (`next-themes`) |
| 2. Buscador — UX de producto | Hecho | `/search` rediseñado: filtros, vacío/error/carga, responsive; misma `searchTenders` |
| 3. Ficha de licitación | Pendiente | |
| 4. Multi-fuente en ficha | Pendiente | `tender_sources` |
| 5. Favoritos / seguimiento | Pendiente | + RLS A≠B |
| 6. Alertas — gestión de producto | Pendiente | |
| 7. Dashboard básico | Pendiente | |
| 8. Estados + responsive global | Pendiente | carga / vacío / error |
| 9. Hardening (RLS, healthchecks, runbooks, CI) | Pendiente | |
| 10. Cron / programación (decisión) | Pendiente | Default: cron **off** hasta OK |
| 11. Cierre MVP (CHANGELOG / ADR) | Pendiente | |

## Criterios transversales (cierre Semana 6)

| Ítem | Estado | Notas |
|---|---|---|
| Web consume solo modelo canónico | Pendiente | |
| `service_role` fuera del frontend | Pendiente | |
| RLS owner-only en datos de usuario (favoritos/alertas) | Pendiente | |
| Brand corporativo documentado y aplicado | En curso | Documentado + shell/home/login; resto de rutas en Pasos 2–7 |
| CI verde (lint / typecheck / tests / build) | Pendiente | |
| Cron prod solo con OK explícito | Pendiente | |
| ADRs estructurales (si hubo) | Pendiente | Default: N/A |
| CHANGELOG actualizado | En curso | Paso 0 documentado; se sigue actualizando por paso hasta el cierre |

## Criterios de salida `docs/04` § Semana 6

| Criterio | Estado | Evidencia |
|---|---|---|
| Usuario se registra | Pendiente | |
| Busca licitaciones integradas | En curso | `/search` usable (Paso 2); ficha/favoritos pendientes |
| Consulta la ficha | Pendiente | |
| Guarda una búsqueda | Pendiente | |
| Crea una alerta | Pendiente | |
| Recibe un email | Pendiente | Resend; dominio eficen vía IT si aplica |
| Fuentes se ejecutan programadamente | Pendiente | O N/A justificado si cron sigue off con OK |
| Jobs idempotentes | Pendiente | Ya en ingestas/alertas; revalidar |
| Trazabilidad hasta RAW | Pendiente | |
| Seguridad y CI revisados | Pendiente | |
| Documentación al día | Pendiente | |

**Semana 6 en curso.** No mergear a `main` hasta OK explícito.
