# Pruebas de verificación — Semanas 0–2 (PLACSP real)

> **Estado:** OK (verificación local con datos reales)  
> **Cuándo:** tras cerrar el checklist de Semana 2 (`docs/plans/fase2-checklist.md`), antes de multiplicar fuentes.  
> **Ámbito:** vertical slice PLACSP (`source_code = placsp`, sindicación `643`) en **Supabase local**.  
> **Norma:** `docs/00`–`04` y `.cursor/rules/`. No se tocó producción ni el esquema remoto.

---

## 1. Objetivo

Comprobar que el código de las Semanas 0–2 no solo pasa fixtures y tests unitarios, sino que la tubería completa funciona con un **paquete oficial real** de PLACSP:

```text
discover → fetch → validate → RAW (Storage) → parse → normalize / identidad
→ upsert canónico → source_sync / source_artifacts
```

Y que **reejecutar** la misma ventana no duplica licitaciones (idempotencia).

---

## 2. Cómo se aisló el trabajo

- Se usó una rama dedicada de verificación (`pruebas`), creada desde `main` tras el cierre de Semana 2.
- Toda la corrida apuntó a **Supabase local** (Postgres + Storage). No se usó el proyecto remoto como destino de escritura.
- Si algo hubiera fallado, el estado local se podía limpiar con `supabase db reset` y vaciando el prefijo `placsp/` del bucket `raw`, sin afectar `main`.

---

## 3. Fase A — Baseline del entorno (sin red PLACSP)

### Qué se hizo

1. Confirmar Docker y `supabase status` (stack local arriba).
2. `supabase db reset` — migraciones Semanas 0–1 + seed locales aplicadas sin error.
3. En `ingestion/`: `uv sync --extra dev` y `uv run pytest -q`.
4. Smoke CLI con fixture (sin descarga live):

```powershell
cd ingestion
uv run python -m efilicit_ingestion.cli run-placsp `
  --fixture tests/fixtures/placsp/valid_single_entry.atom `
  --dry-run `
  --run-id fase-a-dry-run
```

### Resultado

| Comprobación | Resultado |
|---|---|
| Migraciones + seed locales | OK |
| Pytest (ingestion, con stack local) | OK (suite en verde) |
| Dry-run fixture | `status=success`, 1 registro visto/nuevo |

**Nota:** `supabase db reset` reconstruye la base local; **no vacía** por sí solo los objetos ya subidos al bucket Storage `raw`. Antes de la corrida live conviene partir de un Storage limpio (o borrar el prefijo `placsp/` si hubiera restos de tests de integración).

---

## 4. Fase B — Corrida live acotada (un mes)

### Por qué un solo mes

Los ZIP mensuales de PLACSP pueden ser grandes. Se eligió el **paquete mensual del mes en curso (septiembre)** (`licitacionesPerfilesContratanteCompleto3_YYYYMM.zip` vía URI conocida de `sindicacion_643`), por ser una ventana acotada y, en un mes aún abierto, típicamente más manejable que un mes cerrado completo.

### Comando (primera corrida)

```powershell
cd ingestion
uv run python -m efilicit_ingestion.cli run-placsp `
  --from-month YYYY-MM `
  --to-month YYYY-MM `
  --run-id prueba-live-sep-1
```

Sustituir `YYYY-MM` por el mes del paquete elegido (en esta verificación: **septiembre del año en curso**).  
Sin `--fixture` ni `--dry-run`: descarga real + escritura a Postgres/Storage locales.

### Resultado de la primera corrida

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

`records_updated` en la primera pasada es esperable: el feed Atom/CODICE trae **actualizaciones** del mismo expediente dentro del mismo paquete; el upsert canónico las consolida por `(source_code, source_tender_id)`.

### Contadores en Postgres local (tras la 1ª)

| Tabla / métrica | Cantidad |
|---|---|
| `tenders` | 20.517 |
| `tender_sources` (`placsp`) | 20.517 |
| `contracting_authorities` | 3.125 (confianza `HIGH` cuando aplica NIF/CIF) |
| `tender_events` | ~25.154 |
| `documents` | 20.517 |

### Comprobación visual en Supabase Studio

Studio local: URL que indique `supabase status` (habitualmente `http://127.0.0.1:54323`).

| Dónde | Qué verificar |
|---|---|
| Storage → bucket `raw` | ZIP mensual real bajo `placsp/…` (~decenas de MB) |
| `source_sync` | Fila `prueba-live-sep-1`, `status=success`, contadores coherentes |
| `source_artifacts` | `artifact_key` del ZIP, checksum y `storage_path` |
| `tenders` | Miles de filas con títulos/importes/CPV reales (no fixtures) |
| `tender_sources` | `source_code=placsp` y `source_tender_id` rellenos |
| `contracting_authorities` | Organismos con `tax_id` cuando la fuente lo aporta |

---

## 5. Segunda corrida — idempotencia

### Comando

Mismo mes que la primera corrida; otro `run_id`:

```powershell
cd ingestion
uv run python -m efilicit_ingestion.cli run-placsp `
  --from-month YYYY-MM `
  --to-month YYYY-MM `
  --run-id prueba-live-sep-2
```

### Resultado

| Campo | 1ª corrida | 2ª corrida |
|---|---|---|
| `status` | success | **success** |
| `records_seen` | 25.151 | **25.151** |
| `records_new` | 20.516 | **0** |
| `records_updated` | 4.635 | **25.151** |
| Checksum del artefacto | (mismo ZIP) | **igual** |

Tras la 2ª:

- `tenders` y `tender_sources` **no crecieron** (siguen en 20.517).
- Sin duplicados por `(source_code, source_tender_id)`.

**Conclusión:** reejecutar el mismo mes no duplica el modelo canónico; solo actualiza.

---

## 6. Veredicto

| Criterio Semana 2 (datos reales) | Estado |
|---|---|
| Pipeline E2E con paquete oficial PLACSP | OK |
| RAW en Storage + registro en `source_artifacts` | OK |
| Upsert canónico poblado | OK |
| `source_sync` refleja la ejecución | OK |
| Trazabilidad licitación → artefacto | OK |
| Reejecución idempotente | OK |
| Producción / remoto intactos | OK |

El vertical slice de Semanas 0–2 queda **validado fuera de fixtures** para PLACSP, listo como base antes de escalar fuentes (Semana 3+).

---

## 7. Cómo repetir la prueba

1. Rama limpia desde `main` (o la rama de verificación acordada).
2. Docker + `supabase start` +, si hace falta, `supabase db reset`.
3. Limpiar Storage `raw/placsp/` si se quiere un punto de partida vacío.
4. Fase A: `pytest` + dry-run con fixture.
5. Fase B: `run-placsp --from-month YYYY-MM --to-month YYYY-MM --run-id <id>` (un solo mes).
6. Revisar Studio (tablas + Storage).
7. Segunda corrida con otro `--run-id` y mismos meses → esperar `records_new=0` y sin crecimiento de `tender_sources`.

Si falla: anotar `source_sync.error_message` / salida CLI, resetear local si hace falta, y aislar etapa (`discover` / `fetch` / parse / upsert) sin tocar remoto.

### Límites conscientes

- No es un test de CI automatizado con red a PLACSP (los unitarios siguen sin red).
- No valida UI de búsqueda, Auth de producto ni alertas (fuera de Semana 2).
- Un mes ≠ cobertura histórica completa; solo demuestra la tubería con volumen real.

---

## Referencias

- Plan / checklist Semana 2: [plans/semana02-plan.md](plans/semana02-plan.md), [plans/fase2-checklist.md](plans/fase2-checklist.md)
- Fuente: [sources/placsp.md](sources/placsp.md)
- CLI: `ingestion/README.md` (`run-placsp`)
- Roadmap: [04-roadmap-mvp.md](04-roadmap-mvp.md) § Semana 2
