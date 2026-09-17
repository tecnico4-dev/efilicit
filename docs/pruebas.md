# Pruebas de verificación — fuentes reales (local)

> **Estado:** OK  
> **Ámbito:** verificaciones E2E en **Supabase local** con datos oficiales (PLACSP Open Data + SODA Catalunya).  
> **Norma:** `docs/00`–`04` y `.cursor/rules/`. No se tocó producción ni el esquema remoto.

| Fuente | `source_code` | Acceso | Momento | Estado |
|---|---|---|---|---|
| Perfiles alojados (sin menores) | `placsp` | Sindicación `643` (ZIP mensual) | Tras cierre Semana 2 | OK |
| Agregación (sin menores) | `placsp_agregadas` | Sindicación `1044` (ZIP mensual) | Semana 3 estatal | OK |
| Catalunya (PSCP / Transparència) | `catalunya` | Socrata `ybgg-dgi6` (páginas JSON) | Semana 3 Paso 8.6 | OK |

Pipeline comprobado en todos los casos:

```text
discover → fetch → validate → RAW (Storage) → parse → normalize / identidad
→ upsert canónico → source_sync / source_artifacts
```

Más **reejecución idempotente** de la misma ventana (mes o página SODA).

---

# Parte A — `placsp` (Semanas 0–2)

> Tras cerrar el checklist de Semana 2 (`docs/plans/fase2-checklist.md`), antes de multiplicar fuentes.

## A.1 Cómo se aisló el trabajo

- Se usó una rama dedicada de verificación (`pruebas`), creada desde `main` tras el cierre de Semana 2.
- Toda la corrida apuntó a **Supabase local** (Postgres + Storage).
- Recuperación: `supabase db reset` + vaciar el prefijo `placsp/` del bucket `raw`.

## A.2 Fase A — Baseline (sin red PLACSP)

1. Docker + `supabase status`.
2. `supabase db reset` — migraciones Semanas 0–1 + seed OK.
3. `uv sync --extra dev` + `uv run pytest -q` en `ingestion/`.
4. Dry-run con fixture:

```powershell
cd ingestion
uv run python -m efilicit_ingestion.cli run-placsp `
  --fixture tests/fixtures/placsp/valid_single_entry.atom `
  --dry-run `
  --run-id fase-a-dry-run
```

| Comprobación | Resultado |
|---|---|
| Migraciones + seed locales | OK |
| Pytest (ingestion, con stack local) | OK (suite en verde) |
| Dry-run fixture | `status=success`, 1 registro visto/nuevo |

**Nota:** `db reset` no vacía Storage. Conviene limpiar `raw/placsp/` antes del live si hay restos.

## A.3 Fase B — Live (un mes)

Paquete del **mes en curso (septiembre)** vía `sindicacion_643` (`licitacionesPerfilesContratanteCompleto3_YYYYMM.zip`).

```powershell
cd ingestion
uv run python -m efilicit_ingestion.cli run-placsp `
  --from-month YYYY-MM `
  --to-month YYYY-MM `
  --run-id prueba-live-sep-1
```

| Campo | Valor |
|---|---|
| `status` | **success** |
| `run_id` | `prueba-live-sep-1` |
| `source_code` | `placsp` |
| `records_seen` | 25.151 |
| `records_new` | 20.516 |
| `records_updated` | 4.635 |
| `artifacts` | 1 |
| Tamaño del ZIP | ~73 MB |
| Checksum (SHA-256) | `726e2b0d09781d0b439b6f2fcbc3a265b319dafbd72efcd3d667891fc48823a9` |
| Path RAW | `raw/placsp/<año>/<mes>/<día>/licitacionesPerfilesContratanteCompleto3_<YYYYMM>.zip` |

`records_updated` en la 1ª pasada es esperable (varias actualizaciones del mismo expediente en el feed).

| Tabla / métrica | Cantidad |
|---|---|
| `tenders` | 20.517 |
| `tender_sources` (`placsp`) | 20.517 |
| `contracting_authorities` | 3.125 (`HIGH` cuando aplica NIF/CIF) |
| `tender_events` | ~25.154 |
| `documents` | 20.517 |

### Studio (checklist)

| Dónde | Qué verificar |
|---|---|
| Storage → `raw` | ZIP bajo `placsp/…` (~decenas de MB) |
| `source_sync` | `prueba-live-sep-1`, `success` |
| `source_artifacts` | checksum + `storage_path` |
| `tenders` / `tender_sources` | datos reales, `source_code=placsp` |

## A.4 Segunda corrida — idempotencia

```powershell
uv run python -m efilicit_ingestion.cli run-placsp `
  --from-month YYYY-MM `
  --to-month YYYY-MM `
  --run-id prueba-live-sep-2
```

| Campo | 1ª | 2ª |
|---|---|---|
| `status` | success | **success** |
| `records_seen` | 25.151 | **25.151** |
| `records_new` | 20.516 | **0** |
| `records_updated` | 4.635 | **25.151** |
| Checksum | — | **igual** |

Sin crecimiento de `tenders` / `tender_sources`; sin duplicados `(placsp, source_tender_id)`.

## A.5 Veredicto `placsp`

| Criterio | Estado |
|---|---|
| Pipeline E2E con paquete oficial | OK |
| RAW + `source_artifacts` | OK |
| Upsert canónico | OK |
| Idempotencia | OK |
| Remoto intacto | OK |

---

# Parte B — `placsp_agregadas` (Semana 3)

> Con el conector/CLI de agregadas ya cableado en la rama de Semana 3 (`--syndication placsp_agregadas`), mismo patrón de verificación que la Parte A.

## B.1 Cómo se aisló el trabajo

- Rama de trabajo: `tecnico4/semana-03` (no se mezcló con `main` durante la corrida).
- Destino: **Supabase local** únicamente.
- Recuperación: `supabase db reset` + vaciar `raw/placsp_agregadas/` (y, si aplica, otros prefijos `raw/` de pruebas previas).

## B.2 Fase A — Baseline

1. Confirmar rama + Docker + Supabase local.
2. `supabase db reset`.
3. `uv sync --extra dev` + `uv run pytest -q` → **74 passed**.
4. Dry-run agregadas:

```powershell
cd ingestion
uv run python -m efilicit_ingestion.cli run-placsp `
  --syndication placsp_agregadas `
  --fixture tests/fixtures/placsp/valid_single_entry.atom `
  --dry-run `
  --run-id fase-a-agregadas-dry
```

| Comprobación | Resultado |
|---|---|
| Migraciones + seed | OK |
| Pytest | **74 passed** |
| Dry-run | `status=success`, `source_code=placsp_agregadas`, `raw_path=raw/placsp_agregadas/...` |

El dry-run no escribe en DB/Storage.

## B.3 Fase B — Live (un mes)

Mismo criterio: **paquete mensual de septiembre** (`PlataformasAgregadasSinMenores_YYYYMM.zip`, `sindicacion_1044`).

```powershell
cd ingestion
uv run python -m efilicit_ingestion.cli run-placsp `
  --syndication placsp_agregadas `
  --from-month YYYY-MM `
  --to-month YYYY-MM `
  --run-id prueba-live-agregadas-1
```

| Campo | Valor |
|---|---|
| `status` | **success** |
| `run_id` | `prueba-live-agregadas-1` |
| `source_code` | `placsp_agregadas` |
| `records_seen` | 11.458 |
| `records_new` | 8.652 |
| `records_updated` | 2.806 |
| `artifacts` | 1 |
| Tamaño del ZIP | ~6,3 MB |
| Checksum (SHA-256) | `aa1b888036a89cbab15b58e16b2c6aba263a77ae641b165df4b79de9863547ef` |
| Path RAW | `raw/placsp_agregadas/<año>/<mes>/<día>/PlataformasAgregadasSinMenores_<YYYYMM>.zip` |

| Tabla / métrica | Cantidad |
|---|---|
| `tenders` | ~8.654 |
| `tender_sources` (`placsp_agregadas`) | ~8.653 |
| `contracting_authorities` | ~7.793 (`HIGH` ~442; en agregadas muchos órganos vienen sin NIF/CIF) |
| `tender_events` | ~11.464 |
| `documents` | ~9.440 |

### Studio (checklist)

| Dónde | Qué verificar |
|---|---|
| Storage → `raw` | ZIP bajo `placsp_agregadas/…` (~6 MB) |
| `source_sync` | `prueba-live-agregadas-1`, `success` |
| `source_artifacts` | `artifact_key` del ZIP agregadas, checksum |
| `tender_sources` | filtro `source_code = placsp_agregadas` |
| `tenders` | títulos reales (CCAA / entidades agregadas) |

**Nota:** no se exige deduplicación cross-source con `placsp` (Semana 4). Los `source_code` conviven sin mezclarse en `tender_sources`.

## B.4 Segunda corrida — idempotencia

```powershell
uv run python -m efilicit_ingestion.cli run-placsp `
  --syndication placsp_agregadas `
  --from-month YYYY-MM `
  --to-month YYYY-MM `
  --run-id prueba-live-agregadas-2
```

| Campo | 1ª | 2ª |
|---|---|---|
| `status` | success | **success** |
| `records_seen` | 11.458 | **11.458** |
| `records_new` | 8.652 | **0** |
| `records_updated` | 2.806 | **11.458** |
| Checksum | — | **igual** |

Sin crecimiento de `tenders` / `tender_sources`; sin duplicados `(placsp_agregadas, source_tender_id)`.

## B.5 Veredicto `placsp_agregadas`

| Criterio | Estado |
|---|---|
| Pipeline E2E con paquete oficial de agregación | OK |
| Prefijo RAW `raw/placsp_agregadas/` | OK |
| Upsert con `source_code` distinto de `placsp` | OK |
| Idempotencia | OK |
| Remoto intacto | OK |

---

# Parte C — `catalunya` (Semana 3 / Paso 8.6)

> Con `SocrataConnector` + CLI `run-catalunya` ya cableados (Pasos 7–8.5). Aquí no hay ZIP mensual: el live se acota por **páginas SODA** (`--page-size` / `--max-pages` / `--start-offset`).

## C.1 Cómo se aisló el trabajo

- Rama: `tecnico4/semana-03`.
- Destino: **Supabase local**.
- Recuperación: `supabase db reset` + vaciar `raw/catalunya/`.

## C.2 Fase A — Baseline

1. Confirmar rama + Docker + Supabase local.
2. `supabase db reset`.
3. `uv sync --extra dev` + `uv run pytest -q` → **98 passed**.
4. Dry-run:

```powershell
cd ingestion
uv run python -m efilicit_ingestion.cli run-catalunya `
  --fixture tests/fixtures/catalunya/valid_page.json `
  --dry-run `
  --run-id fase-a-catalunya-dry
```

| Comprobación | Resultado |
|---|---|
| Migraciones + seed | OK |
| Pytest | **98 passed** |
| Dry-run | `status=success`, `source_code=catalunya`, `records_seen=2`, path `raw/catalunya/...` |

## C.3 Fase B — Live (una página SODA)

Equivalente al “un mes” de PLACSP: **1 página × 1000 filas** desde offset 0 del dataset `ybgg-dgi6`.

```powershell
cd ingestion
uv run python -m efilicit_ingestion.cli run-catalunya `
  --page-size 1000 `
  --max-pages 1 `
  --start-offset 0 `
  --run-id prueba-live-catalunya-1
```

| Campo | Valor |
|---|---|
| `status` | **success** |
| `run_id` | `prueba-live-catalunya-1` |
| `source_code` | `catalunya` |
| `records_seen` | 1000 |
| `records_new` | 1000 |
| `records_updated` | 0 |
| `artifacts` | 1 |
| Tamaño del JSON | ~2,9 MB |
| Checksum (SHA-256) | `317b1ee5cbc69d85863af5ea8dacdec8add246a1ee483af255c628b5efc4713c` |
| Path RAW | `raw/catalunya/<año>/<mes>/<día>/ybgg-dgi6_offset_0000000_limit_1000.json` |

| Tabla / métrica | Cantidad (aprox.) |
|---|---|
| `tender_sources` (`catalunya`) | ~1002 |
| `tenders` | ~1004 |

*(Un par de filas extra pueden venir de tests de integración Postgres con fixture ejecutados en la Fase A tras el reset; el live aportó exactamente 1000.)*

### Studio (checklist)

| Dónde | Qué verificar |
|---|---|
| Storage → `raw` | JSON bajo `catalunya/…ybgg-dgi6_offset_…` |
| `source_sync` | `prueba-live-catalunya-1`, `success` |
| `source_artifacts` | `artifact_key` de la página, checksum |
| `tender_sources` | filtro `source_code = catalunya` |
| `tenders` | títulos PSCP / catalán reales |

## C.4 Segunda corrida — idempotencia

```powershell
uv run python -m efilicit_ingestion.cli run-catalunya `
  --page-size 1000 `
  --max-pages 1 `
  --start-offset 0 `
  --run-id prueba-live-catalunya-2
```

| Campo | 1ª | 2ª |
|---|---|---|
| `status` | success | **success** |
| `records_seen` | 1000 | **1000** |
| `records_new` | 1000 | **0** |
| `records_updated` | 0 | **1000** |
| Checksum | — | **igual** |

Sin duplicados `(catalunya, source_tender_id)`; el conteo de `tender_sources` no creció.

## C.5 Veredicto `catalunya`

| Criterio | Estado |
|---|---|
| Pipeline E2E con página SODA real | OK |
| Prefijo RAW `raw/catalunya/` | OK |
| Upsert `(catalunya, id_intern)` | OK |
| Idempotencia | OK |
| Remoto intacto | OK |

---

# Cómo repetir

### `placsp`

```powershell
uv run python -m efilicit_ingestion.cli run-placsp `
  --from-month YYYY-MM --to-month YYYY-MM --run-id <id>
```

### `placsp_agregadas`

```powershell
uv run python -m efilicit_ingestion.cli run-placsp `
  --syndication placsp_agregadas `
  --from-month YYYY-MM --to-month YYYY-MM --run-id <id>
```

### `catalunya`

```powershell
uv run python -m efilicit_ingestion.cli run-catalunya `
  --page-size 1000 --max-pages 1 --start-offset 0 --run-id <id>
```

Pasos comunes: stack local → (opcional) `db reset` + limpiar Storage → pytest / dry-run → live acotado → Studio → 2ª corrida con otro `run_id`.

### Límites conscientes

- No sustituye CI sin red (unitarios siguen offline).
- No valida UI de búsqueda, Auth ni alertas.
- Un mes / una página ≠ histórico completo del dataset.
- `placsp_menores`, `euskadi` y resto de CCAA no forman parte de estas corridas.

---

## Referencias

- Semana 2: [plans/semana02-plan.md](plans/semana02-plan.md), [plans/fase2-checklist.md](plans/fase2-checklist.md), [sources/placsp.md](sources/placsp.md)
- Semana 3: [plans/semana03-plan.md](plans/semana03-plan.md), [plans/fase3-checklist.md](plans/fase3-checklist.md), [sources/placsp_agregadas.md](sources/placsp_agregadas.md), [sources/catalunya.md](sources/catalunya.md)
- CLI: `ingestion/README.md` (`run-placsp`, `run-catalunya`)
- Roadmap: [04-roadmap-mvp.md](04-roadmap-mvp.md) § Semanas 2–3
