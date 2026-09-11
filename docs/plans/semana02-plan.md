# Semana 2 — Plan: PLACSP vertical slice

> **Estado:** en curso (Paso 1 documentado).  
> **Checklist:** [fase2-checklist.md](fase2-checklist.md)  
> **Precondición:** Semana 1 cerrada ([fase1-checklist.md](fase1-checklist.md)).  
> **Norma:** `docs/00`–`04` y `.cursor/rules/`. Reutilizar contrato `SourceConnector` + pipeline de Semana 1. ADR solo si hace falta cambiar arquitectura de verdad.

---

## Partimos de

Semana 1 dejó listo: esquema canónico, `source_sync` / `source_artifacts`, contrato `discover`/`fetch`/`parse`, pipeline común y tests/CI.  
Falta el **primer conector real (PLACSP)** de punta a punta: descarga → RAW → parseo → canónico → trazabilidad → idempotencia.

Hito crítico del roadmap: si este slice no es sólido, **no** multiplicar fuentes.

---

## Cómo lo hacemos

1. Cumplir las tareas y criterios de `docs/04-roadmap-mvp.md` § Semana 2.
2. Respetar el contrato y el pipeline ya fijados en `docs/01` (no inventar otra tubería).
3. Solo campos necesarios para el modelo canónico / MVP; no modelar todo CODICE de golpe.
4. Stack aprobado: `httpx`, `lxml`, `tenacity`, `pydantic`, `psycopg`, Storage `raw` existente.
5. Fuente oficial primero; sin scraping si hay feed/API/Open Data adecuado.
6. Fixtures + tests de parser/normalización/persistencia; probar reejecución.
7. Documentar la fuente en `docs/sources/` (catálogo del proyecto).
8. Pasos pequeños y verificables; push a remoto / secretos de CI solo con OK explícito.
9. ADR solo ante cambio estructural real; si no, checklist en `N/A`.

---

## Pasos

### 1. Documentar PLACSP en el catálogo de fuentes

Crear `docs/sources/placsp.md` con lo que pide el onboarding (URL, acceso, formato, frecuencia, incremental, identificadores, límites, cobertura).

**Listo cuando:** documento revisable y alineado con el acceso real que usaremos.

### 2. Conector PLACSP — `discover`

Implementar descubrimiento de artefactos remotos (feed/paquetes oficiales) vía `SourceConnector.discover`.

**Listo cuando:** tests (fixture/mock de red o respuesta controlada) listan artefactos con `artifact_key` estable.

### 3. Conector PLACSP — `fetch`

Descarga con timeout, retry (`tenacity`), control de tamaño y checksum del payload.

**Listo cuando:** tests cubren éxito y fallos controlados (timeout/tamaño); checksum determinista.

### 4. Validar + guardar RAW en Storage

Usar `validate_artifact` + `store_raw` escribiendo en el bucket `raw` (inmutable) y registrando `source_artifacts`.

**Listo cuando:** un fetch de prueba deja objeto en Storage local + fila en `source_artifacts` con checksum y `storage_path`.

### 5. Parseo XML (`lxml`) + fixtures

`parse` produce `SourceRecord`s. Fixtures reales/anonimizadas. Streaming solo si el tamaño lo exige.

**Listo cuando:** tests de parser (caso válido, incompleto e inesperado) en verde.

### 6. Normalizar + identidad de organismos

Mapear a campos canónicos: fechas, importes, estados, CPV, geografía, organismos.  
Identidad: NIF/CIF cuando exista; si no, señales alternativas + `identity_confidence` (regla ya fijada).

**Listo cuando:** tests de normalización/identidad sobre fixtures.

### 7. Upsert canónico + trazabilidad

Persistir en `tenders`, `tender_sources` (unique `source_code` + `source_tender_id`), `tender_events`, `documents`; actualizar `source_sync`.  
Ampliar columnas del esquema **solo si** hace falta para el MVP, vía migración versionada.

**Listo cuando:** una corrida con fixture/datos reales locales puebla canónico; reejecutar no duplica.

### 8. Pipeline extremo a extremo + CLI

Cablear PLACSP en `run_pipeline` (o entrada CLI) de punta a punta en local.

**Listo cuando:** una ejecución documentada deja sync success, RAW trazable y filas en `tenders`.

### 9. Workflow `ingest-placsp.yml`

Job de GitHub Actions (manual y/o cron según lo razonable al empezar) que lance la ingesta con secretos fuera del código.

**Listo cuando:** workflow en repo; dry-run o ejecución controlada acordada (sin quemar producción a ciegas).

### 10. Regresión + reejecución + cierre

Batería de tests (parser, normalización, persistencia, idempotencia). Marcar [fase2-checklist.md](fase2-checklist.md).

**Listo cuando:** criterios de salida de `docs/04` § Semana 2 cumplidos; CHANGELOG al día; ADR `N/A` si no hubo decisión estructural.

**Fuera de alcance:** otras CCAA, TED, dedup multi-fuente avanzada (Semana 4), FTS/Auth/alertas UI, subvenciones.

---

## Decisiones durante la ejecución

Registro de lo acordado al cerrar (o antes de) cada paso:

| Cuándo | Decisión | Motivo / consecuencia |
|---|---|---|
| Inicio Semana 2 | Ejecutar **paso a paso** con revisión | Igual que Semanas 0–1 |
| Plan | Sin ADRs previos; ADR solo si hay cambio estructural | Respetar arquitectura ya fijada |
| Paso 1 | Dataset Semana 2 = sindicación `643` (licitaciones perfiles PLACSP, **sin** menores) | Open Data oficial Atom/CODICE; sin scraping; menores/agregación CCAA quedan fuera de este `source_code` |
| Paso 1 | Acceso = descarga HTTP de ZIP/`.atom` en URI conocidas de `sindicacion_643` | Cumple “fuente oficial primero”; B2B no es el canal de reutilización abierta |
| Paso 1 | Documentar en `docs/sources/placsp.md`; `source_tender_id` exacto se cierra en parse/upsert | Ficha completa ahora; identidad de expediente requiere ver fixtures reales |

---

## Referencias

- [docs/04-roadmap-mvp.md](../04-roadmap-mvp.md) § Semana 2  
- [docs/01-arquitectura-fija.md](../01-arquitectura-fija.md) §§ 5–8  
- [docs/00-onboarding.md](../00-onboarding.md) (RAW, fuentes, `source_sync`)  
- [fase2-checklist.md](fase2-checklist.md) · [semana01-plan.md](semana01-plan.md)
