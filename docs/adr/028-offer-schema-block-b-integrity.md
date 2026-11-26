# 028 - Endurecimiento oferta (bloque B): RESTRICT + evidencias + FK compuestas

**Fecha:** 2026-11-10

**Estado:** Aceptado

**Extiende:** [026](026-mis-licitaciones-offer-cases.md), [027](027-offer-schema-hardening-is-app-user.md)

**Reemplazado por:** Ninguno

---

## Contexto

El esquema `offer_*` del 026 permitía: (1) borrar una licitación canónica y llevarse el expediente por `ON DELETE CASCADE`; (2) evidencias con `evidence_kind` incoherente y `SET NULL` que chocaba con el CHECK de payload; (3) vincular requisito/entregable/pliego/fuente entre **distintos** `offer_cases`.

## Decisión

1. **`offer_cases.tender_id` → `ON DELETE RESTRICT`.** En cuanto existe expediente (activa o histórica), la licitación no se borra. Wipes **saltan** esos `tenders` (no desvinculan). Fusión dedup: reasignar `offer_cases.tender_id` al id superviviente.
2. **`offer_requirement_evidence`:** CHECK por `evidence_kind` (exactamente el payload del tipo) + FKs a `company_*` con **`ON DELETE RESTRICT`**.
3. **Mismo expediente en puentes:** `UNIQUE (id, offer_case_id)` en requisitos/entregables/pliegos/fuentes; columnas `offer_case_id` + FK compuestas en `offer_requirement_deliverables`, `offer_source_links`, `parent_id` de entregables, `pliego_id` de fuentes y `related_*` de bitácora.
4. Migración `20261110160000_offer_schema_block_b_integrity.sql` — **solo local** hasta OK explícito de remoto.

## Alternativas descartadas

- `SET NULL` + snapshot en `offer_cases` al borrar tender — más UI; el producto prefiere imborrable.
- CASCADE al borrar documento de biblioteca — borra evidencias en silencio; se prefiere desvincular a propósito.
- Solo triggers / confianza en UI — frágil.

## Consecuencias

- Scripts de wipe / limpieza deben excluir tenders con `offer_cases` ([wipe-app-data](../runbooks/wipe-app-data.md)).
- La UI de biblioteca debe impedir borrar docs/personas en uso (error FK) o pedir desvincular antes.
- Inserts en tablas puente deben rellenar `offer_case_id` coherente.

## Referencias

- Requisitos producto §6 / integridad; decisiones chat 2026-11-10 (bloque B)
