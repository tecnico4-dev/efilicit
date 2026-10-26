# Runbook — replay de artefacto (`replay-artifact`)

**Estado MVP (Semana 6 / Paso 9):** el pipeline **no** tiene aún un comando dedicado “replay este `storage_path`”. Este runbook documenta el objetivo y el **workaround** actual. Ítem también en [BACKLOG](../plans/BACKLOG.md).

## Objetivo (cuando exista)

1. Elegir un artefacto en `source_artifacts` (`storage_path`, `checksum`, `source_code`).
2. Descargar el RAW desde Supabase Storage (inmutable).
3. Re-parsear y upsert al canónico **sin** volver a llamar a la API/fuente si no hace falta.
4. Nueva fila en `source_sync` con `run_id` nuevo y enlace al artefacto.

## Workaround actual

| Situación | Qué hacer |
|---|---|
| Fixture local | `run-placsp` / `run-catalunya` / `run-euskadi` con `--fixture` |
| Hay que volver a la fuente | [reprocess-source-date.md](reprocess-source-date.md) (live / ventana) |
| RAW ya en Storage pero sin CLI replay | Descargar el objeto a mano → usarlo como `--fixture` **solo en entorno de prueba**; en prod preferir reprocess live documentado hasta tener CLI |

No fabricar un ZIP “parecido” al oficial ni trocear el paquete (rompe checksum / RAW inmutable).

## Listo para promover a “soportado”

Cuando exista p. ej. `cli replay-artifact --artifact-id …` (o equivalente) con tests:

1. Actualizar este runbook quitando el workaround.
2. Quitar o mover el ítem del BACKLOG.
3. Enlazar desde [source-down.md](source-down.md).
