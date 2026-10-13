/**
 * Opciones de filtros de búsqueda (listas para selects).
 * Lectura pública canónica vía RLS; nunca service_role.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthorityOption = {
  id: string;
  label: string;
};

function authorityLabel(row: {
  name: string;
  municipality: string | null;
  tax_id: string | null;
}): string {
  const bits = [row.name.trim()];
  if (row.municipality?.trim()) bits.push(row.municipality.trim());
  let label = bits.join(" · ");
  if (row.tax_id?.trim()) label += ` (${row.tax_id.trim()})`;
  return label;
}

/** Órganos contratantes ordenados alfabéticamente (etiqueta legible). */
export async function listAuthorityOptions(
  client: SupabaseClient<Database>,
): Promise<{ data: AuthorityOption[]; error: Error | null }> {
  const { data, error } = await client
    .from("contracting_authorities")
    .select("id, name, municipality, tax_id")
    .order("name", { ascending: true });

  if (error) return { data: [], error: new Error(error.message) };

  const options = (data ?? []).map((row) => ({
    id: row.id,
    label: authorityLabel(row),
  }));

  options.sort((a, b) =>
    a.label.localeCompare(b.label, "es", { sensitivity: "base" }),
  );
  return { data: options, error: null };
}

/** Valores distintos de `tenders.status` (RPC; sin escanear filas en el cliente). */
export async function listTenderStatuses(
  client: SupabaseClient<Database>,
): Promise<{ data: string[]; error: Error | null }> {
  const { data, error } = await client.rpc("list_tender_statuses");

  if (error) return { data: [], error: new Error(error.message) };

  // setof text: el cliente tipa mal el escalar; normalizamos a string[].
  const raw = data as unknown;
  const list: string[] = Array.isArray(raw)
    ? raw.map((s) => String(s))
    : raw != null
      ? [String(raw)]
      : [];

  const statuses = list
    .map((s) => s.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

  return { data: statuses, error: null };
}
