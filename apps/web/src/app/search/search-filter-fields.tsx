import type { ReactNode } from "react";
import {
  listPlaceMunicipalities,
  listSearchFilterOptions,
} from "@/lib/queries";
import { getSupabaseServerClient } from "@/lib/auth/session";
import { SEARCH_CCAA_OPTIONS } from "@/lib/geo-ccaa";
import type { CriteriaFilterInitial } from "@/lib/criteria-display";
import {
  CriteriaFilters,
  CriteriaFiltersFallback,
} from "@/components/criteria/criteria-filters";
import { SEARCH_FORM_ID } from "./save-search-button";

function optionAllowed(
  value: string,
  options: { value: string }[],
): string {
  return options.some((o) => o.value === value) ? value : "";
}

type LoaderProps = {
  initial: CriteriaFilterInitial;
  queryOnlyNoise?: boolean;
  textFieldAction?: ReactNode;
};

/**
 * Carga opciones DISTINCT + municipio y pinta el bloque compartido de filtros.
 * Pensado para `<Suspense>` en `/search`.
 */
export async function SearchFilterFields({
  initial,
  queryOnlyNoise = false,
  textFieldAction,
}: LoaderProps) {
  let filterOptions = {
    statuses: [] as { value: string; label: string }[],
    procedureTypes: [] as { value: string; label: string }[],
    contractTypes: [] as { value: string; label: string }[],
    ccaaCodesWithTenders: [] as string[],
  };

  try {
    const client = await getSupabaseServerClient();
    const listed = await listSearchFilterOptions(client);
    if (!listed.error) {
      filterOptions = {
        statuses: listed.data.statuses,
        procedureTypes: listed.data.procedureTypes,
        contractTypes: listed.data.contractTypes,
        ccaaCodesWithTenders: [...listed.data.ccaaCodesWithTenders],
      };
    }
  } catch {
    /* desplegables sin opciones distintas */
  }

  const ccaaWithData = new Set(filterOptions.ccaaCodesWithTenders);
  const ccaaInCatalog = SEARCH_CCAA_OPTIONS.some((o) => o.code === initial.ccaa);
  const ccaaValid =
    ccaaInCatalog && ccaaWithData.has(initial.ccaa) ? initial.ccaa : "";

  const statusValid = optionAllowed(initial.status, filterOptions.statuses);
  const procedureValid = optionAllowed(
    initial.procedure,
    filterOptions.procedureTypes,
  );
  const contractTypeValid = optionAllowed(
    initial.contractType,
    filterOptions.contractTypes,
  );

  let municipalityValid = "";
  let municipalityName = "";
  if (ccaaValid && initial.municipalityCode) {
    try {
      const client = await getSupabaseServerClient();
      const listed = await listPlaceMunicipalities(client, ccaaValid);
      const hit = listed.data.find((m) => m.code === initial.municipalityCode);
      if (hit) {
        municipalityValid = hit.code;
        municipalityName = hit.name;
      }
    } catch {
      municipalityValid = "";
    }
  }

  const resolved: CriteriaFilterInitial = {
    ...initial,
    ccaa: ccaaValid,
    municipalityCode: municipalityValid,
    municipalityName,
    status: statusValid,
    procedure: procedureValid,
    contractType: contractTypeValid,
  };

  return (
    <CriteriaFilters
      initial={resolved}
      filterOptions={filterOptions}
      formId={SEARCH_FORM_ID}
      queryOnlyNoise={queryOnlyNoise}
      textFieldAction={textFieldAction}
    />
  );
}

export function SearchFilterFieldsFallback({
  initial,
  queryOnlyNoise = false,
  textFieldAction,
}: LoaderProps) {
  return (
    <CriteriaFiltersFallback
      initial={initial}
      formId={SEARCH_FORM_ID}
      queryOnlyNoise={queryOnlyNoise}
      textFieldAction={textFieldAction}
    />
  );
}
