# Wipe de datos de aplicación (conservar users + geo)

Vacía el dominio operativo y el estado de producto del usuario (alertas,
favoritos, colas), **sin** tocar cuentas ni catálogos geográficos.

## Conserva

- `auth.users` (Auth de Supabase)
- `public.users` (perfiles)
- `public.geo_ccaa`
- `public.geo_municipio`

## Vacía

Dominio canónico (`tenders`, fuentes, eventos, CPVs, documentos, organismos,
proveedores), sync (`source_sync`, `source_artifacts`, `errors`), alertas /
búsquedas guardadas / favoritos / colas y lecturas de notificación.

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

La salida final es un conteo por tabla: `users` / `geo_*` deben ser > 0;
el resto 0.

## Qué no hace

- No borra el esquema ni migraciones.
- No vacía el bucket Storage `raw` (objetos RAW pueden quedar huérfanos
  respecto a `source_artifacts`; re-ingesta live con upload los recrea).
- No es un cron automático: es un procedimiento manual deliberado.

## Cuándo usarlo

Antes de tratar el remoto como “limpio” tras seeds/fixtures/demos, o tras
pruebas que hayan ensuciado el canónico.
