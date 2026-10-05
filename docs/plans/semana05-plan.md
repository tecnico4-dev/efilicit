# Semana 5 — Plan: búsqueda + autenticación + alertas

> **Estado:** **cerrada** y fusionada en `main` (`4f53ba3`).  
> **Checklist:** [fase5-checklist.md](fase5-checklist.md)  
> **Precondición:** Semana 4 cerrada ([fase4-checklist.md](fase4-checklist.md)).  
> **Norma:** `docs/00`–`04` y `.cursor/rules/`. Consumir el **modelo canónico** ya poblado; no inventar motor de búsqueda externo ni colas fuera de PostgreSQL. ADR solo si hace falta cambiar arquitectura de verdad.  
> **Rama de trabajo:** `tecnico4/semana-05` (cerrada).  
> **Referencia de criterios:** `docs/04-roadmap-mvp.md` § Semana 5.

---

## Partimos de

Semanas 1–4 dejan **datos canónicos reales**, deduplicación funcional y un **esqueleto** de usuarios/alertas **sin lógica de producto**:

| Pieza | Estado al cerrar Semana 4 |
|---|---|
| `tenders` + B-tree (fecha, importe, estado, CPV, deadline) | OK — sin `search_vector` / GIN FTS / `pg_trgm` |
| Fuentes integradas (`placsp`, `placsp_agregadas`, `placsp_menores`, `catalunya`, `euskadi`) | OK — upsert + matching multi-fuente |
| `users` / `saved_searches` / `alerts` / `notification_queue` | Esqueleto Semana 1 + RLS owner-only |
| `apps/web` | Fase 0: healthcheck + cliente anon; `lib/queries` vacío |
| Auth UI / sesión SSR | No |
| Motor de alertas batch / Resend / Edge Functions | No (carpeta `supabase/functions/` vacía) |
| Workflows | Solo CI + ingestas; sin job de alertas |

Meta de Semana 5 (`docs/04` § Semana 5):

1. **Búsqueda** sobre el canónico: FTS + GIN + `pg_trgm` + filtros B-tree; queries centralizadas.
2. **Auth** con Supabase Auth, perfil ligado a `auth_user_id`, `saved_searches` / `alerts` usables; **RLS verificado**.
3. **Alertas batch-first:** match → score/prioridad → dedupe → `notification_queue` → email (Resend); digest **diario o semanal** (preferencia de cuenta); reejecutar no reenvía.

Fuera de esta semana (Semana 6+): web integrada completa (ficha pulida, favoritos, dashboard), hardening/observabilidad amplia, UI de revisión humana de matches `pending`, TED, subvenciones, motor externo, cron de producción de ingestas.

---

## Cómo lo hacemos

1. Cumplir tareas y criterios de `docs/04-roadmap-mvp.md` § Semana 5.
2. Búsqueda **solo** con PostgreSQL (FTS + GIN + `pg_trgm`); **sin** Elasticsearch/OpenSearch ni ADR improvisado.
3. La web consume el **modelo canónico**; no parsers ni RAW.
4. Queries en `apps/web/src/lib/queries` (o capa equivalente); no lógica de datos en componentes React.
5. Auth con claves publishable/anon en frontend; **`service_role` nunca en el navegador**.
6. Alertas **batch-first**: no email por cada `INSERT` de ingesta; no webhooks como motor masivo.
7. `notification_queue.idempotency_key` es la garantía de no reenvío; el batch debe usarla.
8. Frecuencia MVP: **digest diario o semanal a nivel de cuenta** (`users.digest_frequency`); un correo con todas las alertas del usuario. `instant` diferido (BACKLOG).
9. Resend vía backend/Edge Function (secretos en Supabase/GitHub/Vercel, no en Git).
10. Ampliar esquema **solo** con migraciones versionadas; regenerar tipos TS cuando cambie el esquema expuesto.
11. Pasos pequeños y verificables; secretos fuera del código; push/merge a `main` solo con OK explícito.
12. ADR solo ante cambio estructural real; si no, checklist en `N/A`.
13. UI de Semana 5 = **mínima verificable** (buscar, login, crear alerta, ver que llega email). El acabado de producto es Semana 6.

---

## Pasos

### 1. Contrato de criterios (alertas / búsquedas guardadas)

Definir el **shape** de `alerts.criteria` y `saved_searches.criteria` (JSON) que usará el motor y la UI, alineado con el roadmap:

- keywords;
- CPV;
- organismo;
- geografía;
- importe min/max;
- tipo de contrato;
- (opcional) procedimiento / ventanas de fechas.

Documentar el contrato en un sitio breve del repo (p. ej. comentario en migración, módulo Python de matching, o `docs/plans` Decisiones — **sin** editar `docs/00`–`04`). No hace falta normalizar a columnas tipadas si `jsonb` basta.

**Listo cuando:** shape acordado y registrado en [Decisiones](#decisiones-durante-la-ejecución); checklist Paso 1.

### 2. Búsqueda — esquema FTS + `pg_trgm`

Migración versionada sobre `tenders` (y joins necesarios):

- extensión `pg_trgm` si no está;
- columna `search_vector` (`tsvector`) generada/mantenida (título con más peso que objeto/descripción);
- índice **GIN** sobre `search_vector`;
- índice(s) **trigram** sobre título (y/o descripción) para erratas;
- reutilizar B-tree ya existentes (fecha, importe, estado, CPV); geografía vía join a `contracting_authorities` o campo justificado — **sin** inventar catálogo NUTS completo.

**Listo cuando (paso global):** `supabase db reset` local OK; tipos regenerados si el esquema expuesto cambia.

#### 2.1 Extensión + columna + trigger/generated

`search_vector` actualizado en INSERT/UPDATE (generated column o trigger). Pesos: título > descripción.

**Listo cuando:** fila insertada/actualizada refleja el vector; test SQL o integración mínima.

#### 2.2 Índices GIN + `pg_trgm` + filtros

GIN FTS; índice trgm; confirmar B-tree útiles para filtros del MVP.

**Listo cuando:** `EXPLAIN` (o test) muestra uso razonable de índices en consulta de ejemplo; `db reset` OK.

### 3. Búsqueda — capa de queries

Implementar acceso centralizado en `apps/web/src/lib/queries` (sustituir el placeholder):

- búsqueda por texto (FTS + fallback/`pg_trgm` cuando aporte);
- filtros estructurados (estado, CPV, rango de importe/fecha, geografía si aplica);
- ranking básico por relevancia (🎨 libre el detalle).

Sin motor externo. Tipado con `packages/types`.

**Listo cuando:** tests o script local demuestran resultados relevantes + caso de errata razonable; sin UI todavía o con smoke.

### 4. Búsqueda — UI mínima verificable

Página/ruta de búsqueda en Next.js que use las queries del Paso 3: caja de texto, filtros básicos, lista de resultados. UX 🎨 libre; no dashboard ni ficha completa (Semana 6).

**Listo cuando:** con datos locales, un término normal y una errata razonable muestran resultados; checklist Paso 4.

### 5. Auth — sesión y perfil `public.users`

Cablear Supabase Auth en la web (patrón SSR/cookies del stack Next del repo; p. ej. `@supabase/ssr` si se adopta):

- cliente servidor + browser sin `service_role`;
- al registrarse / primer login: crear/asegurar fila en `public.users` ligada a `auth_user_id` (trigger SQL y/o upsert desde la app — 🎨 libre el cómo);
- seed Alice/Bob usable para pruebas RLS si hace falta ampliar `seed.sql`.

**Listo cuando (paso global):** usuario local puede autenticarse y existe fila en `public.users`.

#### 5.1 Clientes Supabase (browser + server) + middleware/sesión

**Listo cuando:** sesión persistente en rutas protegidas; publishable key only en cliente.

#### 5.2 Sync `auth.users` → `public.users`

**Listo cuando:** signup/login deja perfil; no duplica `auth_user_id`.

### 6. Auth — UI + RLS verificado explícitamente

- Pantallas mínimas de registro / login / logout.
- CRUD mínimo de `saved_searches` y `alerts` (o al menos create/list propio) vía cliente autenticado.
- **Prueba explícita de RLS** (como en `docs/02` §13): usuario A lee lo suyo; no lee alertas/búsquedas de B. Preferible test automatizado o script documentado reproducible.

**Listo cuando:** prueba A≠B documentada en verde; un usuario no accede a datos privados de otro.

### 7. Alertas — matching batch → `notification_queue`

Motor batch (Python en `ingestion/`, mismo espíritu que los jobs ETL) que:

```text
NEW/UPDATED (ventana)
    ↓
match (criteria)
    ↓
score / priority (mínimo viable)
    ↓
dedupe
    ↓
notification_queue
```

- Lee alertas `is_active`; aplica el contrato del Paso 1.
- Inserta en `notification_queue` con `status`, `idempotency_key`, `attempts`, timestamps, `payload`, `error`/`last_error` según esquema existente.
- **No** envía email aquí todavía (Paso 8), o deja `pending` listo para drenar.
- Idempotencia: misma clave → no fila duplicada / no reenvío.

**Listo cuando (paso global):** tests sin red (fixtures de tenders + alertas) cubren match / no-match / dedupe de cola.

#### 7.1 Evaluador de reglas

**Listo cuando:** unit tests de criteria → conjunto de `tender_id` esperados.

#### 7.2 Encolado idempotente

**Listo cuando:** 2ª ejecución del batch no crea claves duplicadas ni reabre enviados.

### 8. Alertas — envío Resend (digest diario / semanal)

Integrar Resend según arquitectura fija (email del proyecto):

- secretos `RESEND_API_KEY` / `ALERT_FROM_EMAIL` solo en entorno (local `.env`, GitHub/Supabase secrets);
- mecanismo: **Edge Function** y/o drenado desde el job batch (registrar decisión); sin exponer la API key al frontend;
- frecuencia MVP: preferencia de cuenta `daily` | `weekly` (`public.users.digest_frequency`); un email por usuario/periodo con todas las coincidencias pendientes;
  - `daily`: periodo = día; envío cuando corre el job;
  - `weekly`: periodo = semana ISO; envío solo **lunes UTC**; el resto de días se encola y queda `pending`;
- `alerts.frequency` se sincroniza desde la preferencia de cuenta (no hay selector por alerta);
- marcar `sent` / `failed` + `attempts` + `sent_at` / `last_error`.

`instant` queda **diferido** (BACKLOG); no forma parte del MVP de Semana 5.

**Listo cuando:** en local (o entorno de prueba), elegir frecuencia en cuenta → crear alerta → correr batch → recibir email de digest; reejecutar batch **no** reenvía lo ya `sent`; usuario `weekly` en martes no recibe email.

### 9. Alertas — CLI + workflow

- Entrypoint CLI (p. ej. `run-alerts` / subcomando) con dry-run por defecto.
- Workflow GitHub Actions `alerts-digest.yml` (o nombre equivalente): `workflow_dispatch`, dry-run default, **cron off** hasta OK explícito (mismo patrón que ingestas).

**Listo cuando:** CLI documentado en README/CHANGELOG breve; workflow en repo; sin cron de producción.

### 10. UI mínima de alertas + recorrido E2E local

En la web autenticada: crear/activar una alerta con criteria del Paso 1; disparar el batch local; comprobar cola + email (Paso 8). No hace falta dashboard ni diseño final.

**Listo cuando:** recorrido “registrarse → buscar → crear alerta → batch → email” reproducible en local; criterios de salida del roadmap cubiertos.

### 11. Catálogo de cierre

Actualizar CHANGELOG, regenerar tipos si faltó, marcar [fase5-checklist.md](fase5-checklist.md). ADR `N/A` o ADR nuevo solo si hubo decisión estructural (p. ej. cola externa — **no** previsto).

**Listo cuando:** criterios de salida de `docs/04` § Semana 5 cumplidos.

**Fuera de alcance (→ Semana 6+):** ficha de licitación completa, favoritos/seguimiento, dashboard, responsive/polish, healthchecks por fuente, runbooks, cron de producción de ingestas/alertas, revisión humana de `match_suggestions`, TED, subvenciones, infra nueva sin ADR.

---

## Decisiones durante la ejecución

Registro de lo acordado al cerrar (o antes de) cada paso:

| Cuándo | Decisión | Motivo / consecuencia |
|---|---|---|
| Inicio Semana 5 | Ejecutar **paso a paso** con revisión | Igual que Semanas 0–4 |
| Plan | Rama de trabajo = `tecnico4/semana-05` | No mergear a `main` hasta OK explícito |
| Plan | Sin ADRs previos; ADR solo si hay cambio estructural | Respetar arquitectura ya fijada |
| Plan | Búsqueda = FTS + GIN + `pg_trgm` en PostgreSQL | Fijo en `docs/01` / `docs/04`; sin motor externo |
| Plan | Reutilizar esqueleto Semana 1 (`users`/`alerts`/`notification_queue`) | Ampliar con migraciones solo si hace falta |
| Plan | UI mínima verificable; acabado en Semana 6 | Criterios de salida S5 ≠ web completa |
| Plan | Digest diario **o** semanal a nivel de cuenta = MVP; `instant` diferido | Un correo por usuario/periodo; weekly = lunes UTC; [ADR 012](../adr/012-alert-frequencies-daily-weekly-instant-diferido.md) |
| Plan | Matching batch en Python (job GH Actions); envío Resend con secretos fuera del frontend | Batch-first; Edge Function u job drain — concretar en Paso 8 |
| Plan | Criteria de alerta/búsqueda en `jsonb` con shape acordado (Paso 1) | Esqueleto ya usa `criteria jsonb`; evitar DDL prematuro |
| Plan | Geografía en búsqueda vía join a organismo / campo justificado | `tenders` hoy sin columna geo; no inventar catálogo NUTS |
| Plan | Favoritos / dashboard / ficha completa → Semana 6 | Fuera del corte S5 del roadmap |
| Paso 1 | Criteria v1 compartido (TS + Python + comments SQL) | Sin columnas tipadas; `jsonb` + `version: 1`; AND/OR; alerta vacía = sin matches |
| Paso 1 | Mismos campos para `alerts` y `saved_searches` | Roadmap: keywords, CPV, organismo, geo, importe, tipo (+ opcionales) |
| Paso 1 | Organismo: `tax_ids` primario; `name_contains` débil | Alineado con identidad canónica (NIF/CIF) |
| Paso 2 | `search_vector` generated stored (spanish A/B) + GIN + `title` trgm | Sin trigger manual; B-tree filtros Semana 1 reutilizados; geo vía join |
| Paso 2 | Extensión `pg_trgm` en schema `extensions` | Convención Supabase (`extra_search_path`) |
| Paso 3 | RPC `search_tenders` (SECURITY INVOKER) + `lib/queries` | FTS + trgm + filtros Criteria v1; ranking `greatest(ts_rank, similarity, strict_word_similarity)`; no motor externo ([ADR 013](../adr/013-busqueda-via-rpc-search-tenders.md)) |
| Paso 4 | UI mínima `/search` (form GET + `searchTenders`) | Texto + CPV + importe; badge FTS/errata/filtro; sin ficha/dashboard |
| Paso 5 | `@supabase/ssr` + middleware + trigger `handle_new_user` | Login/account mínimos; seed Alice/Bob → `public.users`; sin service_role |
| Paso 6 | `/register` + `/alerts` CRUD mínimo + script RLS | `pnpm --filter @efilicit/web verify:rls` → Alice≠Bob OK; fondo blanco fijo hasta Semana 6 |
| Paso 7 | Motor batch Python `alerts/` (match → cola) | Tests sin red; `idempotency_key` por alerta+tender+digest; sin email aún |
| Paso 8 | Digest diario/semanal + Resend (`FakeEmailSender` / `ResendEmailSender`) | Preferencia `users.digest_frequency`; drain por usuario+periodo; weekly solo lunes UTC; Edge Function N/A ([ADR 011](../adr/011-digest-email-job-python-sin-edge-function.md)); `instant` diferido ([ADR 012](../adr/012-alert-frequencies-daily-weekly-instant-diferido.md)) |
| Paso 9 | CLI `run-alerts` + workflow `alerts-digest.yml` | Dry-run default (fixtures+Fake); `--write` / `--send`; cron off |
| Paso 10 | E2E local buscar → alerta → batch → digest | Guía `semana05-e2e-local.md`; Resend OK (personal); dominio eficen → IT |
| Post-Paso 10 | Erratas `strict_word_similarity` / `<<%` + badge literal | `foas` fuera; stemming-only → badge errata; `similarity` / `%` se mantiene |
| Paso 11 | Cierre | CHANGELOG; ADRs 011–013; tipos N/A (firma RPC intacta); checklist cerrado; cron alertas sigue off |

---

## Referencias

- [docs/04-roadmap-mvp.md](../04-roadmap-mvp.md) § Semana 5 (y §1 corte MVP: buscador + Auth + alertas)  
- [docs/01-arquitectura-fija.md](../01-arquitectura-fija.md) §§ 1, 7, 9 (stack búsqueda/email, seguridad, orden Auth/Alertas)  
- [docs/00-onboarding.md](../00-onboarding.md) (bloques búsqueda, Auth, alertas, digest, Resend)  
- [docs/02-setup-entorno.md](../02-setup-entorno.md) §9 secretos · §13 prueba Auth/RLS  
- Migración esqueleto: `supabase/migrations/20260909133000_semana1_users_alerts_skeleton.sql`  
- [fase5-checklist.md](fase5-checklist.md) · [semana04-plan.md](semana04-plan.md) · [fase4-checklist.md](fase4-checklist.md)
- Contrato criteria v1: [`packages/types/src/criteria.ts`](../../packages/types/src/criteria.ts) · `efilicit_ingestion.alerts.criteria`
- Búsqueda Paso 3: [`apps/web/src/lib/queries/search-tenders.ts`](../../apps/web/src/lib/queries/search-tenders.ts) · RPC `public.search_tenders`
