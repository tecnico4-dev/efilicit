/**
 * Lectura de una licitación canónica por id (Semana 6 / Pasos 3–4).
 * Cliente publishable/anon + RLS de lectura pública; nunca service_role.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type TenderRow = Database["public"]["Tables"]["tenders"]["Row"];
type TenderSourceRow = Database["public"]["Tables"]["tender_sources"]["Row"];

export type TenderSourceSummary = Pick<
  TenderSourceRow,
  | "id"
  | "source_code"
  | "source_tender_id"
  | "source_url"
  | "last_seen_at"
  | "review_status"
  | "match_method"
>;

export type TenderDetail = TenderRow & {
  contracting_authority: {
    id: string;
    name: string;
    tax_id: string | null;
    municipality: string | null;
    country: string;
  } | null;
  sources: TenderSourceSummary[];
};

type TenderWithJoins = TenderRow & {
  contracting_authorities: TenderDetail["contracting_authority"] | null;
  tender_sources: TenderSourceSummary[] | null;
};

/**
 * Obtiene una fila de `tenders` (+ organismo y `tender_sources`).
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
      ),
      tender_sources!tender_sources_tender_id_fkey (
        id,
        source_code,
        source_tender_id,
        source_url,
        last_seen_at,
        review_status,
        match_method
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

  const row = data as TenderWithJoins;
  const { contracting_authorities, tender_sources, ...tender } = row;
  const sources = [...(tender_sources ?? [])].sort((a, b) =>
    a.source_code.localeCompare(b.source_code),
  );

  return {
    data: {
      ...tender,
      contracting_authority: contracting_authorities ?? null,
      sources,
    },
    error: null,
  };
}
