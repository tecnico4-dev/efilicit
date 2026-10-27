import { SEARCH_CCAA_OPTIONS } from "@/lib/geo-ccaa";
import {
  listPlaceMunicipalities,
  listSearchFilterOptions,
  type SearchFilterOption,
} from "@/lib/queries";
import { getSupabaseServerClient } from "@/lib/auth/session";
import { MunicipalityFilter } from "./municipality-filter";

function optionAllowed(value: string, options: SearchFilterOption[]): string {
  return options.some((o) => o.value === value) ? value : "";
}

const selectClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

/**
 * Desplegables que dependen de `list_tender_filter_options` (+ municipio).
 * Pensado para `<Suspense>`: el resto del formulario de búsqueda pinta antes.
 */
export async function SearchFilterFields({
  ccaaRaw,
  municipalityRaw,
  statusRaw,
  procedureRaw,
  contractTypeRaw,
}: {
  ccaaRaw: string;
  municipalityRaw: string;
  statusRaw: string;
  procedureRaw: string;
  contractTypeRaw: string;
}) {
  let filterOptions = {
    statuses: [] as SearchFilterOption[],
    procedureTypes: [] as SearchFilterOption[],
    contractTypes: [] as SearchFilterOption[],
    ccaaCodesWithTenders: new Set<string>(),
  };

  try {
    const client = await getSupabaseServerClient();
    const listed = await listSearchFilterOptions(client);
    if (!listed.error) filterOptions = listed.data;
  } catch {
    /* desplegables sin opciones distintas */
  }

  const ccaaInCatalog = SEARCH_CCAA_OPTIONS.some((o) => o.code === ccaaRaw);
  const ccaaHasData = filterOptions.ccaaCodesWithTenders.has(ccaaRaw);
  const ccaaValid = ccaaInCatalog && ccaaHasData ? ccaaRaw : "";

  const statusValid = optionAllowed(statusRaw, filterOptions.statuses);
  const procedureValid = optionAllowed(
    procedureRaw,
    filterOptions.procedureTypes,
  );
  const contractTypeValid = optionAllowed(
    contractTypeRaw,
    filterOptions.contractTypes,
  );

  let municipalityValid = "";
  let municipalityName = "";
  if (ccaaValid && municipalityRaw) {
    try {
      const client = await getSupabaseServerClient();
      const listed = await listPlaceMunicipalities(client, ccaaValid);
      const hit = listed.data.find((m) => m.code === municipalityRaw);
      if (hit) {
        municipalityValid = hit.code;
        municipalityName = hit.name;
      }
    } catch {
      municipalityValid = "";
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ccaa" className="block text-sm font-medium text-foreground">
            Comunidad Autónoma
          </label>
          <select
            id="ccaa"
            name="ccaa"
            defaultValue={ccaaValid}
            className={selectClass}
          >
            <option value="">Todas</option>
            {SEARCH_CCAA_OPTIONS.map((opt) => {
              const hasTenders = filterOptions.ccaaCodesWithTenders.has(opt.code);
              return (
                <option
                  key={opt.code}
                  value={opt.code}
                  disabled={!hasTenders}
                  className={hasTenders ? undefined : "text-muted-foreground/50"}
                >
                  {opt.name}
                </option>
              );
            })}
          </select>
        </div>
        <MunicipalityFilter
          initialCcaa={ccaaValid}
          initialMunicipalityCode={municipalityValid}
          initialMunicipalityName={municipalityName}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-foreground"
          >
            Estado
          </label>
          <select
            id="status"
            name="status"
            defaultValue={statusValid}
            className={selectClass}
          >
            <option value="">Todos</option>
            {filterOptions.statuses.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="procedure"
            className="block text-sm font-medium text-foreground"
          >
            Procedimiento
          </label>
          <select
            id="procedure"
            name="procedure"
            defaultValue={procedureValid}
            className={selectClass}
          >
            <option value="">Todos</option>
            {filterOptions.procedureTypes.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="contract_type"
            className="block text-sm font-medium text-foreground"
          >
            Tipo de contrato
          </label>
          <select
            id="contract_type"
            name="contract_type"
            defaultValue={contractTypeValid}
            className={selectClass}
          >
            <option value="">Todos</option>
            {filterOptions.contractTypes.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}

/** Placeholder mientras llegan las opciones DISTINCT. */
export function SearchFilterFieldsFallback({
  ccaaRaw,
  municipalityRaw,
  statusRaw,
  procedureRaw,
  contractTypeRaw,
}: {
  ccaaRaw: string;
  municipalityRaw: string;
  statusRaw: string;
  procedureRaw: string;
  contractTypeRaw: string;
}) {
  const ccaaDefault = SEARCH_CCAA_OPTIONS.some((o) => o.code === ccaaRaw)
    ? ccaaRaw
    : "";
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ccaa" className="block text-sm font-medium text-foreground">
            Comunidad Autónoma
          </label>
          <select
            id="ccaa"
            name="ccaa"
            defaultValue={ccaaDefault}
            className={selectClass}
            aria-busy
          >
            <option value="">Todas</option>
            {SEARCH_CCAA_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">Cargando opciones…</p>
        </div>
        <MunicipalityFilter
          initialCcaa={ccaaDefault}
          initialMunicipalityCode={municipalityRaw}
          initialMunicipalityName=""
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <BusySelect
          id="status"
          name="status"
          label="Estado"
          defaultValue={statusRaw}
        />
        <BusySelect
          id="procedure"
          name="procedure"
          label="Procedimiento"
          defaultValue={procedureRaw}
        />
        <BusySelect
          id="contract_type"
          name="contract_type"
          label="Tipo de contrato"
          defaultValue={contractTypeRaw}
        />
      </div>
    </>
  );
}

function BusySelect({
  id,
  name,
  label,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className={selectClass}
        aria-busy
      >
        <option value="">Todos</option>
        {defaultValue ? (
          <option value={defaultValue}>{defaultValue}</option>
        ) : null}
      </select>
    </div>
  );
}
