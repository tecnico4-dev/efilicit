# Euskadi — KontratazioA / Open Data Euskadi

> **source_code:** `euskadi`  
> **Estado en el proyecto:** Semana 3 — CCAA #2 completa (Paso 9; live 9.5)  
> **Última revisión de esta ficha:** 2026-10-19  
> **Scraping:** no (existe API REST oficial)  
> **Adaptador:** `EuskadiConnector` (familia REST propia; no Socrata)

---

## 1. Organismo / fuente

| Campo | Valor |
|---|---|
| Nombre corto | Euskadi / KontratazioA |
| Nombre completo | Contratación pública — avisos de contratación (Open Data Euskadi) |
| Organismo / portal Open Data | Gobierno Vasco / Open Data Euskadi |
| Portal datos | https://opendata.euskadi.eus/ |
| API base | https://api.euskadi.eus/procurements |
| Colección usada | `contracting-notices` |

---

## 2. Qué dataset usamos

**Conjunto objetivo:**

> Listado paginado de avisos de contratación (`contracting-notices`) expuesto por la API de procurements de Euskadi.

| Campo | Valor |
|---|---|
| `source_code` | `euskadi` |
| Colección | `contracting-notices` |
| Endpoint JSON (página) | `https://api.euskadi.eus/procurements/contracting-notices?currentPage=N` |
| Tamaño de página | **Fijo en 10** ítems (API; no configurable) |

Cada ítem = un aviso de contratación. Clave operativa EfiLicit: campo numérico `id` → `source_record_id` / `source_tender_id`.

### Relación con otras fuentes

| `source_code` | Relación |
|---|---|
| `placsp_agregadas` | Posible solape territorial; deduplicación multi-fuente → Semana 4 |
| `catalunya` | Otra CCAA; no mezclar claves |
| Otras colecciones procurements | Fuera de alcance Semana 3 salvo necesidad documentada |

---

## 3. Mecanismo de acceso

| Preferencia | ¿Aplica? | Detalle |
|---|---|---|
| 1. API oficial Open Data | Sí — **elegido** | REST JSON sin auth obligatoria para consumo abierto |
| 2. Export masivo | No primario | — |
| 3. Scraping | No | No necesario |

**Decisión:** HTTP GET paginado con `currentPage` (1-based). Sin secretos en código.

---

## 4. Formato

| Aspecto | Detalle |
|---|---|
| Transporte | JSON objeto con `items[]` (+ metadatos de página) |
| Encoding | UTF-8 |
| Paginación | `currentPage`; `itemsOfPage` / `totalPages` informativos |
| Identidad de fila | `id` → `source_record_id` |
| Filas sin `id` | Se omiten |

---

## 5. Identificadores

| Concepto | Campo / regla |
|---|---|
| Clave de artefacto | `contracting-notices_page_{NNNNNN}.json` (página 1-based, 6 dígitos) |
| Clave de registro | `id` (stringificado) |
| Upsert canónico | Unique `(euskadi, source_tender_id)` con `source_tender_id = id` |
| Organismo | `contractingAuthority.name`; NIF `identificationNumber` → confidence HIGH si presente |

---

## 6. Campos canónicos (mapeo MVP)

El parser emite el mismo shape pre-canónico que PLACSP/Catalunya para reutilizar `stages.normalize` / `resolve_identity`:

| Canónico / payload | Origen API |
|---|---|
| `title` | `object` (fallback `code` / `id`) |
| `status` | `contractProcedureStatus.name` → `PUB` / `ADJ` / … |
| `procedure_type` | `contractProcedureType.name` (etiqueta ES) → códigos CODICE `1`…`13` / `100` / `999` |
| `contract_type` | `contractType.id` (si es CODICE) o `name` → `1`/`2`/`3`, concesiones `22`/`31`/`32`, etc. |
| `estimated_value` | `budgetWithoutVAT` |
| `deadline_at` | `deadlineDate` (plazo de presentación; ausente → null) |
| `cpv_codes` | *(vacío)* — `/contracting-notices` no trae CPV de la licitación (sí `/contracts`); no usar `contractingAuthority.CPV`. Enriquecimiento → [BACKLOG §3](../plans/BACKLOG.md) |
| `nuts_codes` | `contractingAuthority.codNUTS` |
| `publication_url` | `_links.self.href` |
| `contract_folder_id` | `code` |
| `authority.name` | `contractingAuthority.name` |
| `authority.tax_id` | `contractingAuthority.identificationNumber` |
| `authority.platform_id` | `contractingAuthority.id` |

Estados/tipos/procedimientos no mapeados → `status` / `contract_type` / `procedure_type` nulos (el resto puede persistirse).

---

## 7. Frecuencia, incremental y límites

| Aspecto | Detalle |
|---|---|
| Incremental EfiLicit (MVP) | Páginas por `currentPage` + cursor = último `artifact_key` |
| Ventana discover | `start_page` + `max_pages` (configurable; default 1) |
| Rate limit | Consumo razonable; si hay 429 → documentar y reintentar (fetch ya reintenta) |
| Tamaño página | 10 ítems fijos por la API |

---

## 8. Cobertura y exclusiones

**Incluye:** avisos en `contracting-notices` (incl. menores si `minorContract=true` en el JSON).

**Excluye / fuera de Semana 3:**

- Deduplicación contra PLACSP / Catalunya (Semana 4).
- Otras colecciones de la API de procurements.
- Scraping de portales web de publicidad.

---

## 9. Pipeline EfiLicit (Paso 9)

```text
discover (páginas) → fetch (JSON) → validate → RAW Storage
→ parse → normalize / identidad → upsert → source_sync
```

| Etapa | Estado / nota |
|---|---|
| Discover + fetch + parse | OK (`EuskadiConnector`) |
| Normalize + identidad | OK (reuso etapas comunes; tests fixture) |
| RAW `raw/euskadi/…` + `source_artifacts` | OK |
| Upsert + `source_sync` + `artifact_id` | OK |
| CLI `--fixture` / `--dry-run` | OK |
| Workflow Actions manual | OK (`ingest-euskadi.yml`) |
| Verificación live API + idempotencia | OK (Paso 9.5) → [docs/pruebas.md](../pruebas.md) Parte D |

**RAW:** cada página JSON es un artefacto inmutable; prefijo Storage `raw/euskadi/AAAA/MM/DD/…`.

**Idempotencia:** reejecutar la misma página no duplica `(euskadi, id)`.

---

## 10. Observaciones para el conector

- **Familia:** `EuskadiConnector` en `efilicit_ingestion.connectors.euskadi`.
- **Preset:** `EUSKADI` (`source_code=euskadi`, collection `contracting-notices`).
- **Fetch:** timeout / retry / `max_bytes` / checksum; `fetch_transport` inyectable — **sin red en unit tests**.
- **CLI E2E:** `run-euskadi --fixture … --dry-run` (JSON page; sin red).
- **Workflow:** [`.github/workflows/ingest-euskadi.yml`](../../.github/workflows/ingest-euskadi.yml); default `dry-run`; cron desactivado.
- **Live (Paso 9.5):** 1 página API real + reejecución idempotente; resultados en [docs/pruebas.md](../pruebas.md) Parte D.
- Fixtures: `ingestion/tests/fixtures/euskadi/`.
- Stack aprobado: `httpx` + `tenacity` + Pydantic; RAW en Supabase Storage; sin Redis/colas.

---

## 11. Referencias

1. API procurements Euskadi: https://api.euskadi.eus/procurements  
2. Open Data Euskadi: https://opendata.euskadi.eus/  
3. Conector: `ingestion/src/efilicit_ingestion/connectors/euskadi/`
