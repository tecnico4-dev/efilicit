# 035 - Intake de pliegos del expediente (PLACSP)

**Fecha:** 2026-11-19  
**Enmienda:** 2026-11-26 — fase sync estructurada en servidor web (sin PDFs)

**Estado:** Aceptado (local; remoto pendiente de OK explícito)

**Reemplaza:** Ninguno. Enmienda el punto 10 de [026](026-mis-licitaciones-offer-cases.md) (Storage de ficheros aplazado).

**Reemplazado por:** Ninguno

---

## Contexto

Al añadir una licitación a Mis licitaciones solo se creaba `offer_cases`; requisitos, sobres, pliegos y calendario quedaban vacíos hasta que el worker batch corriera (latencia de minutos/horas). El spike del 2026-11-19 sobre el Atom vivo de PLACSP (50 entries) confirmó que el CODICE que ya guardamos en RAW trae:

- `LegalDocumentReference` (PCAP), `TechnicalDocumentReference` (PPT), `AdditionalDocumentReference` (anexos) con URI + hash; descarga directa por el servlet `FileSystem` (PDF/DOCX).
- `GeneralDocument` (biblioteca `wcm/connect`: memoria, modelos, actas…). Esas URLs devuelven *Request Rejected* del WAF a clientes no navegador → **no se descargan**; solo enlace oficial.
- `TenderingTerms`: criterios de adjudicación (`OBJ`/`SUBJ` + peso → `offer_deliverables` hijos B/C, no matriz), solvencia técnica/económica (texto + umbral), clasificación, declaraciones, garantías, condiciones de ejecución (`ContractExecutionRequirement` social/ambiental → `offer_requirements.category = condiciones_ejecucion`); lotes con términos propios; plazos de ofertas y de disponibilidad de documentos.
- **Separación matriz / sobres (2026-11-25):** `offer_requirements` = pass/fail (solvencia, declaraciones, garantías, ejecución). Criterios de adjudicación solo en `offer_deliverables` (Resumen + Sobres; estimación `our_estimate`). Evita duplicar criterios en la matriz.

El RAW por entry se localiza desde la licitación: `tender_sources.artifact_id` → `source_artifacts.storage_path` (ADR 022/033).

## Decisión

1. **Cola en Postgres** `offer_case_intake` (`pending` → `processing` → `done`/`failed`). La web inserta con RLS `is_app_user()` (solo `pending`); un índice único parcial impide dos trabajos abiertos por expediente. Sin UPDATE/DELETE desde la web.
2. **Fase sync en servidor web (inmediata, sin PDFs):** al crear el expediente (y al «Reprocesar»), una Server Action con `service_role` **solo en servidor**:
   - Lee el Atom RAW (`source_artifacts.storage_path` → bucket `raw`).
   - Parsea términos con el port TypeScript server-only (`apps/web/src/server/offer-intake/`, espejo de `placsp_terms` + `plan`).
   - Vuelca filas `offer_*` de forma idempotente (`on conflict do nothing` / `ignoreDuplicates`).
   - **No** descarga PDFs ni escribe en `offer-docs`.
   - **No** marca el trabajo de cola como `done` (sigue `pending` para el worker de descargas).
   - Timeout corto y fallo graceful: si falta `SUPABASE_SERVICE_ROLE_KEY`, RAW o la fuente no es PLACSP, la UI no tumba el alta; el cron sigue siendo el fallback.
3. **Worker batch** `run-offer-intake` (Python, `service_role` vía `EFILICIT_DATABASE_URL` + Storage) en GitHub Actions `offer-intake.yml`, solo `workflow_dispatch` (ADR 005). Cadencia productiva: **1–2×/día** vía cron externo (descargas de pliegos FileSystem + re-apply idempotente). Sin backend HTTP permanente ni cola externa.
4. **Parser de referencia** `offer_intake/placsp_terms.py` + `plan.py` (Python). Port TS server-only para la fase sync; el worker Python sigue siendo la SoT del batch. Fixtures compartidas (`ingestion/tests/fixtures/placsp/`). La UI/cliente **no** conoce CODICE.
5. **Bucket privado `offer-docs`** (`{offer_case_id}/{sha256}.{ext}`). Lectura `authenticated` + `is_app_user()` (signed URLs con la sesión, sin `service_role` en navegador); escritura solo worker. Tope de tamaño por fichero en el worker.
6. **Volcado idempotente**: `source_key` + unique `(offer_case_id, source_key)` en pliegos, requisitos, entregables e hitos. Sync y worker solo insertan lo que falta; nunca sobrescriben filas existentes (las ediciones del usuario mandan).
7. Requisitos del XML con `source_kind = 'pliego_xml'`, `compliance_status = 'sin_verificar'`; trazabilidad a `pliego_id` cuando aplica.
8. Alcance: **solo fuentes PLACSP** (`placsp`, `placsp_agregadas`, `placsp_menores`). Otras fuentes → sync no-op / trabajo `done` con `stats.skipped`.
9. Extracción con IA sobre el texto del PDF: **fuera** de este ADR (ADR posterior; resultados como borrador revisable).

## Alternativas descartadas

- **Disparar el workflow desde la web** (PAT en Vercel): secreto de GitHub en el frontend/servidor web y acoplamiento.
- **Descargar PDFs en la Server Action**: latencia y timeouts de función; queda en el worker batch.
- **Descargar en el navegador / Route Handler**: sin `service_role` no hay RAW; y descargas largas en funciones web.
- **Saltar el WAF de la biblioteca** (UA de navegador): evasión de controles de la fuente; se guarda solo el enlace.
- **Parsear el PDF ya**: sin librería ni criterio de calidad; queda para la fase IA.
- **Invocar Python desde Next**: no portable a Vercel; dual-path frágil.

## Consecuencias

- Pestañas Pliegos / Sobres / Requisitos / Calendario con datos estructurados **al añadir** el expediente (sync).
- PDFs y `storage_path` de pliegos siguen con latencia del cron (1–2×/día).
- Doble mantenimiento parser Python ↔ TS (tests con la misma fixture).
- `SUPABASE_SERVICE_ROLE_KEY` en el entorno del servidor web (local `.env.local`; Vercel secret cuando se habilite remoto). Nunca en el navegador.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Drift Python ↔ TS | Fixture `offer_terms_entry.atom` + tests espejo en web |
| `service_role` en web server | Solo Server Action; no se expone al cliente; lectura RAW + insert offer_* |
| Cambios de CODICE / estructura | Fixture del spike + tests; parser tolerante (campos opcionales) |
| Descarga bloqueada o lenta | Timeout, reintentos, tope de tamaño; `fetch_status = error` y enlace oficial |
| Duplicados al reprocesar | `source_key` único por expediente |
| Datos sensibles en PDFs | Bucket privado; lectura solo app users |

## Referencias

- [026](026-mis-licitaciones-offer-cases.md), [028](028-offer-schema-block-b-integrity.md), [022](022-placsp-raw-entry-incremental.md), [033](033-placsp-commit-por-pagina-raw-sin-fecha.md), [005](005-ingesta-actions-manual-first-cron-off.md)
- Migración `20261119140000_offer_case_intake.sql`
