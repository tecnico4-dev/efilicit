# 002 - Bootstrap Supabase remoto greenfield (`db push`, no `db pull`)

**Fecha:** 09-09-2026

**Estado:** Aceptado

**Reemplaza:** Ninguno

**Reemplazado por:** Ninguno

---

## Contexto

El setup (`docs/02-setup-entorno.md`) describe el flujo habitual: vincular el CLI a un proyecto Supabase **ya existente**, capturar su esquema con `supabase db pull`, alinear majors de PostgreSQL y trabajar luego con migraciones locales.

En Fase 0 (Paso 7) el proyecto remoto EfiLicit (`luvxqyajujlznocflymo`) estaba **vacío**: sin esquema de producto ni historial de migraciones previo que capturar. Un `db pull` no aportaba un baseline útil de dominio; lo que sí hacía falta era dejar local y remoto **alineados** con la primera migración real del repo (Storage `raw` + prueba RLS), sin tocar producción a mano ni usar `db reset --linked`.

---

## Decisión

Tratar el remoto como **greenfield**:

1. Escribir la migración Fase 0 en el repo (`supabase/migrations/20260909090000_fase0_storage_raw_and_rls_smoke.sql`).
2. Validarla en local (`supabase db reset` solo local).
3. Alinear historial remoto con **`supabase db push`** controlado (no pull de un esquema productivo ajeno).
4. Fijar major PostgreSQL **17** en local = remoto.

A partir de ahí el ciclo normal es el de siempre: cambios solo por migraciones versionadas; trabajo diario en local; despliegue remoto controlado.

### Alternativas descartadas

- **Insistir en `db pull` como primer paso.** Descartada: el remoto no tenía esquema de producto que capturar; el pull no sustituye escribir la migración Fase 0.
- **Crear tablas a mano en el SQL Editor remoto y luego pull.** Descartada: rompe migration-first y deja el remoto como fuente opaca.
- **`db reset --linked` u otra vía destructiva sobre el remoto.** Descartada: prohibida en setup; el remoto no debe usarse como sandbox destructivo.
- **Dejar el remoto sin migraciones y solo desarrollar en local.** Descartada: el checklist de Fase 0 exige remoto vinculado y historial alineado.

---

## Consecuencias

### Positivas

- Local y remoto comparten el mismo primer eslabón de historial (`20260909090000…`).
- El repo es la fuente de verdad del esquema desde el día 1 (migration-first).
- Encaja con un proyecto Supabase nuevo, no con un legado previo.

### Negativas

- Quien lea solo `docs/02` puede esperar un `db pull` inicial; este ADR aclara el caso greenfield.
- El remoto arranca con el mínimo de Fase 0 (Storage + smoke), no con el modelo canónico (eso es Semana 1+).

### Riesgos

- Deriva si alguien altera el remoto desde el panel sin migración. Mitigación: regla del proyecto (cambios de esquema = migraciones) y revisión de `migration list`.
- Confundir este bootstrap con el flujo de “capturar un remoto ya poblado”. Mitigación: este ADR + notas en el plan de Semana 0.

---

## Verificación

- `supabase migration list` (local vs remoto) muestra la migración Fase 0 aplicada en ambos.
- `db.major_version` local alineada con el remoto (17).
- No se usó `db reset --linked` en el proceso de setup.

---

## Referencias

- `docs/02-setup-entorno.md` §7 (vínculo remoto / pull / push)
- `docs/plans/semana00-plan.md` — Paso 7
- `supabase/migrations/20260909090000_fase0_storage_raw_and_rls_smoke.sql`
- `supabase/README.md`
