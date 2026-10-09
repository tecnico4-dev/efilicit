# Capa de acceso a datos (queries)

Centralizar aquí el acceso a Supabase (no en componentes React).
Los Server Components / Actions importan helpers tipados; la UI no arma SQL.

## Búsqueda (Semana 5 / Paso 3 / ADR 011)

- `searchTenders(client, { query, criteria, limit, offset })` → RPC `public.search_tenders`
- FTS (`search_vector`, config `spanish`) + fallback `pg_trgm` en `title`
  (`similarity` / `%` y `strict_word_similarity` / `<<%` para erratas por palabra)
- Filtros alineados con Criteria v1 (`@efilicit/types`)
- Ranking: `greatest(ts_rank, similarity, strict_word_similarity)` + fecha de publicación
- Badge: `fts` solo si los tokens de la consulta aparecen **literalmente** en el título;
  si el hit es solo por stemming español → `trgm` (UI “errata”)
- Cliente publishable/anon + sesión; nunca `service_role`

Ejemplo (Node / consola con env de la web):

```ts
import { createSupabaseClient } from "@/lib/supabase/client";
import { searchTenders } from "@/lib/queries";

const client = createSupabaseClient();
const { data, error } = await searchTenders(client, {
  query: "mantenimiento software",
  criteria: { version: 1, cpv_codes: ["72000000"] },
  limit: 10,
});
```

Comprobación SQL directa: ver plan Semana 5 / checklist Paso 3.

## Ficha de licitación (Semana 6 / Pasos 3–4)

- `getTenderById(client, id)` → `tenders` + `contracting_authorities` + `tender_sources`
- UI: `/tenders/[id]`; enlace desde resultados de `/search`
- Multi-fuente: lista de orígenes con badge “Canónica” si coincide `canonical_source_code`

## Favoritos (Semana 6 / Paso 5)

- `addOwnFavorite` / `removeOwnFavorite` / `isOwnFavorite` / `listOwnFavorites`
- Tabla `favorites` (RLS owner-only); UI: toggle en ficha (solo sesión) + `/favorites`
- Prueba A≠B: `pnpm --filter @efilicit/web verify:rls:favorites`

## Alertas / búsquedas / perfil (Semana 5 / Paso 6)

- `createOwnAlert` / `updateOwnAlert` / `listOwnAlerts` / `createOwnSavedSearch` / `deleteOwnSavedSearch` / `listOwnSavedSearches`
- `getOwnProfile` / `updateOwnDigestFrequency` (daily|weekly; ADR 013)
- UI: `/alerts` (crear/editar/activar), crear alerta desde `/search` (sesión), `/account`
- Prueba RLS Alice≠Bob: `pnpm --filter @efilicit/web verify:rls`
