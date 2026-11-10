# 027 - Endurecimiento oferta: `is_app_user` y cadena de migraciones

**Fecha:** 2026-11-10

**Estado:** Aceptado (bloque A)

**Extiende:** [026](026-mis-licitaciones-offer-cases.md)

**Reemplazado por:** Ninguno

---

## Contexto

El rollback remoto `20261030130100` dropea `is_app_user()` junto con `bid_*`. En un `db reset` limpio, migraciones posteriores (`20261103120000` ALTER `bid_cases`, `20261106120000` RLS `offer_*` + backfill) fallaban o dependían de `migration repair` local.

## Decisión

1. Recrear `is_app_user()` al inicio de `20261106120000` (antes del RLS `offer_*`) y de nuevo en `20261110150000` (idempotente para entornos ya migrados).
2. Guardar `20261103120000` y el backfill de `20261106120000`: no-op si no existen tablas `bid_*`.
3. No reescribir el DROP del rollback remoto; no aplicar esta cadena a Supabase remoto sin OK explícito.

## Alternativas

- Reescribir `20261030130100` para no dropear `is_app_user` — cambia historia ya aplicada en remoto.
- Solo documentación + repair manual — frágil para CI / otro desarrollador.

## Consecuencias

- `supabase db reset` local debe poder llegar a `offer_*` sin apaños.
- Bloques B+ (integridad FKs, bitácora, etc.) irán en ADRs/migraciones siguientes.

## Referencias

- [023](023-mis-licitaciones-pipeline-compartido.md), [026](026-mis-licitaciones-offer-cases.md)
