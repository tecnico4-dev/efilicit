/**
 * Nombres de municipio por código INE (`geo_municipio`).
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function listMunicipalityNamesByCodes(
  client: SupabaseClient<Database>,
  codes: readonly string[],
): Promise<Record<string, string>> {
  const unique = [
    ...new Set(codes.map((c) => c.trim()).filter(Boolean)),
  ];
  if (unique.length === 0) return {};

  const { data, error } = await client
    .from("geo_municipio")
    .select("code, name")
    .in("code", unique);

  if (error || !data) return {};

  const out: Record<string, string> = {};
  for (const row of data) {
    if (row.code && row.name) out[row.code] = row.name;
  }
  return out;
}
