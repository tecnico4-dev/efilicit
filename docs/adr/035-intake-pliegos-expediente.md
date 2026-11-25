# 035 - Intake de pliegos del expediente (PLACSP)

**Fecha:** 2026-11-19

**Estado:** Aceptado (local; remoto pendiente de OK explícito)

**Reemplaza:** Ninguno. Enmienda el punto 10 de [026](026-mis-licitaciones-offer-cases.md) (Storage de ficheros aplazado).

**Reemplazado por:** Ninguno

---

## Contexto

Al añadir una licitación a Mis licitaciones solo se creaba `offer_cases`; requisitos, sobres, pliegos y calendario quedaban vacíos. El spike del 2026-11-19 sobre el Atom vivo de PLACSP (50 entries) confirmó que el CODICE que ya guardamos en RAW trae:

- `LegalDocumentReference` (PCAP), `TechnicalDocumentReference` (PPT), `AdditionalDocumentReference` (anexos) con URI + hash; descarga directa por el servlet `FileSystem` (PDF/DOCX).
- `GeneralDocument` (biblioteca `wcm/connect`: memoria, modelos, actas…). Esas URLs devuelven *Request Rejected* del WAF a clientes no navegador → **no se descargan**; solo enlace oficial.
- `TenderingTerms`: criterios de adjudicación (`OBJ`/`SUBJ` + peso), solvencia técnica/económica (texto + umbral), clasificación, declaraciones, garantías, condiciones de ejecución (`ContractExecutionRequirement` social/ambiental → `offer_requirements.category = condiciones_ejecucion`); lotes con términos propios; plazos de ofertas y de disponibilidad de documentos.

El RAW por entry se localiza desde la licitación: `tender_sources.artifact_id` → `source_artifacts.storage_path` (ADR 022/033).

## Decisión

1. **Cola en Postgres** `offer_case_intake` (`pending` → `processing` → `done`/`failed`). La web inserta con RLS `is_app_user()` (solo `pending`); un índice único parcial impide dos trabajos abiertos por expediente. Sin UPDATE/DELETE desde la web.
2. **Worker batch** `run-offer-intake` (Python, `service_role` vía `EFILICIT_DATABASE_URL` + Storage) en GitHub Actions `offer-intake.yml`, solo `workflow_dispatch` (ADR 005), programado por el cron externo. Sin backend HTTP permanente ni cola externa.
3. **Parser puro** `offer_intake/placsp_terms.py` (sin DB/red) separado del parser canónico. La web sigue sin conocer CODICE.
4. **Bucket privado `offer-docs`** (`{offer_case_id}/{sha256}.{ext}`). Lectura `authenticated` + `is_app_user()` (signed URLs con la sesión, sin `service_role` en navegador); escritura solo worker. Tope de tamaño por fichero en el worker.
5. **Volcado idempotente**: `source_key` + unique `(offer_case_id, source_key)` en pliegos, requisitos, entregables e hitos. El worker solo inserta lo que falta; nunca sobrescribe filas existentes (las ediciones del usuario mandan).
6. Requisitos del XML con `source_kind = 'pliego_xml'`, `compliance_status = 'sin_verificar'`; trazabilidad a `pliego_id` cuando aplica.
7. Alcance: **solo fuentes PLACSP** (`placsp`, `placsp_agregadas`, `placsp_menores`). Otras fuentes → trabajo `done` con `stats.skipped`.
8. Extracción con IA sobre el texto del PDF: **fuera** de este ADR (ADR posterior; resultados como borrador revisable).

## Alternativas descartadas

- **Disparar el workflow desde la web** (PAT en Vercel): secreto de GitHub en el frontend/servidor web y acoplamiento.
- **Descargar en el navegador / Route Handler**: sin `service_role` no hay RAW; y descargas largas en funciones web.
- **Saltar el WAF de la biblioteca** (UA de navegador): evasión de controles de la fuente; se guarda solo el enlace.
- **Parsear el PDF ya**: sin librería ni criterio de calidad; queda para la fase IA.

## Consecuencias

- Pestañas Pliegos / Sobres / Requisitos / Calendario con datos reales tras el intake.
- Latencia de minutos (cadencia del cron), no inmediata.
- Storage crece con PDFs por expediente (decenas de MB por caso).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Cambios de CODICE / estructura | Fixture del spike + tests; parser tolerante (campos opcionales) |
| Descarga bloqueada o lenta | Timeout, reintentos, tope de tamaño; `fetch_status = error` y enlace oficial |
| Duplicados al reprocesar | `source_key` único por expediente |
| Datos sensibles en PDFs | Bucket privado; lectura solo app users |

## Referencias

- [026](026-mis-licitaciones-offer-cases.md), [028](028-offer-schema-block-b-integrity.md), [022](022-placsp-raw-entry-incremental.md), [033](033-placsp-commit-por-pagina-raw-sin-fecha.md), [005](005-ingesta-actions-manual-first-cron-off.md)
- Migración `20261119140000_offer_case_intake.sql`
