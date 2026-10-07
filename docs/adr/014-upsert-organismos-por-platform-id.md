# 014 - Upsert de organismos por `platform_id` cuando no hay NIF/CIF

**Fecha:** 06-10-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

La identidad canónica de organismos prioriza NIF/CIF (`tax_id`) como señal primaria (`docs/01-arquitectura-fija.md` §6.2). El upsert en `contracting_authorities` solo hacía `ON CONFLICT` por `(tax_id_country, tax_id)`.

Fuentes como Catalunya SODA **no aportan NIF** en la fila típica: el parser deja `tax_id = null` y usa `codi_dir3` / `codi_organ` como `platform_id` (confianza MEDIUM). En ese caso cada upsert hacía un `INSERT` ciego:

- varias licitaciones del mismo organismo → varias filas de autoridad;
- re-ingesta de la misma licitación → nueva fila y la anterior quedaba huérfana.

Las licitaciones seguían siendo idempotentes por `(source_code, source_tender_id)`; el problema era solo la tabla de organismos.

El hueco ya estaba en `docs/plans/BACKLOG.md` sin implementación.

---

## Decisión

1. Añadir columna `platform_id text null` en `public.contracting_authorities`.
2. Índice único parcial:
   `(tax_id_country, platform_id) WHERE platform_id IS NOT NULL AND tax_id IS NULL`.
3. Upsert ETL:
   - con `tax_id` → conflicto por NIF/CIF (como hasta ahora); opcionalmente rellenar `platform_id`;
   - sin `tax_id` y con `platform_id` → conflicto por plataforma/DIR3;
   - sin ambas señales → `INSERT` (LOW/UNRESOLVED; sin clave estable).

Migración: `supabase/migrations/20261006100000_contracting_authorities_platform_id.sql`.

### Alternativas descartadas

- **Fusionar por nombre normalizado.** Descartada: contradice la regla de no usar el nombre como identidad única.
- **Unique global de `platform_id` también con filas que ya tienen NIF.** Descartada por ahora: evita choques si el mismo DIR3 aparece después con NIF en otra fila antes de una fusión de entidades; la fusión cross-fuente de organismos queda fuera de este ADR.
- **Tabla auxiliar de aliases de organismo.** Descartada: sobrediseño para el bug de huérfanos en re-ingesta.

---

## Consecuencias

### Positivas

- Re-ingestas Catalunya (y similares) no acumulan autoridades huérfanas.
- Varias licitaciones del mismo DIR3 comparten un organismo.
- NIF/CIF sigue siendo la clave primaria de identidad cuando existe.

### Negativas / riesgos

- Un organismo visto solo por DIR3 y el mismo visto solo por NIF pueden seguir siendo **dos filas** hasta una resolución de entidades futura.
- Organismos sin NIF ni `platform_id` siguen pudiendo duplicarse (caso LOW).

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| DIR3 mal mapeado / colisión de códigos | Fixtures + tests; ficha de fuente documenta el campo |
| Datos locales ya huérfanos | No se borran automáticamente; nuevas ingestas dejan de empeorar |

---

## Referencias

- `docs/01-arquitectura-fija.md` §6.2 (identidad canónica)
- `docs/sources/catalunya.md`
- `ingestion/src/efilicit_ingestion/pipeline/canonical_repo.py`
- Backlog previo: identidad sin NIF / DIR3 (resuelto por este ADR)
