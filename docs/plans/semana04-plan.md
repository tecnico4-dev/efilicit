# Semana 4 — Plan: cobertura territorial + deduplicación

> **Estado:** en curso (Paso 1 cerrado; siguiente = Paso 2 `placsp_menores`).  
> **Checklist:** [fase4-checklist.md](fase4-checklist.md)  
> **Precondición:** Semana 3 cerrada ([fase3-checklist.md](fase3-checklist.md)).  
> **Norma:** `docs/00`–`04` y `.cursor/rules/`. Reutilizar contrato `SourceConnector` + pipeline + upsert canónico de Semanas 1–3. ADR solo si hace falta cambiar arquitectura de verdad.  
> **Rama de trabajo:** `tecnico4/semana-04` (no mergear a `main` hasta OK explícito).  
> **Verificación live previa:** [docs/pruebas.md](../pruebas.md) — Partes A–D (`placsp`, `placsp_agregadas`, `catalunya`, `euskadi`).

---

## Partimos de

Semana 3 dejó **cuatro fuentes reales** sobre la misma tubería:

| `source_code` | Adaptador | Estado |
|---|---|---|
| `placsp` | Atom/CODICE (`PlacspSyndication` 643) | Semana 2 — live OK |
| `placsp_agregadas` | mismo adaptador (1044) | Semana 3 — live OK |
| `catalunya` | `SocrataConnector` (`ybgg-dgi6`) | Semana 3 — live OK |
| `euskadi` | `EuskadiConnector` REST | Semana 3 — live OK |

El upsert es idempotente **dentro de una fuente** por `(source_code, source_tender_id)`.  
`stages.deduplicate()` es todavía un **pass-through**. Cada fuente crea su propia fila en `tenders`; no hay matching multi-fuente.

Meta de Semana 4 (`docs/04` § Semana 4):

1. **Cobertura territorial:** las 17 CCAA tienen una **ruta de datos oficial identificada** (propia o agregada) y documentada.
2. **Deduplicación funcional:** una licitación vista en dos fuentes compatibles se representa **una sola vez** cuando hay confianza suficiente; lo ambiguo queda `review_status = pending`.

Fuera de esta semana (Semana 5+): FTS / Auth / alertas UI, TED, subvenciones, motor de revisión humana, cron de producción.

---

## Cómo lo hacemos

1. Cumplir tareas y criterios de `docs/04-roadmap-mvp.md` § Semana 4.
2. **No** interpretar “17 CCAA cubiertas” como “17 conectores nuevos”. El roadmap define cobertura como **ruta de fuente identificada** (propia **o** agregada). `placsp_agregadas` ya es la vía territorial principal para muchas CCAA.
3. Cada fuente **nueva que se implemente**: ficha en `docs/sources/`, `source_sync`, fixture, tests, config de acceso y workflow/job.
4. Reutilizar adaptadores **solo** con compatibilidad técnica y semántica real (PLACSP Atom/CODICE, Socrata, REST propio, CSV puntual).
5. Fuente oficial primero; sin scraping si hay feed/API/Open Data adecuado.
6. Mismo modelo canónico. Ampliar `tender_sources` (o tabla auxiliar justificada) **vía migración** para matching; no DDL paralelo por fuente.
7. Dedup en el **pipeline común**, no dentro de cada parser. El matching debe consultar el canónico ya persistido (el pass-through actual no ve otras fuentes).
8. No fusionar ambigüedades a ciegas. NIF/CIF es señal primaria de organismo; el **nombre nunca** es identidad única.
9. Priorizar cobertura/esfuerzo; si una CCAA propia se atasca: documentar hueco y seguir (regla de alcance del roadmap).
10. Pasos pequeños y verificables; secretos fuera del código; push/merge a `main` solo con OK explícito.
11. ADR solo ante cambio estructural real; si no, checklist en `N/A`.

---

## Pasos

### 1. Inventario de cobertura de las 17 CCAA (solo documentación) — OK

Contrastar catálogo de referencia + fichas oficiales + lo ya integrado. Registrar en este plan (tabla de decisiones) la **ruta de cada CCAA**.

**Hecho:** matriz cerrada abajo; leftover `placsp_menores` confirmado; **0 CCAA propias extra** en Semana 4 (Paso 3.2 = N/A). Catálogo: [docs/sources/README.md](../sources/README.md).

#### Leftover estatal confirmado

| `source_code` | Acceso oficial | Adaptador | Decisión Semana 4 |
|---|---|---|---|
| `placsp_menores` | Hacienda [Contratos menores](https://www.hacienda.gob.es/es-ES/GobiernoAbierto/Datos%20Abiertos/Paginas/ContratosMenores.aspx) · `sindicacion_1143` · `contratosMenoresPerfilesContratantes_YYYYMM.zip` | PLACSP-reuse | **Implementar en Paso 2** (mismo patrón que `placsp` / `placsp_agregadas`) |

Ámbito: menores de perfiles **alojados en PLACSP** (no menores de plataformas agregadas). Atom/CODICE; sin scraping. Cobertura desde ~2018.

#### Matriz 17 CCAA (ruta MVP)

Criterio del roadmap: cada CCAA tiene **ruta de datos oficial identificada** (propia o agregada). No exige conector propio por comunidad.

| # | CCAA | Ruta MVP | `source_code` / mecanismo | Conector propio Semana 4 | Notas / limitaciones |
|---|---|---|---|---|---|
| 1 | Andalucía | Agregada | `placsp_agregadas` | No | Open Data Junta: validar dataset vigente antes de un conector futuro; reserva Semana 3 |
| 2 | Aragón | Agregada | `placsp_agregadas` | No | Open Data propio histórico hasta ~2021; después vía PLACSP |
| 3 | Asturias | Agregada | `placsp_agregadas` | No | Reserva CSV Semana 3; no aporta más que agregadas para el MVP |
| 4 | Illes Balears | Agregada | `placsp_agregadas` | No | Sin conector propio prioritario |
| 5 | Canarias | Agregada | `placsp_agregadas` | No | Reserva CSV Semana 3 (`datos.canarias.es`) |
| 6 | Cantabria | Agregada | `placsp_agregadas` | No | Sin conector propio prioritario |
| 7 | Castilla-La Mancha | Agregada | `placsp_agregadas` | No | Portal regional de consulta ≠ fuente Open Data priorizada para ETL |
| 8 | Castilla y León | Agregada | `placsp_agregadas` | No | Reserva CSV Semana 3 (`jcyl`) |
| 9 | Catalunya | Propia + solape | `catalunya` (+ posible `placsp_agregadas`) | Ya integrado | Dedup multi-fuente = Pasos 4–7 |
| 10 | Comunidad de Madrid | Agregada | `placsp_agregadas` | No | Feed Atom propio evita duplicar (decisión Semana 3) |
| 11 | Comunitat Valenciana | Agregada | `placsp_agregadas` | No | Reserva CSV Semana 3 (`valencia` / `dadesobertes.gva.es`) |
| 12 | Extremadura | Agregada | `placsp_agregadas` | No | Sin conector propio prioritario |
| 13 | Galicia | Agregada | `placsp_agregadas` | No | Posible Open Data propio futuro; MVP = agregadas |
| 14 | Región de Murcia | Agregada | `placsp_agregadas` | No | Sin conector propio prioritario |
| 15 | Comunidad Foral de Navarra | Agregada | `placsp_agregadas` | No | Sin conector propio prioritario |
| 16 | País Vasco | Propia + solape | `euskadi` (+ posible `placsp_agregadas`) | Ya integrado | Dedup multi-fuente = Pasos 4–7 |
| 17 | La Rioja | Agregada | `placsp_agregadas` | No | Sin conector propio prioritario |

**Limitaciones comunes de la ruta agregada** (documentadas en [placsp_agregadas.md](../sources/placsp_agregadas.md)):

- No incluye contratos menores.
- Solo entidades que publican por **agregación** (perfil no alojado en PLACSP).
- No garantiza el 100 % de contratos locales de cada CCAA.
- La composición de entidades agregadas varía en el tiempo.

#### Orden de ataque Semana 4 (conectores)

| Orden | Qué | Motivo |
|---|---|---|
| 1 | `placsp_menores` (Paso 2) | Leftover estatal MVP; máximo reuso Atom/CODICE |
| 2 | Deduplicación (Pasos 4–7) | Criterio de salida Semana 4; solape `catalunya`/`euskadi` ↔ agregadas |
| — | CCAA propia extra | **N/A** esta semana (0 conectores) |

Reservas CSV Semana 3 (`valencia`, `jcyl`, `canarias`, `asturias`, `andalucia`, …) quedan como **backlog post-MVP / Semana 4+** si `placsp_agregadas` deja un hueco medible. Adaptador CSV de familia: sigue **N/A**.

**Listo cuando:** matriz 17 CCAA acordada + orden de ataque — **cumplido**.

### 2. Leftover estatal — `placsp_menores` (reuso PLACSP)

Mismo patrón que `placsp_agregadas`: parametrizar `PlacspSyndication` (`sindicacion_1143`, feed `contratosMenoresPerfilesContratantes`), ficha, discover/fetch, RAW, parse/normalize/upsert, CLI, workflow.

**Listo cuando (paso global):** corrida local (fixture) deja sync success, RAW trazable y filas canónicas con `source_code=placsp_menores`; reejecutar no duplica; tests sin red.

#### 2.1 Ficha `docs/sources/placsp_menores.md`

Mismo esquema que `placsp.md` / `placsp_agregadas.md`.

**Listo cuando:** documento revisable alineado con el acceso real.

#### 2.2 Discover + fetch

Añadir `PLACSP_MENORES` a `PlacspSyndication`; reutilizar `download_bytes`. Tests sin red.

**Listo cuando:** `artifact_key` / `source_url` estables; misma política timeout/retry/`max_bytes`.

#### 2.3 RAW + parse + normalize + upsert

Prefijo Storage `raw/placsp_menores/`. Reutilizar parser CODICE + etapas del pipeline + `CanonicalRepository`. Unique `(placsp_menores, source_tender_id)`.

**Listo cuando:** fixture → canónico + `source_sync` success; 2ª pasada → updated, sin duplicados.

#### 2.4 CLI + workflow

`run-placsp --syndication placsp_menores`; extender `ingest-placsp.yml`. Manual, dry-run por defecto, cron off.

**Listo cuando:** CLI documentado; workflow en repo.

### 3. Matriz de cobertura 17 CCAA + CCAA propias extra — OK (3.2 N/A)

Actualizar `docs/sources/README.md` con la ruta de cada comunidad: propia / agregada / hueco.

**Hecho (con Paso 1):** matriz de las 17 CCAA en el catálogo. Paso 1 eligió **0 CCAA propias extra** → minipaso 3.2 = **N/A** (no ficha/conector nuevo de CCAA esta semana).

Reservas CSV quedan en backlog del catálogo; no se implementan 15 conectores “para llegar a 17”.

**Listo cuando:** las 17 CCAA figuran en el catálogo con ruta identificada — **cumplido**; conector extra N/A.

### 4. Deduplicación — esquema de matching

El modelo ya tiene `tenders.id` (canónico) y `tender_sources (source_code, source_tender_id)`. Falta persistir la **decisión de matching** que pide el roadmap:

```text
canonical_tender_id   → tender_sources.tender_id (ya existe)
source_code           → ya existe
source_tender_id      → ya existe
match_method
match_score
matched_at
review_status
```

**Propuesta por defecto (sin ADR si se mantiene el contrato):** columnas nuevas en `tender_sources` vía migración versionada + RLS intacto. Tabla auxiliar de candidatos solo si hace falta guardar un match pendiente sin contaminar la fila canónica.

Valores iniciales previstos de `review_status`: `unmatched` | `auto` | `pending`.  
No fusionar si la confianza es insuficiente (`pending`).

**Listo cuando:** `supabase db reset` local OK; tipos TS regenerados si el esquema expuesto cambia.

### 5. Matching en el pipeline común

Sustituir el pass-through de `stages.deduplicate`. El matching **no cabe** en un lote ciego: debe consultar licitaciones ya persistidas de **otras** fuentes (lookup en `CanonicalRepository` / equivalente).

Niveles (roadmap):

1. identificador exacto de fuente (ya cubierto por unique intra-fuente);
2. expediente + organismo (NIF/CIF o id de plataforma; nunca solo el nombre);
3. otras combinaciones fiables (CPV, importe, fechas, organismo, ubicación);
4. similitud de título/objeto.

Anotar el `SourceRecord` con la decisión; **no** mezclar lógica de producto en el parser.

Algoritmo concreto, pesos y umbrales son 🎨 libres. Implementación en Python del ETL (no adelantar FTS/`pg_trgm` de Semana 5).

**Listo cuando:** tests unitarios sin red cubren: match de alta confianza, no-match, y caso ambiguo → `pending` (sin fusionar).

### 6. Upsert respeta el matching

Si match `auto` de alta confianza: reutilizar `tenders.id` existente y añadir/actualizar `tender_sources` de la fuente nueva.  
Si `pending` o `unmatched`: crear licitación nueva (no fusionar) y registrar `review_status`.  
Reejecutar el mismo `(source_code, source_tender_id)` sigue siendo idempotente.

**Listo cuando:** test in-memory (+ Postgres opcional) demuestra: dos fuentes → una fila `tenders` en match alto; dos filas si es ambiguo; 2ª pasada no duplica `tender_sources`.

### 7. Fixtures de solape + regresión de fuentes existentes

Al menos un par de fixtures que representen **la misma** licitación en dos `source_code` (p. ej. CODICE vs Catalunya/Euskadi sintéticos), más un par que **no** deban fusionarse.

No debilitar tests de Semanas 1–3. Correr la batería completa de ingestion.

**Listo cuando:** tests de dedup en verde; regresión previa en verde.

### 8. Catálogo + cierre

Actualizar `docs/sources/README.md`, CHANGELOG, checklist. ADR `N/A` o ADR nuevo si hubo decisión estructural. Verificación live de menores / CCAA extra / un caso de dedup: solo cuando el paso correspondiente esté listo y de forma acotada (mismo patrón que `docs/pruebas.md`).

**Listo cuando:** criterios de salida de `docs/04` § Semana 4 cumplidos.

**Fuera de alcance (→ Semana 5+):** buscador FTS, Auth/RLS de usuarios en UI, motor de alertas/email, web de ficha/dashboard, TED, subvenciones, UI de revisión humana de matches `pending`, cron de producción, infra nueva sin ADR.

---

## Decisiones durante la ejecución

Registro de lo acordado al cerrar (o antes de) cada paso:

| Cuándo | Decisión | Motivo / consecuencia |
|---|---|---|
| Inicio Semana 4 | Ejecutar **paso a paso** con revisión | Igual que Semanas 0–3 |
| Plan | Rama de trabajo = `tecnico4/semana-04` | No mergear a `main` hasta OK explícito |
| Plan | Sin ADRs previos; ADR solo si hay cambio estructural | Respetar arquitectura ya fijada |
| Plan | “17 CCAA” = rutas documentadas, no 17 conectores | Criterio de salida del roadmap |
| Plan | Dedup en pipeline común + lookup al canónico persistido | El pass-through actual no ve otras fuentes |
| Plan | Matching persistido en `tender_sources` (columnas) por defecto | Encaja el contrato ya existente; migración Semana 4 |
| Plan | No adelantar `pg_trgm`/FTS | Eso es Semana 5; similitud de título en el ETL |
| Plan | `placsp_menores` antes de CCAA extra | Reuso máximo; leftover explícito de Semana 3 |
| Plan | CCAA extra = 0–N según Paso 1 | No ampliar alcance por iniciativa |
| Paso 1 | `placsp_menores` = `sindicacion_1143` / `contratosMenoresPerfilesContratantes` | Confirmado en ficha Hacienda; implementar en Paso 2 |
| Paso 1 | 15 CCAA vía `placsp_agregadas`; Catalunya + Euskadi propias | Cumple “ruta identificada” del roadmap sin 17 conectores |
| Paso 1 | CCAA propia extra Semana 4 = **0 (N/A)** | Priorizar menores + dedup; reservas CSV = backlog |
| Paso 1 | Matriz publicada en `docs/sources/README.md` | Catálogo = fuente de verdad de cobertura territorial |

---

## Referencias

- [docs/04-roadmap-mvp.md](../04-roadmap-mvp.md) § Semana 4 (y §1 corte MVP: cobertura + dedup)  
- [docs/01-arquitectura-fija.md](../01-arquitectura-fija.md) §§ 5–8 (conectores, identidad, migraciones)  
- [docs/00-onboarding.md](../00-onboarding.md) (fuentes, RAW, entity resolution)  
- [docs/sources/README.md](../sources/README.md) · [placsp.md](../sources/placsp.md) · [placsp_agregadas.md](../sources/placsp_agregadas.md) · [catalunya.md](../sources/catalunya.md) · [euskadi.md](../sources/euskadi.md)  
- [docs/pruebas.md](../pruebas.md)  
- [fase4-checklist.md](fase4-checklist.md) · [semana03-plan.md](semana03-plan.md) · [fase3-checklist.md](fase3-checklist.md)
