# 024 - Eliminar `tender_sources.last_seen_at`

**Fecha:** 2026-11-03

**Estado:** Aceptado

**Reemplaza:** Ninguno (ajusta el contrato de re-visita descrito en [017](017-tender-events-tipo-pipeline-y-status.md) y [015](015-fuente-ganadora-canonica.md); coherente con [022](022-placsp-raw-entry-incremental.md))

**Reemplazado por:** Ninguno

---

## Contexto

`tender_sources.last_seen_at` marcaba “la fuente ha vuelto a ver esta licitación” en cada upsert, aunque no hubiera cambio de negocio. Con PLACSP RAW incremental ([022](022-placsp-raw-entry-incremental.md)), las entries ya conocidas **no** pasan por upsert: el heartbeat diario dejó de ser fiable. La UI de favoritos/ficha ya no lo usa (frescura = `tenders.updated_at` / `created_at`).

Mantener la columna y la RPC `tender_max_last_seen` solo añade ruido de esquema y código muerto.

---

## Decisión

1. **Dejar de escribir** `last_seen_at` en el upsert canónico (`canonical_repo`).
2. **Eliminar** la columna `public.tender_sources.last_seen_at` y la función `public.tender_max_last_seen(uuid[])`.
3. Re-visita sin cambio de contenido: **sin** rastro operativo dedicado; solo se refrescan URL/artifact/match si el registro llega al upsert.
4. Alertas y matching siguen basándose en `tenders.updated_at` / ventana de sync ([020](020-alertas-match-post-ingesta-y-digest-diario.md)).

Migración: `supabase/migrations/20261103100000_drop_tender_sources_last_seen.sql`.

### Alternativas descartadas

- **Seguir actualizando `last_seen_at` en skip PLACSP.** Coste CPU/DB sin valor de producto.
- **Conservar la columna sin escrituras.** Deuda de esquema innecesaria.
- **Sustituir por otro heartbeat diario.** No hay requisito de producto.

---

## Consecuencias

### Positivas

- Esquema y tipos alineados con el modelo incremental.
- UI y alertas usan una sola noción de frescura (`updated_at` / `created_at`).

### Negativas / riesgos

- No se puede auditar “última confirmación en fuente sin cambio”. Aceptado.
- Seeds/scripts/tests históricos debían dejar de referenciar la columna.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Código o seed remoto aún inserta `last_seen_at` | Migración + grep; seeds actualizados en el mismo PR |
| Confusión con textos de ADR 015/017 | Este ADR; notas de remisión en esos documentos |

---

## Referencias

- `supabase/migrations/20261103100000_drop_tender_sources_last_seen.sql`
- `ingestion/src/efilicit_ingestion/pipeline/canonical_repo.py`
- [017](017-tender-events-tipo-pipeline-y-status.md) · [015](015-fuente-ganadora-canonica.md) · [022](022-placsp-raw-entry-incremental.md)
