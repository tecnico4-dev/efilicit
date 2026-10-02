# 006 - RAW en Storage vía API HTTP (`httpx` + `service_role`), sin `supabase-py`

**Fecha:** 11-09-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

Semana 2 Paso 4 exige guardar el RAW inmutable en el bucket privado `raw` de Supabase Storage y registrar metadatos en `source_artifacts`. El stack fijo ya incluye **`httpx`** como cliente HTTP del ETL. Existía la opción de añadir el SDK oficial **`supabase-py`** solo para Storage.

Había que elegir cómo habla el proceso confiable de ingesta con Storage sin meter `service_role` en el frontend y sin inflar dependencias.

---

## Decisión

Implementar `SupabaseStorageArtifactStore` que:

1. Sube bytes al endpoint Storage (`/storage/v1/object/...`) con **`httpx`**.
2. Autentica con **`service_role`** (solo proceso confiable / CLI / Actions con secrets).
3. **No** introduce `supabase-py` como dependencia del paquete de ingestion.

En local, si no hay `SUPABASE_SERVICE_ROLE_KEY` y la URL es `127.0.0.1`/`localhost`, se puede usar el JWT demo del CLI de Supabase (solo stack local; nunca contra remoto).

### Alternativas descartadas

- **Añadir `supabase-py` para Storage.** Descartada: nueva dependencia para una operación HTTP acotada que `httpx` ya cubre; el proyecto prioriza no ampliar el stack sin necesidad medible.
- **Subir RAW desde el frontend con publishable key.** Descartada: el bucket `raw` es privado y la arquitectura prohíbe que el navegador lea/escriba RAW; además exigiría policies peligrosas.
- **Solo metadatos en Postgres sin objeto en Storage.** Descartada: rompe RAW inmutable y la trazabilidad `source → artifact → Storage`.

---

## Consecuencias

### Positivas

- Una dependencia menos; mismo cliente HTTP que el fetch de fuentes.
- Contrato claro: Storage + `service_role` = proceso confiable.
- Tests pueden inyectar `httpx.Client` / mocks sin SDK.

### Negativas / riesgos

- Hay que mantener a mano detalles de la API Storage (POST vs PUT, headers `x-upsert`, etc.) si Supabase cambia el contrato.
- Quien espere el SDK oficial puede sorprenderse; este ADR lo documenta.

---

## Verificación

- `ingestion/src/efilicit_ingestion/pipeline/supabase_storage.py` usa `httpx`, no `supabase`.
- `ingestion/pyproject.toml` no declara `supabase` / `supabase-py`.
- Corridas con Storage requieren `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (o dry-run / `use_storage=False`).

---

## Referencias

- `docs/01-arquitectura-fija.md` — stack (httpx), RAW inmutable, service_role
- `docs/plans/semana02-plan.md` — Paso 4
- `ingestion/src/efilicit_ingestion/pipeline/supabase_storage.py`
- `ingestion/src/efilicit_ingestion/pipeline/raw.py`
- `ingestion/src/efilicit_ingestion/run_placsp.py`
