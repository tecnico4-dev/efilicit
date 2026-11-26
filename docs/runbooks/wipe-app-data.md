# Wipe de datos de aplicación (conservar users + geo + Mis licitaciones)

Vacía el dominio operativo y el estado de producto del usuario (alertas,
favoritos, colas), **sin** tocar cuentas, catálogos geográficos ni expedientes
de oferta.

## Conserva

- `auth.users` (Auth de Supabase)
- `public.users` (perfiles)
- `public.geo_ccaa`
- `public.geo_municipio`
- `public.offer_*` / `public.company_*` (Mis licitaciones)
- `public.tenders` (y deps canónicas: fuentes, eventos, CPVs, documents,
  organismos vinculados) **referenciados por** `offer_cases`  
  → [ADR 028](../adr/028-offer-schema-block-b-integrity.md): `ON DELETE RESTRICT`;
  el wipe **salta** esas licitaciones (no desvincula ni borra el expediente).

## Vacía

Resto del dominio canónico (licitaciones **sin** expediente de oferta), sync
(`source_sync`, `source_artifacts`, `errors`), alertas / búsquedas guardadas /
favoritos / colas y lecturas de notificación.

Script canónico: [`scripts/wipe_app_data.sql`](../../scripts/wipe_app_data.sql).

## Cómo ejecutarlo (remoto)

Proyecto linkado:

```bash
npx supabase db query --linked -f scripts/wipe_app_data.sql
```

O con URI de Postgres (secret `EFILICIT_DATABASE_URL`):

```bash
npx supabase db query --db-url "$EFILICIT_DATABASE_URL" -f scripts/wipe_app_data.sql
```

La salida final es un conteo por tabla: `users` / `geo_*` / `offer_cases` (si
había expedientes) deben ser > 0 cuando corresponda; alertas/favoritos/colas → 0.
`tenders` puede ser > 0 si hay expedientes protegidos.

## Qué no hace

- No borra el esquema ni migraciones.
- No vacía el bucket Storage `raw` (objetos RAW pueden quedar huérfanos
  respecto a `source_artifacts`; re-ingesta live con upload los recrea).
- No es un cron automático: es un procedimiento manual deliberado.
- No elimina expedientes de Mis licitaciones ni sus licitaciones canónicas.

## Cuándo usarlo

Antes de tratar el remoto como “limpio” tras seeds/fixtures/demos, o tras
pruebas que hayan ensuciado el canónico — **respetando** el trabajo de oferta.
