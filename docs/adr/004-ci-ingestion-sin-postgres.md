# 004 - CI de ingestion sin Postgres local (tests de DB en skip)

**Fecha:** 10-09-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

Semana 1 añade `pytest` al job de ingestion en GitHub Actions (además del smoke `--help`). Parte de la suite habla de verdad con Postgres (`source_sync` / `source_artifacts` vía `psycopg`). Eso exige Supabase local (o un Postgres equivalente) en marcha.

En Actions **no** se levantaba el stack de Supabase: el job es ligero, sin secretos de DB y sin servicio Postgres en el workflow. Si esos tests fallaran por “no hay base”, el CI se pondría rojo sin aportar señal útil.

---

## Decisión

Ejecutar `uv run pytest` en CI **siempre**, con esta regla:

- tests **sin red / sin DB** (contrato `SourceConnector`, pipeline in-memory) → **obligatorios** en Actions;
- tests de **integración Postgres** → `skip` automático si no hay DB alcanzable (`EFILICIT_DATABASE_URL` / Postgres local de Supabase).

La verificación completa de persistencia sync/artifacts se hace en **local** con `supabase start`.

### Alternativas descartadas

- **Levantar Supabase (o Postgres + migraciones) en cada CI.** Descartada en Semana 1: más tiempo de job, más complejidad y secretos/servicio sin necesidad medible aún; el valor principal del CI era no romper el contrato y el runner in-memory.
- **No ejecutar pytest en CI hasta tener DB en Actions.** Descartada: se perdería la red de seguridad de la mayoría de tests unitarios.
- **Marcar los tests de DB como obligatorios y fallar si no hay Postgres.** Descartada: rompería Actions de forma sistemática con el workflow actual.

---

## Consecuencias

### Positivas

- CI verde y útil sin infraestructura de DB en el runner.
- Se detectan regresiones de contrato/pipeline en cada push/PR.

### Negativas / riesgos

- Un fallo **solo** en la capa Postgres puede pasar desapercibido en Actions hasta que alguien corra tests en local.
- Hay que recordar, en el checklist / runbooks, que `supabase start` + pytest local cubre lo que CI salta.

Si más adelante hace falta cobertura de integración en CI, se puede añadir un job con Postgres/Supabase (nuevo ADR o extensión de este).

---

## Verificación

- Job ingestion en `.github/workflows/ci.yml`: `uv sync --extra dev` + `pytest`.
- Tests de integración con `pytest.mark.skipif` cuando la DB no responde (p. ej. `test_pipeline_postgres.py`).
- En un run típico de Actions: tests unitarios en verde; integración reportada como *skipped*.

---

## Referencias

- `docs/plans/semana01-plan.md` — Paso 8
- `docs/plans/fase1-checklist.md`
- `.github/workflows/ci.yml`
- `ingestion/tests/test_pipeline_postgres.py`
