# 026 - Mis licitaciones: expediente de oferta (`offer_*`)

**Fecha:** 2026-11-06

**Estado:** Aceptado

**Reemplaza:** Ninguno (extiende [023](023-mis-licitaciones-pipeline-compartido.md))

**Reemplazado por:** Ninguno

**Retirada legacy (2026-11-10):** UI `/my-tenders` y tablas `bid_*` eliminadas (migración `20261110140000_drop_bid_pipeline_legacy.sql`). Solo `offer_*` / `company_*` + `/mis-licitaciones`.

---

## Contexto

El espacio de oferta acordado (matriz requisito→evidencia, sobres, go/no-go, KPIs, equipo, calendario, biblioteca, fuentes) no cabe en el checklist plano de `bid_*`. La UI nueva vive en `/mis-licitaciones` y necesita un esquema propio, con backfill del histórico Eficen ya presente en `bid_cases`.

## Decisión

1. **Expediente y matriz**
   - `offer_cases` — una fila por `tenders.id` (etapa, go/no-go, lotes, plazos, responsable).
   - `offer_requirements` — matriz (categoría, tipo, cumplimiento, preparación, sobre, validación).
2. **Sobres y vínculos**
   - `offer_deliverables` (+ `parent_id` para secciones de memoria).
   - `offer_requirement_deliverables` — N:M requisito ↔ entregable.
   - `offer_requirement_evidence` — evidencias (doc / persona / referencia / financiero / URL).
3. **Equipo y tareas**
   - `offer_case_members` — roles preparador/revisor/aprobador.
   - `offer_tasks` — tareas sueltas.
   - `offer_assigned_people` — adscripción de medios (≠ equipo preparador).
4. **Plazos y bitácora**
   - `offer_milestones` — hitos oficiales/internos.
   - `offer_case_log` — bitácora tipada.
5. **Pliegos y fuentes**
   - `offer_case_pliegos` — PCAP/PPT/anexos enlazados al expediente.
   - `offer_sources` + `offer_source_links` — trazabilidad de fuentes.
6. **Biblioteca de empresa**
   - `company_documents` (tipo, emisión, caducidad, url/`storage_path`).
   - `company_people`, `company_references`, `company_financials`.
7. Etapas: `interes` | `analisis` | `preparacion` | `presentada` | `en_evaluacion` | `requerimiento` | `adjudicada` | `no_adjudicada` | `descartada` | `subcontrata` | `desierta`.
8. RLS: `is_app_user()` (mismo tenant compartido que 023).
9. Backfill one-shot: `bid_cases` → `offer_cases` (mismo `id`); checklist → `offer_requirements`.
10. **Storage de ficheros** (bucket privado): aplazado; columnas `url` / `storage_path` listas.
11. UI `/mis-licitaciones` usa solo este esquema. Legacy `/my-tenders` + `bid_*` retirados (2026-11-10).

### Alternativas descartadas

- **ALTER in-place de `bid_cases`.** Mezcla legacy y producto nuevo.
- **Reutilizar `bid_documents` como biblioteca.** Contrato distinto (caducidad, tipos); mejor `company_*`.
- **Bucket Storage en este ADR.** Reabre el aplazamiento del 023 en un ADR/migración posterior cuando haya copia de evidencias.

## Consecuencias

### Positivas

- Esquema completo para Incrementos 1–4 sin reinventar tablas a cada paso.
- Histórico Eficen ya en `offer_cases`.
- Separación clara legacy `bid_*` vs oferta `offer_*` / `company_*`.

### Negativas / riesgos

- UI aún no cubre todas las tablas (esquema adelantado a la interfaz).
- (Histórico) Hubo dos pipelines en paralelo hasta retirar `bid_*` (2026-11-10).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Esquema amplio sin UI | Migraciones versionadas; tablas vacías OK; cablear por incremento |
| Desalineación bid ↔ offer | Mitigado: `bid_*` retiradas (2026-11-10); altas solo en `offer_cases` |

## Referencias

- [023](023-mis-licitaciones-pipeline-compartido.md)
- Requisitos producto: espacio de preparación de oferta (2026-11-04) §12
- Reglas: RLS; sin `service_role` en web; migraciones versionadas
