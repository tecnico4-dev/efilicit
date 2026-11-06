/**
 * Municipios de una CCAA con ≥1 licitación (RPC list_place_municipalities).
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PlaceMunicipalityOption = {
  code: string;
  name: string;
  /** CCAA de la que se obtuvo el municipio (`geo_ccaa.code`). */
  ccaaCode: string;
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
      ccaaCode: code,
    })),
    error: null,
  };
}

/** Unión de municipios de varias CCAA (por código; orden alfabético por nombre). */
export async function listPlaceMunicipalitiesForCcaas(
  client: SupabaseClient<Database>,
  ccaaCodes: string[],
): Promise<{ data: PlaceMunicipalityOption[]; error: Error | null }> {
  const codes = [...new Set(ccaaCodes.map((c) => c.trim()).filter(Boolean))];
  if (codes.length === 0) {
    return { data: [], error: null };
  }

  const results = await Promise.all(
    codes.map((code) => listPlaceMunicipalities(client, code)),
  );
  const firstError = results.find((r) => r.error)?.error ?? null;
  const byCode = new Map<string, PlaceMunicipalityOption>();
  for (const res of results) {
    for (const row of res.data) {
      if (!byCode.has(row.code)) byCode.set(row.code, row);
    }
  }
  const data = [...byCode.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "es"),
  );
  return { data, error: firstError };
}
