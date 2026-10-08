/**
 * Lectura de una licitación canónica por id (Semana 6 / Paso 3).
 * Cliente publishable/anon + RLS de lectura pública; nunca service_role.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type TenderRow = Database["public"]["Tables"]["tenders"]["Row"];

export type TenderDetail = TenderRow & {
  contracting_authority: {
    id: string;
    name: string;
    tax_id: string | null;
    municipality: string | null;
    country: string;
  } | null;
};

type TenderWithAuthority = TenderRow & {
  contracting_authorities: TenderDetail["contracting_authority"] | null;
};

/**
 * Obtiene una fila de `tenders` (+ organismo si existe).
 * `null` en data = no encontrada o no visible.
 */
export async function getTenderById(
  client: SupabaseClient<Database>,
  id: string,
): Promise<{ data: TenderDetail | null; error: Error | null }> {
  const { data, error } = await client
    .from("tenders")
    .select(
      `
      *,
      contracting_authorities (
        id,
        name,
        tax_id,
        municipality,
        country
      )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  if (!data) {
    return { data: null, error: null };
  }

  const row = data as TenderWithAuthority;
  const { contracting_authorities, ...tender } = row;

  return {
    data: {
      ...tender,
      contracting_authority: contracting_authorities ?? null,
    },
    error: null,
  };
}
