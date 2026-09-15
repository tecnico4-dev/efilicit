# Semana 3 — Plan: escalado estatal + primeras CCAA

> **Estado:** pendiente de arrancar (plan y checklist listos).  
> **Checklist:** [fase3-checklist.md](fase3-checklist.md)  
> **Precondición:** Semana 2 cerrada ([fase2-checklist.md](fase2-checklist.md)).  
> **Norma:** `docs/00`–`04` y `.cursor/rules/`. Reutilizar contrato `SourceConnector` + pipeline + upsert canónico de Semanas 1–2. ADR solo si hace falta cambiar arquitectura de verdad.

---

## Partimos de

Semana 2 dejó un **vertical slice PLACSP** sólido: `discover` → `fetch` → RAW → parse → normalize/identidad → upsert canónico → CLI → workflow controlado, con tests e idempotencia.

Meta de Semana 3 (`docs/04` § Semana 3): **reutilizar esa maquinaria** para ampliar cobertura estatal (menores / agregadas / sindicaciones compatibles) y añadir las **primeras CCAA** con mejor relación cobertura/esfuerzo — sin inventar un modelo de datos por fuente.

Fuera de esta semana (Semana 4+): cobertura de las 17 CCAA, deduplicación multi-fuente avanzada, FTS/Auth/alertas UI, TED, subvenciones.

---

## Cómo lo hacemos

1. Cumplir tareas y criterios de `docs/04-roadmap-mvp.md` § Semana 3.
2. Cada fuente nueva: ficha en `docs/sources/`, `source_sync`, fixture, tests, config de acceso y workflow/job.
3. Reutilizar adaptadores **solo** con compatibilidad técnica y semántica real (PLACSP Atom/CODICE, familia CSV, API REST/Socrata).
4. Fuente oficial primero; sin scraping si hay feed/API/Open Data adecuado.
5. Mismo modelo canónico y upsert `(source_code, source_tender_id)`; no DDL paralelo por fuente.
6. Priorizar cobertura/esfuerzo; si una CCAA se atasca: documentar bloqueo y pasar a la siguiente (regla de alcance del roadmap).
7. Usar [contratacionabierta.com](https://contratacionabierta.com/) como catálogo de **referencia**, no como verdad única; contrastar siempre con la fuente oficial.
8. Pasos pequeños y verificables; secretos fuera del código; push/merge a `main` solo con OK explícito.
9. ADR solo ante cambio estructural real; si no, checklist en `N/A`.

---

## Pasos

### 1. Inventario y priorización de fuentes

Listar candidatas estatales (sindicaciones PLACSP compatibles, menores, agregadas) y primeras CCAA propias según catálogo de referencia + documentación oficial.  
Registrar en este plan (tabla de decisiones) el orden de ataque y el motivo cobertura/esfuerzo. **No** implementar aún.

**Listo cuando:** lista priorizada acordada (estatal + ≥2 CCAA candidatas) con `source_code` provisional y tipo de adaptador esperado (PLACSP-reuse / CSV / REST-Socrata / propio).

### 2. Documentar la primera fuente estatal ampliada

Crear/actualizar ficha en `docs/sources/` (mismo esquema que `placsp.md`: URL, acceso, formato, frecuencia, incremental, identificadores, límites, cobertura, exclusiones).

**Listo cuando:** documento revisable alineado con el acceso real que usaremos.

### 3. Conector estatal — reutilizar / extender adaptador PLACSP

Si la fuente es Atom/CODICE o sindicación compatible: reutilizar el conector/plataforma PLACSP (configuración, URLs, `source_code`) en lugar de copiar el parser.  
Si no es compatible: documentar por qué y elegir CSV o REST según el Paso 1.

**Listo cuando:** `discover`/`fetch` (o config equivalente) listan artefactos con `artifact_key` estable; tests sin red.

### 4. RAW + parse + normalize + upsert (fuente estatal)

Misma tubería: validate → Storage `raw` → `source_artifacts` → parse → canonical → upsert; `source_sync` actualizado. Fixtures (válido / incompleto / inesperado).

**Listo cuando:** corrida local (fixture o muestra controlada) deja sync success, RAW trazable y filas canónicas; reejecutar no duplica.

### 5. Workflow / job de la fuente estatal

GitHub Actions (o job documentado) manual y controlado; secretos fuera del código; dry-run o modo seguro por defecto.

**Listo cuando:** workflow en repo; ejecución controlada acordada (sin quemar prod/red a ciegas).

### 6. Adaptador CSV genérico (si aplica)

Si en el inventario hay una **familia** de fuentes CSV realmente compatible: implementar un adaptador CSV reutilizable (mapeo declarativo donde ayude).  
Si no hay familia clara: marcar **N/A** en checklist y dejar constancia en decisiones (no forzar un adaptador vacío).

**Listo cuando:** o bien un CSV end-to-end con fixture+tests+ficha, o decisión documentada N/A.

### 7. Adaptador API REST / Socrata (si aplica)

Igual criterio que el Paso 6: solo si corresponde a una fuente priorizada. Timeout/retry/`max_bytes`/checksum según stack aprobado.

**Listo cuando:** o bien API end-to-end con fixture/mock+tests+ficha, o decisión documentada N/A.

### 8. Primera CCAA propia

Documentar + conector completo (contrato común, RAW, tests, sync, workflow) para la CCAA #1 del inventario.

**Listo cuando:** datos reales o fixture representativo poblando canónico; `source_sync` OK; ficha en `docs/sources/`.

### 9. Segunda (y siguientes) CCAA propia

Repetir el patrón del Paso 8 para al menos otra CCAA (criterio de salida: **varias** CCAA propias ingiriendo).  
Si una se bloquea: documentar y sustituir por la siguiente del inventario.

**Listo cuando:** ≥2 CCAA con ficha + tests + sync + corrida verificable.

### 10. Homogeneizar catálogo + regresión + cierre

Actualizar `docs/sources/README.md`. Batería de tests (todas las fuentes nuevas). Marcar [fase3-checklist.md](fase3-checklist.md). CHANGELOG. ADR `N/A` o nuevo ADR si hubo decisión estructural.

**Listo cuando:** criterios de salida de `docs/04` § Semana 3 cumplidos.

**Fuera de alcance:** resto de las 17 CCAA, dedup multi-fuente avanzada (Semana 4), TED, FTS/Auth/alertas UI, subvenciones, infra nueva sin ADR.

---

## Decisiones durante la ejecución

Registro de lo acordado al cerrar (o antes de) cada paso:

| Cuándo | Decisión | Motivo / consecuencia |
|---|---|---|
| Inicio Semana 3 | Ejecutar **paso a paso** con revisión | Igual que Semanas 0–2 |
| Plan | Sin ADRs previos; ADR solo si hay cambio estructural | Respetar arquitectura ya fijada |
| Plan | No fijar aún CCAA/`source_code` concretos en el plan | Se eligen en Paso 1 con evidencia oficial + cobertura/esfuerzo |

---

## Referencias

- [docs/04-roadmap-mvp.md](../04-roadmap-mvp.md) § Semana 3 (y §1 corte MVP: estatales + CCAA)  
- [docs/01-arquitectura-fija.md](../01-arquitectura-fija.md) §§ 5–8  
- [docs/00-onboarding.md](../00-onboarding.md) (fuentes, RAW, `source_sync`)  
- [docs/sources/placsp.md](../sources/placsp.md) · [docs/sources/README.md](../sources/README.md)  
- [fase3-checklist.md](fase3-checklist.md) · [fase2-checklist.md](fase2-checklist.md) · [semana02-plan.md](semana02-plan.md)
