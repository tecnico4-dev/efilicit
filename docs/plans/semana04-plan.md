# Semana 4 — Plan: cobertura territorial + deduplicación

> **Estado:** en curso (plan de arranque; sin implementación de conectores/dedup todavía).  
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

### 1. Inventario de cobertura de las 17 CCAA (solo documentación)

Contrastar catálogo de referencia + fichas oficiales + lo ya integrado. Registrar en este plan (tabla de decisiones) la **ruta de cada CCAA**:

- fuente propia ya integrada;
- cobertura vía `placsp_agregadas` (y limitaciones);
- candidata a conector propio esta semana (solo si aporta cobertura real frente a agregadas);
- hueco documentado.

También confirmar el leftover estatal `placsp_menores` (`sindicacion_1143`) como siguiente sindicación PLACSP-reuse.

**No** implementar aún.

**Listo cuando:** matriz 17 CCAA acordada + orden de ataque (menores + 0–N CCAA propias extra) con `source_code` provisional y tipo de adaptador.

#### Hipótesis de partida (a confirmar / corregir en este paso)

Cola heredada de Semana 3 y lectura del roadmap (no es todavía la decisión cerrada):

| CCAA | Ruta hipotética | Notas |
|---|---|---|
| Catalunya | propia `catalunya` (+ posible solape agregadas) | Ya integrada |
| País Vasco | propia `euskadi` (+ posible solape agregadas) | Ya integrada |
| Madrid | `placsp_agregadas` | Semana 3: Atom propio duplicaría; evitar |
| Aragón | `placsp_agregadas` | Open Data propio histórico hasta ~2021 |
| Andalucía, Asturias, Canarias, Castilla y León, C. Valenciana | `placsp_agregadas` por defecto; reserva CSV de Semana 3 solo si el inventario demuestra cobertura extra | No forzar conector |
| Resto (Balears, Cantabria, CLM, Extremadura, Galicia, Murcia, Navarra, La Rioja) | `placsp_agregadas` salvo fuente oficial propia clara y de alto valor | Confirmar en Paso 1 |

- **Objetivo de conectores nuevos:** el mínimo que mejore cobertura real. Default: `placsp_menores` + **cero o pocas** CCAA propias extra.
- Adaptador CSV de familia: sigue **N/A** hasta que el Paso 1 elija una reserva CSV.

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

### 3. Matriz de cobertura 17 CCAA + CCAA propias extra (si el Paso 1 las eligió)

Actualizar `docs/sources/README.md` (y fichas existentes) con la ruta de cada comunidad: propia / agregada / hueco.

Si el Paso 1 selecciona **una** CCAA propia extra (p. ej. reserva CSV `valencia`): repetir el patrón Semana 3 (ficha → conector → RAW → upsert → CLI → workflow → tests).  
Si no selecciona ninguna: marcar minipasos de conector extra como **N/A** y dejar constancia.

**No** implementar 15 conectores “para llegar a 17”.

**Listo cuando:** las 17 CCAA figuran en el catálogo con ruta identificada; cada conector extra (si existe) cumple el contrato habitual; huecos reales registrados.

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

---

## Referencias

- [docs/04-roadmap-mvp.md](../04-roadmap-mvp.md) § Semana 4 (y §1 corte MVP: cobertura + dedup)  
- [docs/01-arquitectura-fija.md](../01-arquitectura-fija.md) §§ 5–8 (conectores, identidad, migraciones)  
- [docs/00-onboarding.md](../00-onboarding.md) (fuentes, RAW, entity resolution)  
- [docs/sources/README.md](../sources/README.md) · [placsp.md](../sources/placsp.md) · [placsp_agregadas.md](../sources/placsp_agregadas.md) · [catalunya.md](../sources/catalunya.md) · [euskadi.md](../sources/euskadi.md)  
- [docs/pruebas.md](../pruebas.md)  
- [fase4-checklist.md](fase4-checklist.md) · [semana03-plan.md](semana03-plan.md) · [fase3-checklist.md](fase3-checklist.md)
