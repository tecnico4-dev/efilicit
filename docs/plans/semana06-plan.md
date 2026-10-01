# Semana 6 — Plan: web integrada + cierre MVP

> **Estado:** en curso (Paso 0 siguiente: kit visual corporativo).  
> **Checklist:** [fase6-checklist.md](fase6-checklist.md)  
> **Precondición:** Semana 5 cerrada y en `main` ([fase5-checklist.md](fase5-checklist.md)).  
> **Norma:** `docs/00`–`04` y `.cursor/rules/`. La web sigue consumiendo el **modelo canónico**; sin parsers/RAW. ADR solo ante cambio estructural.  
> **Rama de trabajo:** `tecnico4/semana-06` (no mergear a `main` hasta OK explícito).  
> **Referencia de criterios:** `docs/04-roadmap-mvp.md` § Semana 6.

---

## Partimos de

Semana 5 dejó **cableado y verificado** (local):

| Pieza | Estado |
|---|---|
| Búsqueda FTS + `pg_trgm` + badge FTS/errata | OK — UI mínima “de prueba” |
| Auth SSR + RLS Alice≠Bob | OK |
| Alertas batch → cola → digest Resend | OK — Fake + real (correo personal); dominio `@eficen.com` → IT |
| CLI `run-alerts` + workflow `alerts-digest.yml` | OK — **cron off** |
| Ingestas PLACSP/CCAA | OK — cron off |

Meta de Semana 6 (`docs/04` § Semana 6):

1. **Web integrada** coherente: buscador, ficha, multi-fuente, favoritos, alertas, dashboard básico; estados carga/vacío/error; responsive.
2. **Hardening:** RLS revisado, CI verde, healthchecks por fuente, runbooks mínimos, docs al día.
3. Flujo E2E de producto: registrarse → buscar → ficha → guardar → alertar → email.

**Fuera / paralelo (no bloquea el diseño):**

- Verificar dominio Resend `eficen.com` (IT).
- Activar **cron** de ingestas/alertas en producción → solo con OK explícito (sigue el patrón Semanas 2–5).
- TED, subvenciones, motor de búsqueda externo, cola Redis, etc. → ADR si se plantean.

---

## Cómo lo hacemos

1. Cumplir tareas y criterios de `docs/04-roadmap-mvp.md` § Semana 6.
2. **Paso 0 primero:** kit visual desde el repo corporativo de la empresa (colores, tipografías, logos, patrones, copy). Sin esto no se rediseña “en serio”.
3. No invertir tiempo en pulir el copy/estética de la UI mínima de Semana 5: se **sustituye** al aplicar el design system.
4. Reutilizar `lib/queries` / Auth / RPC / motor de alertas; ampliar esquema solo con migraciones si hace falta (p. ej. favoritos).
5. `service_role` nunca en el navegador; secretos fuera de Git.
6. Pasos pequeños y verificables; push a la rama; merge a `main` solo con OK explícito.
7. ADR solo ante cambio estructural; default esperado: N/A o pocos ADR puntuales.
8. El acabado visual es 🎨 libre en roadmap, pero en este proyecto se **ancla** al brand corporativo documentado en Paso 0.

---

## Pasos

### 0. Kit visual corporativo (brand)

Recabar del **otro repositorio web de la empresa** (acceso del equipo) y documentar en el repo EfiLicit (p. ej. `docs/brand/` o equivalente breve):

- colores / tokens CSS;
- tipografías;
- logos / assets (sin secretos; respetar licencia/uso interno);
- patrones de layout (nav, botones, formularios);
- reglas de copy si existen.

No copiar la app entera ni mezclar código ajeno sin revisión. El entregable es una **guía + tokens** usables por `apps/web`.

**Listo cuando:** documento de brand en el repo; checklist Paso 0; decisión de ubicación de tokens registrada en [Decisiones](#decisiones-durante-la-ejecución).

### 1. Design system base en `apps/web`

Aplicar tokens del Paso 0 (CSS variables / Tailwind theme), tipografía, fondo/brand, componentes base (botón, input, nav shell). Quitar look “placeholder” de Semana 5 en layout global.

**Listo cuando:** home + shell con identidad corporativa; sin ficha completa aún.

### 2. Buscador — UX de producto

Rediseñar `/search` (sin textos de demo innecesarios): resultados claros, filtros, estados vacío/carga/error, responsive. Misma capa `searchTenders`.

**Listo cuando:** búsqueda usable en móvil/desktop con el nuevo look.

### 3. Ficha de licitación

Ruta de detalle sobre el canónico (campos MVP). Enlaces desde resultados de búsqueda.

**Listo cuando:** abrir una licitación desde `/search` muestra ficha legible.

### 4. Multi-fuente en ficha

Mostrar las fuentes (`tender_sources`) de la misma licitación canónica.

**Listo cuando:** una tender con varias fuentes las lista en la ficha.

### 5. Favoritos / seguimiento

Persistencia + RLS owner-only (migración si no existe tabla). UI mínima: marcar/desmarcar desde ficha o lista.

**Listo cuando:** usuario A ve solo sus favoritos; script o prueba A≠B.

### 6. Alertas — gestión de producto

Pulir `/alerts` (y flujo desde búsqueda/ficha si aplica): crear/editar/activar con criteria v1; sin copy de prueba.

**Listo cuando:** flujo crear alerta alineado al nuevo diseño; batch local sigue funcionando.

### 7. Dashboard básico

Vista autenticada resumida (p. ej. alertas activas, favoritos recientes, accesos a buscar). Sin overbuild.

**Listo cuando:** `/` o `/dashboard` autenticado tiene un propósito claro.

### 8. Estados + responsive global

Carga, vacío, error en las rutas principales; revisión móvil de shell + búsqueda + ficha + alertas.

**Listo cuando:** checklist UX de estados cubierto en rutas MVP.

### 9. Hardening

- Revisar RLS tablas expuestas.
- Healthchecks por fuente (alcance acordado).
- Runbooks mínimos: `source-down.md`, `reprocess-source-date.md` (+ `replay-artifact.md` si el pipeline lo soporta).
- CI verde (lint / typecheck / tests / build).

**Listo cuando:** ítems de hardening del roadmap marcados o N/A justificado.

### 10. Cron / programación (decisión explícita)

Documentar y, solo con OK, activar o dejar off los crons de ingesta/alertas. Default: **seguir off** hasta entorno + secretos + dominio email listos.

**Listo cuando:** decisión registrada; YAML acorde (cron comentado o activo con OK).

### 11. Cierre MVP

CHANGELOG, checklist Fase 6, ADR N/A o ADRs puntuales, handoff. Criterios de salida `docs/04` § Semana 6.

**Listo cuando:** checklist cerrado; merge a `main` solo con OK explícito.

---

## Decisiones durante la ejecución

| Cuándo | Decisión | Motivo / consecuencia |
|---|---|---|
| Inicio Semana 6 | Ejecutar **paso a paso** con revisión | Igual que Semanas 0–5 |
| Plan | Rama `tecnico4/semana-06`; plan/checklist solo en esta rama al inicio | No ensuciar `main` con borradores S6 |
| Plan | **Paso 0 = brand corporativo** antes de rediseñar | Evitar inventar look; alinear con web Eficen |
| Plan | No pulir copy UI Semana 5; se reemplaza en Pasos 1–2 | Ahorrar trabajo desechable |
| Plan | Cron prod sigue **off** hasta Paso 10 + OK | Mismo patrón que ingestas/alertas S2–S5 |
| Plan | Dominio Resend `@eficen.com` es vía IT, paralelo | No bloquea diseño web |

---

## Referencias

- [docs/04-roadmap-mvp.md](../04-roadmap-mvp.md) § Semana 6  
- [fase6-checklist.md](fase6-checklist.md) · [semana05-plan.md](semana05-plan.md) · [fase5-checklist.md](fase5-checklist.md)  
- Búsqueda: `apps/web/src/lib/queries/search-tenders.ts` · RPC `search_tenders`  
- Alertas: `efilicit_ingestion.alerts` · workflow `alerts-digest.yml`  
- Auth/RLS: `@supabase/ssr` · `verify:rls`
