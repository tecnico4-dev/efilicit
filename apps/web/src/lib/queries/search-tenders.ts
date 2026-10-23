/**
 * Cliente de búsqueda canónica (Semana 5 / ADR 011).
 *
 * La web no arma SQL ni habla con motores externos: llama a la RPC
 * `public.search_tenders` (SECURITY INVOKER → aplica RLS) con Criteria v1
 * aplanado a parámetros `p_*`. FTS + pg_trgm viven en Postgres.
 */
import type { Database, SearchCriteria } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cpvCodesForSearch } from "@/lib/cpv";
import { normalizeSearchQuery, tokenizeKeywords } from "@/lib/keywords";

export type SearchTenderRow = {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  procedure_type: string | null;
  contract_type: string | null;
  estimated_value: number | null;
  currency: string;
  cpv_codes: string[] | null;
  publication_date: string | null;
  deadline_at: string | null;
  contracting_authority_id: string | null;
  created_at: string;
  updated_at: string;
  rank: number;
  /** Origen del hit: fts | trgm | filter (badge UI). */
  match_kind: "fts" | "trgm" | "filter" | string;
};

type SearchTenderRpcRow = SearchTenderRow & {
  total_count?: number | null;
};

export type SearchTendersInput = {
  /** Texto libre de la caja de búsqueda (FTS + fallback trigram). */
  query?: string;
  /** Criteria v1 (Paso 1). Campos omitidos no filtran. */
  criteria?: Partial<SearchCriteria>;
  limit?: number;
  offset?: number;
};

type SearchTendersArgs = Database["public"]["Functions"]["search_tenders"]["Args"];

function emptyToUndef<T>(value: T[] | null | undefined): T[] | undefined {
  if (!value || value.length === 0) return undefined;
  return value;
}

/** Aplana SearchCriteria + query a args tipados de la RPC. */
function buildRpcArgs(input: SearchTendersInput): SearchTendersArgs {
  const c = input.criteria ?? {};
  const name = c.authority?.name_contains?.trim();
  const keywords = c.keywords?.length
    ? tokenizeKeywords(c.keywords.join(" "))
    : undefined;
  return {
    p_query: normalizeSearchQuery(input.query ?? "") || undefined,
    p_keywords: emptyToUndef(keywords),
    p_cpv_codes: emptyToUndef(cpvCodesForSearch(c.cpv_codes)),
    p_cpv_match:
      c.cpv_codes?.length && c.cpv_match === "all" ? "all" : undefined,
    p_authority_tax_ids: emptyToUndef(c.authority?.tax_ids),
    p_authority_ids: emptyToUndef(c.authority?.ids),
    p_authority_name_contains: name || undefined,
    p_municipalities: emptyToUndef(c.geography?.municipalities),
    p_countries: emptyToUndef(c.geography?.countries),
    p_ccaa_codes: emptyToUndef(c.geography?.ccaa_codes),
    p_municipality_codes: emptyToUndef(c.geography?.municipality_codes),
    p_estimated_value_min: c.estimated_value_min,
    p_estimated_value_max: c.estimated_value_max,
    p_contract_types: emptyToUndef(c.contract_types),
    p_procedure_types: emptyToUndef(c.procedure_types),
    p_statuses: emptyToUndef(c.statuses),
    p_publication_date_from: c.publication_date_from,
    p_publication_date_to: c.publication_date_to,
    p_deadline_from: c.deadline_from,
    p_deadline_to: c.deadline_to,
    p_open_for_submission: c.open_for_submission === true ? true : undefined,
    p_limit: input.limit ?? 10,
    p_offset: input.offset ?? 0,
  };
}

/**
 * Búsqueda canónica sobre `tenders` (FTS + pg_trgm + filtros Criteria v1).
 * Usa la RPC `public.search_tenders`. No usa service_role.
 * `totalCount` = universo de la búsqueda (filtro completo; con texto, tras top-K).
 */
export async function searchTenders(
  client: SupabaseClient<Database>,
  input: SearchTendersInput = {},
): Promise<{
  data: SearchTenderRow[] | null;
  totalCount: number;
  error: Error | null;
}> {
  const { data, error } = await client.rpc("search_tenders", buildRpcArgs(input));

  if (error) {
    return { data: null, totalCount: 0, error: new Error(error.message) };
  }

  const rows = (data ?? []) as SearchTenderRpcRow[];
  const totalCount = Number(rows[0]?.total_count ?? 0);
  const cleaned: SearchTenderRow[] = rows.map(
    ({ total_count: _total, ...rest }) => rest,
  );

  return { data: cleaned, totalCount, error: null };
}
