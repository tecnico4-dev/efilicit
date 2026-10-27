/**
 * Valores distintos presentes en `tenders` para desplegables de búsqueda.
 * RPC `list_tender_filter_options` (SECURITY INVOKER).
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatContractType,
  formatProcedureType,
  formatTenderStatus,
} from "@/lib/tender-labels";

export type SearchFilterOption = {
  value: string;
  label: string;
};

export type SearchFilterOptions = {
  statuses: SearchFilterOption[];
  procedureTypes: SearchFilterOption[];
  contractTypes: SearchFilterOption[];
  /** Códigos INE de CCAA con ≥1 licitación (`place_ccaa_code`). */
  ccaaCodesWithTenders: Set<string>;
};

function uniqSortedLabels(
  values: string[],
  format: (v: string) => string,
): SearchFilterOption[] {
  const set = new Set(values.map((v) => v.trim()).filter(Boolean));
  return [...set]
    .map((value) => ({ value, label: format(value) }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

/**
 * Carga opciones de estado / procedimiento / tipo + CCAA con datos.
 * Fallos → listas vacías (el desplegable queda solo «Todos»).
 */
export async function listSearchFilterOptions(
  client: SupabaseClient<Database>,
): Promise<{ data: SearchFilterOptions; error: Error | null }> {
  const empty: SearchFilterOptions = {
    statuses: [],
    procedureTypes: [],
    contractTypes: [],
    ccaaCodesWithTenders: new Set(),
  };

  const { data, error } = await client.rpc("list_tender_filter_options");

  if (error) {
    return { data: empty, error: new Error(error.message) };
  }

  const statuses: string[] = [];
  const procedureTypes: string[] = [];
  const contractTypes: string[] = [];
  const ccaaCodesWithTenders = new Set<string>();

  for (const row of data ?? []) {
    const kind = row.kind?.trim();
    const value = row.value?.trim();
    if (!kind || !value) continue;
    if (kind === "status") statuses.push(value);
    else if (kind === "procedure_type") procedureTypes.push(value);
    else if (kind === "contract_type") contractTypes.push(value);
    else if (kind === "place_ccaa_code") ccaaCodesWithTenders.add(value);
  }

  return {
    data: {
      statuses: uniqSortedLabels(statuses, formatTenderStatus),
      procedureTypes: uniqSortedLabels(procedureTypes, formatProcedureType),
      contractTypes: uniqSortedLabels(contractTypes, formatContractType),
      ccaaCodesWithTenders,
    },
    error: null,
  };
}
