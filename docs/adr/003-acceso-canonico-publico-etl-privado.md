# 003 - Acceso a datos Semana 1: canónico público, ETL privado

**Fecha:** 10-09-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

Semana 1 materializa el modelo canónico y las tablas operativas de ingesta. Los documentos base ya fijan que **la web consume el modelo canónico** y **no conoce parsers, RAW ni la plomería de cada fuente**. Eso no bastaba para cerrar, en el esquema, **quién puede leer qué** con la clave publishable/`anon` frente a procesos confiables (`service_role`).

Había que decidir dos capas complementarias:

1. ¿Los datos de contratación (licitaciones, organismos, etc.) son legibles **sin sesión**?
2. ¿Las tablas de bitácora ETL (`source_sync`, `source_artifacts`, `errors`) quedan **fuera** del frontend?

Además, la tabla `errors` aparece en el modelo fijado (`docs/00` / `01` / roadmap), así que se creó en la migración operativa junto a sync/artifacts. En la práctica, el fallo de una corrida se refleja hoy en **`source_sync`** (`status`, `error_message`, contadores), no en filas de `errors`.

---

## Decisión

### 1. Modelo canónico: lectura pública

Las tablas de dominio de contratación (`tenders`, `tender_sources`, `tender_events`, `contracting_authorities`, `suppliers`, `documents`) tienen:

- RLS activo;
- políticas `SELECT` para `anon` y `authenticated` con `using (true)`;
- **sin** grants de escritura a clientes: la escritura es solo vía proceso confiable / `service_role` (ETL).

Motivo: son datos de contratación pública; la publishable key + RLS es el camino natural del frontend (y de previews anónimas) sin exponer la plomería de ingesta.

### 2. Tablas ETL: opacas al cliente

`source_sync`, `source_artifacts` y `errors`:

- RLS activo;
- **sin** policies ni grants para `anon` / `authenticated`;
- solo procesos confiables (conexión directa / `service_role`) leen y escriben.

Esto **materializa en el esquema** la separación ya descrita en la arquitectura: la aplicación no depende del RAW ni del estado interno de sync.

### 3. Tabla `errors`: reserva de esquema, sin cablear aún

Se crea `public.errors` porque forma parte del núcleo fijado en la documentación inicial (errores operativos clasificables, enlazables a sync/artifact).

En Semana 1 (y mientras no haya necesidad medible de detalle fino):

- un fallo fuerte de pipeline cierra el run en **`source_sync`** (`failed` + `error_message`);
- las excepciones tipadas de conectores sirven para control de flujo y tests, **no** se persisten en `errors`;
- **`errors` queda sin escrituras** desde el código.

**Garantía de persistencia del fallo (corridas Postgres):** el upsert canónico y la bitácora comparten transacción. Si el pipeline falla a mitad, se hace **rollback** del trabajo canónico a medias, pero el cierre `failed` de `source_sync` se vuelve a escribir en una **transacción aparte** (`persist_failed_sync_run` / `run_pipeline_postgres`), para que la bitácora no desaparezca con el rollback. Eso refuerza la decisión de este ADR (“fallo → `source_sync`”), no introduce escritura en `errors`.

Se puede cablear `errors` más adelante (p. ej. fallos parciales por registro, cuadros de observabilidad) si aparece una necesidad real. Hasta entonces no se elimina: evita drift respecto al modelo fijado y deja el hueco listo sin inventar otra tabla.

### Alternativas descartadas

- **Canónico solo para `authenticated`.** Descartada: obliga a login para cualquier búsqueda pública y no aporta aislamiento multi-tenant sobre datos ya públicos.
- **Exponer `source_sync` / artifacts al frontend “para un dashboard rápido”.** Descartada: mezcla producto y plomería ETL; contradice “la app no conoce la ingesta”.
- **No crear `errors` hasta usarla.** Descartada en Semana 1: el roadmap y el modelo fijo la listan; se prefirió el esqueleto con la misma RLS que el resto del ETL, documentando el uso diferido aquí.
- **Meter cada fallo solo en logs de Actions / consola, sin `source_sync.error_message`.** Descartada: se pierde trazabilidad en la DB source of truth.

---

## Consecuencias

### Positivas

- Contrato claro: **público el canónico, privado el ETL**.
- El frontend puede buscar/listar con publishable key sin `service_role`.
- Queda explícito el papel (y el no-uso actual) de `errors`.

### Negativas / riesgos

- Cualquiera con la publishable key puede leer el canónico (aceptable para datos públicos; hay que vigilar no colar PII de usuario en esas tablas).
- `errors` vacía puede confundir si no se lee este ADR: mitigación = este documento + comentarios en la migración.
- Observabilidad granular de fallos parciales **aún no** está en DB.

---

## Verificación

- Políticas `*_select_public` en migración canónica; revoke/grant select a `anon`/`authenticated`.
- Migración operativa: revoke total de cliente sobre `source_sync` / `source_artifacts` / `errors`.
- Grep / revisión de código: ninguna escritura a `public.errors` en el paquete de ingesta; fallos de pipeline → `source_sync` failed (`finish_run` en memoria + `persist_failed_sync_run` tras rollback en corridas Postgres).

---

## Referencias

- `docs/01-arquitectura-fija.md` §§ 5–6, 9 (canónico, conector vs pipeline, seguridad)
- `docs/04-roadmap-mvp.md` § Semana 1
- `docs/plans/semana01-plan.md` · `docs/plans/fase1-checklist.md`
- `supabase/migrations/20260909103000_semana1_source_sync_artifacts_errors.sql`
- `supabase/migrations/20260909120000_semana1_canonical_core.sql`
- `ingestion/src/efilicit_ingestion/pipeline/runner.py` (cierre de run en fallo)
- `ingestion/src/efilicit_ingestion/pipeline/db_run.py` · `persist_failed_sync_run` (bitácora failed tras rollback)
