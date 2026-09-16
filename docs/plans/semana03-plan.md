# Semana 3 — Plan: escalado estatal + primeras CCAA

> **Estado:** en curso — progreso en [fase3-checklist.md](fase3-checklist.md).  
> **Checklist:** [fase3-checklist.md](fase3-checklist.md)  
> **Precondición:** Semana 2 cerrada ([fase2-checklist.md](fase2-checklist.md)).  
> **Norma:** `docs/00`–`04` y `.cursor/rules/`. Reutilizar contrato `SourceConnector` + pipeline + upsert canónico de Semanas 1–2. ADR solo si hace falta cambiar arquitectura de verdad.  
> **Rama de trabajo:** `tecnico4/semana-03` (no mergear a `main` hasta OK explícito).  
> **Verificación live:** [docs/pruebas.md](../pruebas.md) — Parte B (`placsp_agregadas`).

---

## Partimos de

Semana 2 dejó un **vertical slice PLACSP** sólido: `discover` → `fetch` → RAW → parse → normalize/identidad → upsert canónico → CLI → workflow controlado, con tests e idempotencia.

Meta de Semana 3 (`docs/04` § Semana 3): **reutilizar esa maquinaria** para ampliar cobertura estatal (menores / agregadas / sindicaciones compatibles) y añadir las **primeras CCAA** con mejor relación cobertura/esfuerzo — sin inventar un modelo de datos por fuente.

Fuera de esta semana (Semana 4+): cobertura de las 17 CCAA, deduplicación multi-fuente avanzada, FTS/Auth/alertas UI, TED, subvenciones.

---

## Cómo lo hacemos

1. Cumplir tareas y criterios de `docs/04-roadmap-mvp.md` § Semana 3.
2. Cada fuente nueva: ficha en `docs/sources/`, `source_sync`, fixture, tests, config de acceso y workflow/job.
3. Reutilizar adaptadores **solo** con compatibilidad técnica y semántica real (PLACSP Atom/CODICE, familia CSV, API REST/Socrata).
4. Fuente oficial primero; sin scraping si hay feed/API/Open Data adecuado.
5. Mismo modelo canónico y upsert `(source_code, source_tender_id)`; no DDL paralelo por fuente.
6. Priorizar cobertura/esfuerzo; si una CCAA se atasca: documentar bloqueo y pasar a la siguiente (regla de alcance del roadmap).
7. Usar [contratacionabierta.com](https://contratacionabierta.com/) como catálogo de **referencia**, no como verdad única; contrastar siempre con la fuente oficial.
8. Pasos pequeños y verificables; secretos fuera del código; push/merge a `main` solo con OK explícito.
9. ADR solo ante cambio estructural real; si no, checklist en `N/A`.

---

## Pasos

### 1. Inventario y priorización de fuentes

Listar candidatas estatales (sindicaciones PLACSP compatibles, menores, agregadas) y primeras CCAA propias según catálogo de referencia + documentación oficial.  
Registrar en este plan (tabla de decisiones) el orden de ataque y el motivo cobertura/esfuerzo. **No** implementar aún.

**Listo cuando:** lista priorizada acordada (estatal + ≥2 CCAA candidatas) con `source_code` provisional y tipo de adaptador esperado (PLACSP-reuse / CSV / REST-Socrata / propio).

**Cómo se usa esta lista:** el criterio de salida exige **≥2 CCAA implementadas**, no “solo documentar dos”. La tabla de CCAA es una **cola priorizada**: se atacan en orden; si una se bloquea, se documenta el bloqueo y se pasa a la **siguiente reserva**. No hace falta implementar todas en Semana 3.

#### Estatal (orden de implementación)

| Orden | `source_code` | Acceso oficial (referencia) | Adaptador | Motivo |
|---|---|---|---|---|
| 1 | `placsp_agregadas` | Hacienda `sindicacion_1044` · `PlataformasAgregadasSinMenores_*.zip` | PLACSP-reuse | Máxima cobertura territorial reutilizando Atom/CODICE |
| 2 | `placsp_menores` | Hacienda `sindicacion_1143` · `contratosMenoresPerfilesContratantes_*.zip` | PLACSP-reuse | Pedido en MVP; mismo patrón de reuso |

#### CCAA propias (cola priorizada: objetivo + reservas)

| Orden | Rol | `source_code` | Acceso oficial (referencia) | Adaptador | Notas |
|---|---|---|---|---|---|
| 1 | Objetivo Semana 3 | `catalunya` | Transparència Catalunya (Socrata) `ybgg-dgi6` | REST-Socrata | API madura; alta cobertura |
| 2 | Objetivo Semana 3 | `euskadi` | Open Data Euskadi / KontratazioA API REST | REST | Segunda CCAA; API oficial distinta |
| 3 | Reserva | `valencia` | `dadesobertes.gva.es` (CSV Open Data) | CSV | Si cae un objetivo; puede activar conector CSV puntual |
| 4 | Reserva | `jcyl` | `datosabiertos.jcyl.es` (CSV) | CSV | Alternativa Castilla y León |
| 5 | Reserva | `canarias` | `datos.canarias.es` (CSV) | CSV | Alternativa Canarias |
| 6 | Reserva | `asturias` | Perfil contratante / Open Data Asturias (CSV) | CSV | Volumen alto en catálogo de referencia |
| 7 | Reserva | `andalucia` | Portal datos abiertos Junta (verificar dataset vigente) | CSV / otro | URL previa 404 → validar ficha oficial antes de atacar |
| 8 | Reserva baja | `aragon` | Aragón Open Data (histórico hasta ~2021; luego PLACSP) | CSV / PLACSP | Cobertura propia limitada; preferir agregadas/PLACSP |
| 9 | Reserva baja | `madrid` | Feed Atom `contratos-publicos.comunidad.madrid/feed/licitaciones2` | Propio / Atom | Ya cubierto en gran parte vía `placsp_agregadas`; evitar duplicar |

- **CSV genérico de familia:** N/A en Semana 3 como adaptador transversal. Si al bajar por la cola hace falta una reserva CSV, se implementa el conector de esa fuente (y solo entonces se valora factorizar un adaptador CSV reutilizable).
- Catálogo de referencia: [contratacionabierta.com](https://contratacionabierta.com/); URLs concretas se confirman en la ficha de cada fuente al atacarla.
- Fuera de alcance Semana 3 (salvo sustitución por bloqueo): encargos `1383`, CPM `1403`, resto de CCAA no listadas aquí (Semana 4).

### 2. Documentar la primera fuente estatal ampliada

Crear/actualizar ficha en `docs/sources/` (mismo esquema que `placsp.md`: URL, acceso, formato, frecuencia, incremental, identificadores, límites, cobertura, exclusiones).

**Listo cuando:** documento revisable alineado con el acceso real que usaremos.

Primera ficha estatal: [docs/sources/placsp_agregadas.md](../sources/placsp_agregadas.md) — `sindicacion_1044`, feed `PlataformasAgregadasSinMenores`, ZIP mensuales oficiales, `source_code=placsp_agregadas`, adaptador PLACSP-reuse. Catálogo: [docs/sources/README.md](../sources/README.md).

### 3. Conector estatal — reutilizar / extender adaptador PLACSP

Si la fuente es Atom/CODICE o sindicación compatible: reutilizar el conector/plataforma PLACSP (configuración, URLs, `source_code`) en lugar de copiar el parser.  
Si no es compatible: documentar por qué y elegir CSV o REST según el Paso 1.

**Listo cuando (paso global):** `discover` y `fetch` listan/descargan artefactos con `artifact_key` estable; tests sin red.

#### 3.1 Discover

Parametrizar el conector (`PlacspSyndication` / `PLACSP_AGREGADAS`) para que `discover` liste los ZIP mensuales oficiales de `sindicacion_1044` (`PlataformasAgregadasSinMenores_YYYYMM.zip`) con ventana, cursor y probe opcional — **sin clonar** el conector de perfiles.

**Listo cuando:** tests sin red con `artifact_key` / `source_url` estables y `source_code=placsp_agregadas`.

#### 3.2 Fetch

Reutilizar `download_bytes` (timeout, retry, `max_bytes`, checksum) sobre el `source_url` descubierto. Cubrir con `fetch_transport` inyectado (discover→fetch, URL 1044, errores HTTP) — **sin descarga live en CI**.

**Listo cuando:** tests de fetch agregadas en verde; misma política que `placsp`.

### 4. RAW + parse + normalize + upsert (fuente estatal)

Misma tubería canónica que Semana 2, aplicada a `placsp_agregadas`: validate → Storage `raw` → `source_artifacts` → parse → normalize/identidad → upsert; `source_sync` actualizado. Fixtures (válido / incompleto / inesperado).

**Listo cuando (paso global):** corrida local (fixture o muestra controlada) deja sync success, RAW trazable y filas canónicas; reejecutar no duplica.

#### 4.1 Validar artefacto + guardar RAW

Tras el fetch: `validate_artifact` (p. ej. magic ZIP `PK`) → `store_raw` en bucket `raw` con prefijo `placsp_agregadas/...` → registrar fila en `source_artifacts` (checksum, `storage_path`). Reutilizar `fetch_validate_and_store_raw` / `SupabaseStorageArtifactStore` de Semana 2.

**Listo cuando:** test (mock o integración local) deja RAW + metadata; sin parse todavía.

#### 4.2 Parse Atom/CODICE → `SourceRecord`

Reutilizar el parser `lxml` de Semana 2 sobre el artefacto agregadas (misma familia CODICE). Fixtures propio o reutilizados etiquetados con este `source_code`. Casos válido / incompleto / inesperado; omitir entradas sin identidad estable.

**Listo cuando:** tests de parse en verde sin contaminar el DDL canónico.

#### 4.3 Normalize + identidad de organismos

Mapear a `payload.canonical` (fechas, importes, CPV, estados…) y `resolve_identity` (NIF/CIF prioritario; confidence HIGH/MEDIUM/LOW/UNRESOLVED). Reutilizar etapas del pipeline común.

**Listo cuando:** tests de normalización/identidad sobre fixtures agregadas (o fixtures CODICE compartidos con este `source_code`).

#### 4.4 Upsert canónico + `source_sync` + trazabilidad

Persistir en `tenders` / `tender_sources` / events / documents con unique `(placsp_agregadas, source_tender_id)`; actualizar `source_sync`; enlazar `artifact_id`. Probar reejecución (no duplica).

**Listo cuando:** corrida local con fixture deja filas canónicas + sync success; 2ª pasada → updated, no filas duplicadas.

#### 4.5 Cableado E2E / CLI controlado (opcional de cierre del Paso 4)

Entrada CLI o helper documentado (p. ej. `run-placsp` parametrizado / `run-placsp-agregadas`) con `--fixture` / `--dry-run` para ejercitar 4.1–4.4 de punta a punta en local **sin** depender de red PLACSP.

**Listo cuando:** una ejecución documentada reproduce RAW + canónico; sirve de base al Paso 5 (workflow).

### 5. Workflow / job de la fuente estatal

GitHub Actions (o job documentado) manual y controlado; secretos fuera del código; dry-run o modo seguro por defecto.

**Listo cuando:** workflow en repo; ejecución controlada acordada (sin quemar prod/red a ciegas).

### 6. Adaptador CSV genérico (si aplica) — N/A (decidido en Paso 1)

Si en el inventario hay una **familia** de fuentes CSV realmente compatible: implementar un adaptador CSV reutilizable (mapeo declarativo donde ayude).  
Si no hay familia clara: marcar **N/A** en checklist y dejar constancia en decisiones (no forzar un adaptador vacío).

**Decisión Paso 1:** adaptador CSV de **familia** = N/A en Semana 3. La cola de CCAA incluye reservas CSV (`valencia`, `jcyl`, …): si hay que usarlas por bloqueo de Catalunya/Euskadi, se hace el conector de esa fuente y solo entonces se valora factorizar.

**Listo cuando:** o bien un CSV end-to-end con fixture+tests+ficha, o decisión documentada N/A.

### 7. Adaptador API REST / Socrata (si aplica)

Igual criterio que el Paso 6: solo si corresponde a una fuente priorizada. Timeout/retry/`max_bytes`/checksum según stack aprobado.

**Listo cuando:** o bien API end-to-end con fixture/mock+tests+ficha, o decisión documentada N/A.

### 8. Primera CCAA propia (`catalunya`)

Completar la tubería canónica sobre el adaptador Socrata del Paso 7: documentación E2E, RAW, upsert/`source_sync`, CLI y workflow controlado.

**Listo cuando (paso global):** corrida local (fixture) deja sync success, RAW trazable y filas canónicas; reejecutar no duplica; ficha alineada; job manual seguro.

#### 8.1 Documentación ficha CCAA #1

Completar/actualizar [docs/sources/catalunya.md](../sources/catalunya.md) para el alcance E2E (identificadores, RAW, incremental, límites, cobertura, exclusiones, mapa de minipasos). El adaptador base ya existe desde el Paso 7.

**Listo cuando:** ficha revisable alineada con el pipeline que se va a cablear en 8.2–8.5.

#### 8.2 Validar artefacto + guardar RAW

Tras el fetch: `validate_artifact` (JSON no vacío) → `store_raw` en bucket `raw` con prefijo `catalunya/...` → registrar `source_artifacts`. Reutilizar helpers Semana 2.

**Listo cuando:** tests (mock o integración local) dejan RAW + metadata bajo `raw/catalunya/`.

#### 8.3 Upsert canónico + `source_sync` + trazabilidad

Persistir con unique `(catalunya, source_tender_id)`; actualizar `source_sync`; enlazar `artifact_id`. Parse/normalize ya cubiertos en Paso 7.

**Listo cuando:** corrida fixture → filas canónicas + sync success; 2ª pasada → updated, sin duplicados.

#### 8.4 CLI / E2E local controlado

Entrada CLI documentada (p. ej. `run-catalunya`) con `--fixture` / `--dry-run` para ejercitar 8.2–8.3 sin red SODA.

**Listo cuando:** ejecución documentada reproduce RAW + canónico; base para 8.5.

#### 8.5 Workflow / job controlado

GitHub Actions (o extensión de workflow) manual; dry-run por defecto; secretos fuera del código; cron off.

**Listo cuando:** workflow en repo; ejecución controlada acordada.

### 9. Segunda (y siguientes) CCAA propia

Repetir el patrón del Paso 8 para al menos otra CCAA (criterio de salida: **varias** CCAA propias ingiriendo).  
Si una se bloquea: documentar y sustituir por la siguiente del inventario.

**Listo cuando:** ≥2 CCAA con ficha + tests + sync + corrida verificable.

### 10. Homogeneizar catálogo + regresión + cierre

Actualizar `docs/sources/README.md`. Batería de tests (todas las fuentes nuevas). Marcar [fase3-checklist.md](fase3-checklist.md). CHANGELOG. ADR `N/A` o nuevo ADR si hubo decisión estructural.

**Listo cuando:** criterios de salida de `docs/04` § Semana 3 cumplidos.

**Fuera de alcance:** resto de las 17 CCAA, dedup multi-fuente avanzada (Semana 4), TED, FTS/Auth/alertas UI, subvenciones, infra nueva sin ADR.

---

## Decisiones durante la ejecución

Registro de lo acordado al cerrar (o antes de) cada paso:

| Cuándo | Decisión | Motivo / consecuencia |
|---|---|---|
| Inicio Semana 3 | Ejecutar **paso a paso** con revisión | Igual que Semanas 0–2 |
| Plan | Sin ADRs previos; ADR solo si hay cambio estructural | Respetar arquitectura ya fijada |
| Plan | No fijar aún CCAA/`source_code` concretos en el plan | Se eligen en Paso 1 con evidencia oficial + cobertura/esfuerzo |
| Paso 1 | Estatal: `placsp_agregadas` → `placsp_menores` | Reuso Atom/CODICE; agregadas primero por cobertura; menores por MVP |
| Paso 1 | CCAA: cola `catalunya` → `euskadi` → reservas CSV (`valencia`, `jcyl`, `canarias`, `asturias`, …) | Objetivo ≥2 implementadas; reservas para sustituir si hay bloqueo |
| Paso 1 | Adaptador CSV de familia = **N/A** salvo caída a reserva CSV | No forzar familia vacía; conector puntual si la cola lo exige |
| Paso 1 | Rama de trabajo = `tecnico4/semana-03` | No mergear a `main` hasta OK explícito |
| Paso 2 | Primera ficha estatal = `placsp_agregadas` (`sindicacion_1044`) | Open Data oficial Atom/CODICE; mismo patrón ZIP mensuales que `placsp`; sin scraping |
| Paso 2 | Identidad de expediente alineada con `placsp` | Reuso del parser; clave `(placsp_agregadas, source_tender_id)` |
| Paso 3.1 | Parametrizar `PlacspConnector` con `PlacspSyndication` | Reuso sin clonar parser; default = `placsp`; agregadas = `PLACSP_AGREGADAS` |
| Paso 3.1 | Discover agregadas con `artifact_key` estable + tests sin red | Minipaso cerrado antes de fetch |
| Paso 3.2 | Fetch agregadas reutiliza `download_bytes` + tests sin red | Misma política timeout/retry/`max_bytes`; URL `sindicacion_1044`; sin descarga live en CI |
| Paso 4.1 | RAW agregadas reutiliza `fetch_validate_and_store_raw` | Prefijo Storage `placsp_agregadas`; validate ZIP; sin parse aún |
| Paso 4.2 | Parse agregadas reutiliza `parse_placsp_artifact` | Misma familia CODICE; fixtures Semana 2 + nombre ZIP agregadas |
| Paso 4.3 | Normalize + identidad reutiliza `stages.normalize` / `resolve_identity` | Sin cambios en etapas; tests agregadas HIGH/LOW |
| Paso 4.4 | Upsert reutiliza `InMemory`/`PostgresCanonicalRepository` + pipeline | Unique `(placsp_agregadas, source_tender_id)`; no colisión con `placsp`; `source_sync` success |
| Paso 4.5 | CLI `run-placsp --syndication placsp_agregadas` | Fixture Atom wrap con nombre agregadas; dry-run + Postgres opcional |
| Paso 5 | Workflow `ingest-placsp.yml` + input `syndication` | Manual; dry-run default; cron off; mismos secrets que Semana 2 |
| Tras Paso 5 | Verificación live local `placsp_agregadas` (mes en curso + idempotencia) | Mismo patrón que Semana 2; documentado en [docs/pruebas.md](../pruebas.md) Parte B |
| Paso 7 | Adaptador Socrata + preset `catalunya` (`ybgg-dgi6`) | `SocrataConnector` discover/fetch/parse; ficha; tests sin red; E2E CLI → Paso 8 |
| Paso 8.1 | Ficha `catalunya` ampliada a alcance E2E CCAA #1 | RAW/upsert/CLI/workflow documentados como minipasos 8.2–8.5 |
| Paso 8.2 | RAW `catalunya` reutiliza `fetch_validate_and_store_raw` | Prefijo Storage `catalunya`; validate JSON; tests sin red |
| Paso 8.3 | Upsert `catalunya` reutiliza `CanonicalRepository` + pipeline | Unique `(catalunya, id_intern)`; no colisión con `placsp`; sync success |
| Paso 8.4 | CLI `run-catalunya --fixture --dry-run` | E2E local sin red SODA; Postgres opcional con `--no-storage` |
| Paso 8.5 | Workflow `ingest-catalunya.yml` | Manual; dry-run default; cron off; mismos secrets que PLACSP |

---

## Referencias

- [docs/04-roadmap-mvp.md](../04-roadmap-mvp.md) § Semana 3 (y §1 corte MVP: estatales + CCAA)  
- [docs/01-arquitectura-fija.md](../01-arquitectura-fija.md) §§ 5–8  
- [docs/00-onboarding.md](../00-onboarding.md) (fuentes, RAW, `source_sync`)  
- [docs/sources/placsp.md](../sources/placsp.md) · [docs/sources/placsp_agregadas.md](../sources/placsp_agregadas.md) · [docs/sources/catalunya.md](../sources/catalunya.md) · [docs/sources/README.md](../sources/README.md)  
- [docs/pruebas.md](../pruebas.md) (Parte B: live `placsp_agregadas`)  
- [fase3-checklist.md](fase3-checklist.md) · [fase2-checklist.md](fase2-checklist.md) · [semana02-plan.md](semana02-plan.md)
