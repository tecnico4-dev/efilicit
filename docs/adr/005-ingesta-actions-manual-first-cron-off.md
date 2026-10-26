# 005 - Ingesta en GitHub Actions: manual-first (cron desactivado)

**Fecha:** 11-09-2026

**Estado:** Aceptado (cron **activado** en Semana 6 Paso 10; ver enmienda abajo)

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno (la decisión manual-first inicial se mantiene; el schedule es el OK explícito previsto)

---

## Contexto

La arquitectura fija declara GitHub Actions como orquestador ETL con **batch scheduling (cron)**. En Semana 2 nace el primer workflow real de ingesta (`ingest-placsp.yml`): descarga oficial PLACSP, posible escritura a Postgres/Storage y uso de secretos.

Activar un cron desde el día 1 habría significado:

- llamadas periódicas a la red PLACSP (ZIPs grandes);
- riesgo de escribir en un destino mal configurado;
- dependencia de secrets en el entorno de Actions antes de tener un OK explícito de producción/staging.

El objetivo del vertical slice era **demostrar** la tubería de punta a punta de forma controlada, no automatizar ya el ritmo diario.

---

## Decisión

Los workflows de ingesta (empezando por PLACSP; el mismo patrón se aplica después a otras fuentes y al digest de alertas) arrancan así:

1. Disparo **`workflow_dispatch`** (manual) con modos explícitos (`dry-run` / `fixture-db` / `live`, según el job).
2. Modo por defecto **seguro** (`dry-run` / fixture in-memory; sin writes ni secretos obligatorios).
3. Bloque **`schedule` / cron comentado** en el YAML hasta que haya entorno + secrets acordados y un **OK explícito** para activarlo.

Cuando se active el cron, será un cambio deliberado (descomentar/ajustar horario), no el estado inicial del job.

### Alternativas descartadas

- **Cron activo desde Semana 2.** Descartada: quemar red PLACSP y posible escritura remota sin control operativo maduro.
- **Solo scripts locales, sin workflow en el repo.** Descartada: el roadmap pide `ingest-placsp.yml` y deja el job listo para cron futuro; el workflow documenta el contrato de ejecución.
- **Cron en dry-run automático cada noche.** Descartada: aporta poco frente a CI unitario y sigue consumiendo runners sin necesidad.

---

## Consecuencias

### Positivas

- La tubería queda cableada en Actions sin riesgo de “fuego amigo” en prod/red.
- El equipo controla cuándo se pasa a programación real.
- Patrón homogéneo para siguientes fuentes y alertas.

### Negativas / riesgos

- Mientras el cron siga off, la cobertura “programada” del MVP depende de disparos manuales o de trabajo local.
- Olvidar reactivar el cron cuando el entorno esté listo. Mitigación: este ADR + comentarios en los YAML + checklists de cierre.

---

## Enmienda — Semana 6 Paso 10 (2026-10-26)

OK explícito de producto: se **descomentan / activan** los `schedule` en:

| Workflow | Cron (UTC) | Modo en schedule |
|---|---|---|
| `ingest-placsp.yml` | `0 5 * * 1` (lun) | `live` × 3 sindicaciones; mes UTC actual; Storage on |
| `ingest-catalunya.yml` | `0 6 * * 1` (lun) | `live`, `max_pages=10`, Storage on |
| `ingest-euskadi.yml` | `0 7 * * 1` (lun) | `live`, `max_pages=10`, Storage on |
| `alerts-digest.yml` | `0 8 * * *` (diario) | `write-resend`, `since_days=1` |

`workflow_dispatch` sigue disponible; default manual = dry-run. Sin secrets, el cron falla en el guard (no escribe a ciegas).

## Verificación

- En `.github/workflows/ingest-placsp.yml` (y análogos): `workflow_dispatch` presente; `schedule` comentado o ausente a propósito.
- Default de modo = dry-run / equivalente seguro.
- Documentación operativa en `.github/README.md` y planes de semana.

---

## Referencias

- `docs/01-arquitectura-fija.md` — CI/CD + orquestación ETL (cron)
- `docs/04-roadmap-mvp.md` § Semana 2
- `docs/plans/semana02-plan.md` — Paso 9
- `.github/workflows/ingest-placsp.yml`
- `.github/README.md`
