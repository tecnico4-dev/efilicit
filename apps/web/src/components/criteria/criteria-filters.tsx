"use client";

import { SEARCH_CCAA_OPTIONS } from "@/lib/geo-ccaa";
import type { CriteriaFilterInitial } from "@/lib/criteria-display";
import type { SearchFilterOption } from "@/lib/queries";
import { CpvPicker } from "@/app/search/cpv-picker";
import { MunicipalityFilter } from "@/app/search/municipality-filter";
import { SEARCH_FORM_ID } from "@/app/search/save-search-button";

const selectClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

const inputClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

export type CriteriaFilterOptionsProp = {
  statuses: SearchFilterOption[];
  procedureTypes: SearchFilterOption[];
  contractTypes: SearchFilterOption[];
  /** Códigos INE de CCAA con ≥1 licitación. */
  ccaaCodesWithTenders: readonly string[];
};

function withInitialOption(
  options: SearchFilterOption[],
  value: string,
): SearchFilterOption[] {
  if (!value || options.some((o) => o.value === value)) return options;
  return [...options, { value, label: value }];
}

type Props = {
  initial: CriteriaFilterInitial;
  filterOptions: CriteriaFilterOptionsProp;
  /** Id del `<form>` que envuelve estos campos. */
  formId?: string;
  /** Prefijo para ids de labels (p. ej. editar varias alertas). */
  idPrefix?: string;
  /** Hint de keywords solo ruido (buscador). */
  queryOnlyNoise?: boolean;
};

/**
 * Campos de Criteria v1 compartidos entre búsqueda y alertas (sin organismo).
 * Los `name=` deben coincidir con `buildCriteriaFromSearchForm`.
 */
export function CriteriaFilters({
  initial,
  filterOptions,
  formId = SEARCH_FORM_ID,
  idPrefix = "",
  queryOnlyNoise = false,
}: Props) {
  const ccaaWithData = new Set(filterOptions.ccaaCodesWithTenders);
  const statuses = withInitialOption(filterOptions.statuses, initial.status);
  const procedureTypes = withInitialOption(
    filterOptions.procedureTypes,
    initial.procedure,
  );
  const contractTypes = withInitialOption(
    filterOptions.contractTypes,
    initial.contractType,
  );
  const qId = `${idPrefix}q`;
  const minId = `${idPrefix}min`;
  const maxId = `${idPrefix}max`;
  const ccaaId = `${idPrefix}ccaa`;
  const statusId = `${idPrefix}status`;
  const procedureId = `${idPrefix}procedure`;
  const contractId = `${idPrefix}contract_type`;
  const pubFromId = `${idPrefix}pub_from`;
  const pubToId = `${idPrefix}pub_to`;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={qId} className="block text-sm font-medium text-foreground">
          Texto
        </label>
        <input
          id={qId}
          name="q"
          type="search"
          defaultValue={initial.q}
          aria-invalid={queryOnlyNoise || undefined}
          aria-describedby={queryOnlyNoise ? `${qId}-noise-hint` : undefined}
          className={inputClass}
        />
        {queryOnlyNoise ? (
          <p
            id={`${qId}-noise-hint`}
            className="mt-1 text-xs text-destructive"
            role="alert"
          >
            Escribe al menos un término significativo. Evita palabras como
            «de», «el» o «la».
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={ccaaId}
            className="block text-sm font-medium text-foreground"
          >
            Comunidad Autónoma
          </label>
          <select
            id={ccaaId}
            name="ccaa"
            defaultValue={initial.ccaa}
            className={selectClass}
          >
            <option value="">Todas</option>
            {SEARCH_CCAA_OPTIONS.map((opt) => {
              const hasTenders = ccaaWithData.has(opt.code);
              const keepSelected = opt.code === initial.ccaa;
              return (
                <option
                  key={opt.code}
                  value={opt.code}
                  disabled={!hasTenders && !keepSelected}
                  className={
                    hasTenders || keepSelected
                      ? undefined
                      : "text-muted-foreground/50"
                  }
                >
                  {opt.name}
                </option>
              );
            })}
          </select>
        </div>
        <MunicipalityFilter
          formId={formId}
          initialCcaa={initial.ccaa}
          initialMunicipalityCode={initial.municipalityCode}
          initialMunicipalityName={initial.municipalityName}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor={statusId}
            className="block text-sm font-medium text-foreground"
          >
            Estado
          </label>
          <select
            id={statusId}
            name="status"
            defaultValue={initial.status}
            className={selectClass}
          >
            <option value="">Todos</option>
            {statuses.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={procedureId}
            className="block text-sm font-medium text-foreground"
          >
            Procedimiento
          </label>
          <select
            id={procedureId}
            name="procedure"
            defaultValue={initial.procedure}
            className={selectClass}
          >
            <option value="">Todos</option>
            {procedureTypes.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={contractId}
            className="block text-sm font-medium text-foreground"
          >
            Tipo de contrato
          </label>
          <select
            id={contractId}
            name="contract_type"
            defaultValue={initial.contractType}
            className={selectClass}
          >
            <option value="">Todos</option>
            {contractTypes.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={minId}
            className="block text-sm font-medium text-foreground"
          >
            Importe mín. (sin IVA)
          </label>
          <input
            id={minId}
            name="min"
            type="number"
            min={0}
            step={1}
            defaultValue={initial.min}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor={maxId}
            className="block text-sm font-medium text-foreground"
          >
            Importe máx. (sin IVA)
          </label>
          <input
            id={maxId}
            name="max"
            type="number"
            min={0}
            step={1}
            defaultValue={initial.max}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={pubFromId}
            className="block text-sm font-medium text-foreground"
          >
            Publicación desde
          </label>
          <input
            id={pubFromId}
            name="pub_from"
            type="date"
            defaultValue={initial.pubFrom}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor={pubToId}
            className="block text-sm font-medium text-foreground"
          >
            Publicación hasta
          </label>
          <input
            id={pubToId}
            name="pub_to"
            type="date"
            defaultValue={initial.pubTo}
            className={inputClass}
          />
        </div>
      </div>

      <CpvPicker
        initialCodes={initial.cpvCodes}
        initialMatch={initial.cpvMatch}
      />

      <label className="inline-flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="en_plazo"
          value="1"
          defaultChecked={initial.openForSubmission}
          className="ef-checkbox"
        />
        Solo en plazo
      </label>
    </div>
  );
}

/** Placeholder mientras llegan opciones DISTINCT (Suspense búsqueda). */
export function CriteriaFiltersFallback({
  initial,
  formId = SEARCH_FORM_ID,
  idPrefix = "",
  queryOnlyNoise = false,
}: {
  initial: CriteriaFilterInitial;
  formId?: string;
  idPrefix?: string;
  queryOnlyNoise?: boolean;
}) {
  return (
    <CriteriaFilters
      initial={initial}
      formId={formId}
      idPrefix={idPrefix}
      queryOnlyNoise={queryOnlyNoise}
      filterOptions={{
        statuses: initial.status
          ? [{ value: initial.status, label: initial.status }]
          : [],
        procedureTypes: initial.procedure
          ? [{ value: initial.procedure, label: initial.procedure }]
          : [],
        contractTypes: initial.contractType
          ? [{ value: initial.contractType, label: initial.contractType }]
          : [],
        ccaaCodesWithTenders: initial.ccaa ? [initial.ccaa] : [],
      }}
    />
  );
}
