# Queries / data access layer

Centralizar aquí el acceso a datos de Supabase (no en componentes React).

## Búsqueda (Semana 5 / Paso 3)

- `searchTenders(client, { query, criteria, limit, offset })` → RPC `public.search_tenders`
- FTS (`search_vector`, config `spanish`) + fallback `pg_trgm` en `title`
  (`similarity` / `%` y `strict_word_similarity` / `<<%` para erratas por palabra)
- Filtros alineados con Criteria v1 (`@efilicit/types`)
- Ranking: `greatest(ts_rank, similarity, strict_word_similarity)` + fecha de publicación
- Badge: `fts` solo si los tokens de la consulta aparecen **literalmente** en el título;
  si el hit es solo por stemming español → `trgm` (UI “errata”)

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

## Alertas / búsquedas (Semana 5 / Paso 6)

- `createOwnAlert` / `listOwnAlerts` / `createOwnSavedSearch` / `listOwnSavedSearches`
- UI: `/alerts` (requiere login)
- Prueba RLS Alice≠Bob: `pnpm --filter @efilicit/web verify:rls`

