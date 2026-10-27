/**
 * Municipios de una CCAA con ≥1 licitación (RPC list_place_municipalities).
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PlaceMunicipalityOption = {
  code: string;
  name: string;
};

export async function listPlaceMunicipalities(
  client: SupabaseClient<Database>,
  ccaaCode: string,
): Promise<{ data: PlaceMunicipalityOption[]; error: Error | null }> {
  const code = ccaaCode.trim();
  if (!code) {
    return { data: [], error: null };
  }

  const { data, error } = await client.rpc("list_place_municipalities", {
    p_ccaa_code: code,
  });

  if (error) {
    return { data: [], error: new Error(error.message) };
  }

  return {
    data: (data ?? []).map((row) => ({
      code: row.code,
      name: row.name,
    })),
    error: null,
  };
}
