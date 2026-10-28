# 021 - RAW Storage: TUS resumable vía `httpx` (ZIP intacto)

**Fecha:** 2026-10-28

**Estado:** Aceptado

**Reemplaza:** Ninguno (complementa [006](006-raw-storage-httpx-sin-supabase-py.md))

**Reemplazado por:** Ninguno

---

## Contexto

Los ZIPs mensuales PLACSP pueden ser muy grandes. La subida simple POST/PUT a Supabase Storage con timeout corto fallaba o se cortaba en red inestable. El backlog pedía endurecer timeouts/reintentos/multipart **sin** trocear el ZIP oficial (evidencia RAW inmutable).

[006](006-raw-storage-httpx-sin-supabase-py.md) fija `httpx` + `service_role` sin `supabase-py`. Supabase documenta uploads resumables con protocolo **TUS** (chunks de 6 MiB).

## Decisión

1. Descarga PLACSP: timeout por defecto **600 s**, tope **512 MiB**, 4 reintentos de transporte/timeout.
2. Storage (`SupabaseStorageArtifactStore`):
   - timeout upload **600 s**; reintentos en transporte/timeout/5xx;
   - si `len(raw) ≥ umbral` (default **6 MiB**): create + PATCH TUS a `/storage/v1/upload/resumable` con `httpx` (sin `tus-py-client` / sin SDK);
   - si menor: POST/PUT simple (como 006) + mismos reintentos;
   - resultado: **un** objeto en bucket `raw` = bytes del ZIP completo; checksum SHA-256 del artefacto entero.
3. Preferir hostname `*.storage.supabase.co` cuando `SUPABASE_URL` es `*.supabase.co` (recomendación Supabase).

### Alternativas descartadas

- **Trocear el ZIP oficial en varios objetos.** Descartada: rompe RAW inmutable y replay.
- **Añadir `tus-py-client` o `supabase-py`.** Descartada: dependencia nueva; TUS cabe en `httpx` (sigue 006).
- **S3 multipart API.** Aplazada: más credenciales/contrato; TUS cubre el caso batch ETL.

## Consecuencias

### Positivas

- ZIPs grandes pueden subir por trozos de red y reintentar un PATCH sin reiniciar todo.
- Misma API de `store()` para PLACSP ×3, Catalunya y Euskadi (solo cambia el tamaño del payload).

### Negativas / riesgos

- Hay que mantener el contrato TUS de Supabase (chunk 6 MiB fijo).
- Umbral inyectable en tests; en prod el default es 6 MiB.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| TUS create/PATCH 4xx | Error tipado; no reintentar a ciegas |
| Offset incompleto | Comprobar offset final == `len(raw)` |
| Localhost sin TUS | Payloads de fixture &lt; 6 MiB usan ruta simple |

## Verificación

- `supabase_storage.py`: umbral + TUS + simple + retries.
- Tests mock en `test_raw_storage.py` (TUS con umbral bajo; retry 503→200).
- PLACSP `fetch.py`: defaults 600 s / 512 MiB / 4 intentos.

## Referencias

- [006](006-raw-storage-httpx-sin-supabase-py.md)
- [Supabase Resumable Uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- `ingestion/src/efilicit_ingestion/pipeline/supabase_storage.py`
- `ingestion/src/efilicit_ingestion/connectors/placsp/fetch.py`
- `docs/plans/BACKLOG.md` — ZIPs grandes
