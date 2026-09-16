# Catalunya — Contractació pública (PSCP / Transparència)

> **source_code:** `catalunya`  
> **Estado en el proyecto:** Semana 3 — CCAA #1 (Paso 8; adaptador Socrata en Paso 7)  
> **Última revisión de esta ficha:** 2026-09-16  
> **Scraping:** no (existe API Open Data SODA / Socrata)  
> **Adaptador:** Socrata-reuse (`SocrataConnector` + dataset `ybgg-dgi6`)

---

## 1. Organismo / fuente

| Campo | Valor |
|---|---|
| Nombre corto | Catalunya PSCP |
| Nombre completo | Contractació pública a Catalunya — publicacions a la Plataforma de serveis de contractació pública |
| Organismo / portal Open Data | Transparència Catalunya / Generalitat |
| Portal datos | https://analisi.transparenciacatalunya.cat/ |
| Dataset (vista) | https://analisi.transparenciacatalunya.cat/d/ybgg-dgi6 |
| Catálogo datos.gob.es | https://datos.gob.es/es/catalogo/a09002970-contratacion-publica-en-catalunya-publicaciones-en-la-plataforma-de-servicios-de-contratacion-publica |

---

## 2. Qué dataset usamos

**Conjunto objetivo:**

> Publicaciones de la actividad contractual de los órganos de contratación de Catalunya en la PSCP (anuncios de licitación, adjudicación, formalización, etc.).

| Campo | Valor |
|---|---|
| `source_code` | `catalunya` |
| Dataset ID (Socrata) | `ybgg-dgi6` |
| Dominio SODA | `analisi.transparenciacatalunya.cat` |
| Endpoint JSON | `https://analisi.transparenciacatalunya.cat/resource/ybgg-dgi6.json` |

Cada fila = una **publicación** (fase) en la plataforma, no necesariamente un expediente “único” de negocio. La clave operativa EfiLicit es `id_intern`.

### Relación con otras fuentes

| `source_code` | Relación |
|---|---|
| `placsp_agregadas` | Puede solapar cobertura territorial; deduplicación multi-fuente → Semana 4 |
| `placsp` | Perfiles alojados en PLACSP (estatal); no mezclar |
| Ejecución PSCP (otro dataset) | Fuera de alcance Semana 3 (p. ej. publicaciones de fase de ejecución en otro conjunto Open Data) |

---

## 3. Mecanismo de acceso

| Preferencia | ¿Aplica? | Detalle |
|---|---|---|
| 1. API oficial Open Data | Sí — **elegido** | SODA / Socrata Consumer API (JSON) |
| 2. Export CSV masivo | Disponible | No es el camino primario del adaptador |
| 3. Scraping | No | No necesario |

**Decisión:** HTTP GET paginado (`$limit` / `$offset` / `$order`) sobre el resource JSON. Sin autenticación obligatoria para consumo abierto; `X-App-Token` opcional si hace falta más cuota (**solo secrets / entorno**, nunca en código versionado).

---

## 4. Formato

| Aspecto | Detalle |
|---|---|
| Transporte | JSON array (una página SODA) |
| Encoding | UTF-8 |
| Paginación | `$limit` (máx. práctico ≤ 50 000) + `$offset` |
| Identidad de fila | `id_intern` (UUID de publicación) → `source_record_id` |
| Filas sin `id_intern` | Se omiten |

---

## 5. Identificadores

| Concepto | Campo / regla |
|---|---|
| Clave de artefacto | `{dataset_id}_offset_{offset:07d}_limit_{limit:04d}.json` |
| Clave de registro | `id_intern` |
| Upsert canónico | Unique `(catalunya, source_tender_id)` con `source_tender_id = id_intern` |
| Organismo | `nom_organ`; `codi_dir3` / `codi_organ` como `platform_id` (NIF/CIF suele ausente → confidence MEDIUM/LOW) |

---

## 6. Campos canónicos (mapeo MVP)

El parser emite el mismo shape pre-canónico que PLACSP para reutilizar `stages.normalize` / `resolve_identity`:

| Canónico / payload | Origen Socrata |
|---|---|
| `title` | `denominacio` / `objecte_contracte` |
| `status` | `fase_publicacio` → códigos tipo `PUB` / `ADJ` / … |
| `contract_type` | `tipus_contracte` → `1`/`2`/`3` |
| `estimated_value` | `valor_estimat_contracte` / `pressupost_licitacio_sense` |
| `cpv_codes` | `codi_cpv` |
| `nuts_codes` | `codi_nuts` |
| `deadline_at` | `termini_presentacio_ofertes` |
| `updated_at` | `data_publicacio_anunci` / `data_publicacio_contracte` |
| `publication_url` | `enllac_publicacio.url` |
| `authority.name` | `nom_organ` |
| `authority.platform_id` | `codi_dir3` o `codi_organ` |

Fases/tipos no mapeados → `status` / `contract_type` nulos (el resto del registro puede persistirse).

---

## 7. Frecuencia, incremental y límites

| Aspecto | Detalle |
|---|---|
| Actualización del dataset (portal) | Orden de magnitud semanal (Open Data); verificar en la ficha del portal |
| Incremental EfiLicit (MVP) | Páginas por `offset` + cursor = último `artifact_key` |
| Ventana discover | `start_offset` + `max_pages` × `page_size` (configurable) |
| SoQL `$where` por fechas | Opcional; se valora en minipasos E2E si el volumen lo exige |
| Rate limit | Cuota anónima SODA; si hay 429 → documentar y considerar App Token en secrets |
| Tamaño página | Default conector `page_size=1000`; `max_bytes` por página (JSON) |

---

## 8. Cobertura y exclusiones

**Incluye (este `source_code`):** publicaciones PSCP indexadas en `ybgg-dgi6` (licitación, adjudicación, formalización, agregadas, etc., según filas del dataset).

**Excluye / fuera de Semana 3:**

- Deduplicación contra `placsp` / `placsp_agregadas` (Semana 4).
- Datasets catalanes distintos (ejecución, menores propios si existen en otro ID).
- Scraping del portal `contractaciopublica.cat` más allá de la URL ya presente en el JSON.

---

## 9. Pipeline EfiLicit (Paso 8)

```text
discover (páginas) → fetch (JSON) → validate → RAW Storage
→ parse → normalize / identidad → upsert → source_sync
```

| Etapa | Estado / nota |
|---|---|
| Discover + fetch + parse | OK en Paso 7 (`SocrataConnector`) |
| Normalize + identidad | OK en Paso 7 (reuso etapas comunes; tests fixture) |
| RAW `raw/catalunya/…` + `source_artifacts` | OK (Paso 8.2) |
| Upsert + `source_sync` + `artifact_id` | OK (Paso 8.3) |
| CLI `--fixture` / `--dry-run` | OK (Paso 8.4) |
| Workflow Actions manual | OK (Paso 8.5) |

**RAW:** cada página JSON es un artefacto inmutable; prefijo Storage `raw/catalunya/AAAA/MM/DD/…`.

**Idempotencia:** reejecutar la misma página no duplica `(catalunya, id_intern)`.

---

## 10. Observaciones para el conector

- **Familia:** `SocrataConnector` en `efilicit_ingestion.connectors.socrata`.
- **Preset:** `CATALUNYA` (`source_code=catalunya`, dataset `ybgg-dgi6`).
- **Fetch:** timeout / retry / `max_bytes` / checksum; `fetch_transport` inyectable — **sin red en unit tests**.
- **RAW (Paso 8.2):** `fetch_validate_and_store_raw` + `validate_artifact` (JSON no vacío) → Storage `raw/catalunya/AAAA/MM/DD/...` + `source_artifacts`.
- **Upsert (Paso 8.3):** reutilizar `CanonicalRepository` / `run_pipeline`; unique `(catalunya, id_intern)`; `artifact_id` en `tender_sources`; `source_sync` con contadores.
- **CLI E2E (Paso 8.4):** `run-catalunya --fixture … --dry-run` (JSON SODA; sin red).
- **Workflow (Paso 8.5):** [`.github/workflows/ingest-catalunya.yml`](../../.github/workflows/ingest-catalunya.yml); default `dry-run`; cron desactivado.
- Fixtures: `ingestion/tests/fixtures/catalunya/`.
- Stack aprobado: `httpx` + `tenacity` + Pydantic; RAW en Supabase Storage; sin Redis/colas.

---

## 11. Referencias

1. Dataset Transparència Catalunya: https://analisi.transparenciacatalunya.cat/d/ybgg-dgi6  
2. SODA Consumer API: https://dev.socrata.com/consumers/getting-started.html  
3. Catálogo de referencia (no fuente de verdad): https://contratacionabierta.com/  
4. Adaptador: `ingestion/src/efilicit_ingestion/connectors/socrata/`
