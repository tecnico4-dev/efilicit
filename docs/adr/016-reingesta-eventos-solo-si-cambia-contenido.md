# 016 - Re-ingesta: `tender_events` / `updated_at` solo si cambia el contenido

**Fecha:** 07-10-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

Cada reaparición de una licitación ya conocida en el pipeline hacía `UPDATE` de `tenders` (`updated_at = now()`) e insertaba `tender_events` con `event_type = updated`, aunque los campos canónicos no hubieran cambiado. El historial y `updated_at` reflejaban “reingestado”, no “cambió en la fuente”.

La señal operativa “sigue viva en el feed” ya existe en `tender_sources.last_seen_at`.

---

## Decisión

En el upsert canónico (Postgres e InMemory), si ya existe `(source_code, source_tender_id)`:

1. Siempre refrescar `tender_sources` (incl. `last_seen_at`).
2. Comparar campos de negocio del tender (título, estado, plazo, importe, CPV, organismo, etc.).
3. Solo si difieren → `UPDATE` tenders + `updated_at` + evento `updated`.
4. `stats.updated` / `source_sync.records_updated` cuentan solo esos cambios reales.

### Alternativas descartadas

- **Checksum del payload.** Equivalente; se prefirió comparar campos por depurabilidad.
- **Mover `last_seen` a `tenders`.** Mezclaría negocio y ops; `tender_sources` ya tiene la columna.

---

## Consecuencias

- Historial y `updated_at` alineados con cambios de negocio.
- Re-ingestas diarias sin novedades no ensucian `tender_events`.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Campos no incluidos en la comparación | Lista explícita en `_tender_compare_snapshot`; ampliar con migración/tests si hace falta |
| Ruido por normalización de fechas/importes | Comparación normalizada (UTC naive, Decimal) |

---

## Referencias

- `ingestion/src/efilicit_ingestion/pipeline/canonical_repo.py`
- `ingestion/tests/test_tender_content_change_upsert.py`
