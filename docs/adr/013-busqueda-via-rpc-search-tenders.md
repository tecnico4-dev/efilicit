# 013 - Búsqueda canónica vía RPC `search_tenders` (SECURITY INVOKER)

**Fecha:** 29-09-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

Semana 5 exige búsqueda sobre el modelo canónico con **PostgreSQL FTS + GIN + `pg_trgm`**, filtros estructurados y queries centralizadas en `apps/web/src/lib/queries` — sin Elasticsearch/OpenSearch ni lógica de datos en componentes React.

Había dos formas naturales de cablearlo en el cliente Supabase:

1. Componer en TypeScript llamadas PostgREST (`.textSearch()`, filtros, etc.) y mezclar FTS + trigram + ranking en la app.
2. Exponer una **función SQL** (`RPC`) que encapsule ranking, filtros Criteria v1 y joins, y que la capa `lib/queries` solo la invoque.

La opción (1) dispersa el ranking (erratas, `ts_rank`, `strict_word_similarity`, `match_kind`) entre cliente y DB, dificulta mantener un contrato único y complica tests/EXPLAIN. La (2) fija “la” búsqueda oficial en un solo sitio versionado por migración.

El canónico de licitaciones es legible con `anon` / `authenticated` (ADR 003): cualquier RPC debe respetar ese modelo de acceso, no elevar privilegios con `service_role` ni `SECURITY DEFINER` innecesario.

---

## Decisión

La búsqueda de producto se hace así:

1. Función SQL `public.search_tenders(...)` — `SECURITY INVOKER`, `stable`, `search_path = public, extensions`.
2. Implementa FTS + `pg_trgm` (incl. refinamientos de similitud de palabra) + filtros alineados con Criteria v1; devuelve filas tipadas + `rank` + `match_kind`.
3. Grants: `EXECUTE` a `anon` y `authenticated` (sin `service_role` en el navegador).
4. Capa web: `searchTenders()` en `apps/web/src/lib/queries/search-tenders.ts` → `client.rpc("search_tenders", …)`.
5. UI (`/search`) y futuros consumidores (p. ej. previews) usan esa capa; no reimplementan ranking en React.

Migraciones de referencia: `20260929100000_semana5_search_tenders_rpc.sql` y sucesivas de similitud / `match_kind`.

### Alternativas descartadas

- **Solo PostgREST compuesto en el cliente.** Descartada: ranking FTS+trgm+filtros repartido; contrato inestable; peor trazabilidad SQL.
- **RPC `SECURITY DEFINER`.** Descartada: saltaría RLS del invocador; riesgo de leer de más si la function no filtra bien.
- **Motor externo (Elasticsearch, etc.).** Descartada: contradice arquitectura fija; requeriría ADR propio y no hace falta en Semana 5.
- **Vista materializada / API HTTP propia solo para buscar.** Descartada: infra extra sin limitación medida de Postgres.

---

## Consecuencias

### Positivas

- Un contrato claro: “buscar = llamar `search_tenders`”.
- Ranking y erratas evolucionan en migraciones SQL; la UI no se entera del detalle.
- `SECURITY INVOKER` mantiene el modelo de lectura pública del canónico (ADR 003).

### Negativas / riesgos

- Cambios de firma de la RPC obligan a regenerar tipos TS y tocar `lib/queries`.
- Lógica compleja en SQL exige cuidado en migraciones (ya hubo iteraciones de `word_similarity` / `strict_word_similarity`).
- Quien busque “a mano” con PostgREST puede obtener resultados distintos; este ADR marca la RPC como vía oficial.

---

## Verificación

- Función `public.search_tenders` en migraciones Semana 5; grants a `anon`/`authenticated`.
- `apps/web/src/lib/queries/search-tenders.ts` + UI `/search`.
- `docs/plans/semana05-plan.md` Paso 3; checklist Fase 5.

---

## Referencias

- `docs/01-arquitectura-fija.md` (búsqueda Postgres FTS / GIN / `pg_trgm`)
- `docs/04-roadmap-mvp.md` § Semana 5
- `docs/plans/semana05-plan.md` · `docs/plans/fase5-checklist.md`
- [ADR 003](003-acceso-canonico-publico-etl-privado.md) (canónico legible; sin `service_role` en browser)
- `supabase/migrations/20260929100000_semana5_search_tenders_rpc.sql`
- `apps/web/src/lib/queries/search-tenders.ts`
