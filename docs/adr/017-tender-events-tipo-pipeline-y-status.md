# 017 - `tender_events`: hecho de pipeline vs estado de negocio

**Fecha:** 14-10-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

`public.tender_events` es la línea temporal canónica de una licitación (lectura pública; escritura solo ETL, ADR 003). Al principio un solo campo `event_type` mezclaba dos ideas distintas:

- el **hecho de ingesta** (primera vez vs cambio posterior);
- el **estado de negocio** del expediente (`publicada`, `adjudicada`, …).

Eso dificultaba historiales útiles (p. ej. favoritos / ficha): un `updated` no decía en qué estado quedó, y un `published` no dejaba claro si era alta o transición.

Además, emitir un evento en **cada** re-ingesta (aunque no cambie el contenido) generaría ruido y volumen alto; la señal “la fuente la ha vuelto a ver” ya existe en `tender_sources.last_seen_at`.

---

## Decisión

1. **Dos columnas separadas**
   - `event_type` — hecho de pipeline, vocabulario cerrado: `ingerida` | `actualizada`.
   - `event_status` — snapshot del estado de negocio **en ese momento** (mismo vocabulario ES que `tenders.status`: `publicada`, `preparada`, `adjudicada`, `resuelta`, `anulada`, `desierta`, `evaluacion`, …).

2. **Cuándo se escribe una fila**
   - `ingerida`: primera vez que esa fuente crea/enlaza el tender (alta del enlace canónico relevante).
   - `actualizada`: re-ingesta de una fuente que **puede escribir** la canónica **y** hay cambio real de campos de negocio (mismo criterio de diff que ya usa el upsert), o promoción de dueña.
   - Re-ingesta **sin** cambio de contenido: **no** hay `tender_events` nuevo; solo se actualiza `tender_sources.last_seen_at`.

3. **Estado actual vs historial**
   - `tenders.status` = estado vigente de la fila canónica.
   - `tender_events` = hitos; no sustituye a `tenders.status`. Tras una `actualizada`, el status vivo sigue en `tenders` y el del momento queda en `event_status`.

4. **Fuera de este ADR (BACKLOG)**  
   Timeline rica de versiones intermedias dentro del mismo ZIP/Atom PLACSP; hoy solo prevalece la versión más reciente en parse.

Migraciones: `20261014140000_tender_events_type_and_status.sql`, vocabulario ES en `20261014150000_vocabulario_es_canonic.sql`.

### Alternativas descartadas

- **Seguir con un solo `event_type` polimórfico.** Confunde pipeline y negocio; complica UI de historial.
- **Una fila por cada re-ingesta sin cambios.** Ruido para favoritos; duplica lo que ya cubre `last_seen_at`.
- **Guardar solo el status sin tipificar ingerida/actualizada.** Pierde si el hito fue alta o cambio.

---

## Consecuencias

- Contrato claro para ficha / favoritos / notificaciones futuras sobre “qué cambió”.
- ETL y tests deben escribir siempre el par (`event_type`, `event_status`).
- Filas legacy se remapean best-effort (status EN antiguos → `event_status`; `updated`/`ingested` → `actualizada`/`ingerida`).

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| UI asume evento en cada touch de fuente | Documentar; usar `last_seen_at` para “visto de nuevo” |
| `event_status` null en filas viejas `updated` | Aceptable; nuevas escrituras siempre rellenan status si la fuente lo trae |
| Ampliar `event_type` con más literales | Solo con migración + este ADR reemplazado o enmendado en PR |

---

## Referencias

- `ingestion/src/efilicit_ingestion/pipeline/canonical_repo.py` (`EVENT_TYPE_*`, `_insert_event`)
- [ADR 003](003-acceso-canonico-publico-etl-privado.md) — lectura pública / escritura ETL
- [ADR 015](015-fuente-ganadora-canonica.md) — quién puede actualizar `tenders`
- [docs/plans/BACKLOG.md](../plans/BACKLOG.md) — timeline PLACSP / re-ingesta
