/**
 * Contrato compartido de `criteria` (jsonb) para:
 * - `public.saved_searches.criteria`
 * - `public.alerts.criteria`
 *
 * Semana 5 / Paso 1. Sin DDL nuevo: el esqueleto Semana 1 ya usa jsonb.
 * El motor de alertas (Paso 7) y las queries de búsqueda deben respetar este shape.
 *
 * Semántica:
 * - Campos omitidos o vacíos = no filtran esa dimensión.
 * - Dimensiones presentes se combinan con AND.
 * - Dentro de un array, los valores se combinan con OR.
 * - `{}` o solo `{ "version": 1 }` en una **alerta** no debe generar matches
 *   (evita spam); en **búsqueda guardada** significa “sin filtros”.
 * - Geografía e identidad de organismo se resuelven vía `contracting_authorities`
 *   (join), no vía columnas en `tenders`.
 * - NIF/CIF (`authority.tax_ids`) es señal primaria de organismo; el nombre
 *   (`name_contains`) es filtro débil, nunca identidad única.
 */

/** Versión del contrato JSON. Incrementar solo con migración de datos + código. */
export type CriteriaVersion = 1;

export type AuthorityCriteria = {
  /** NIF/CIF (u equivalente) del organismo. Preferido cuando exista. */
  tax_ids?: string[];
  /** UUID de `contracting_authorities.id`. */
  ids?: string[];
  /**
   * Subcadena sobre nombre normalizado del organismo.
   * Nunca usar como identidad canónica única.
   */
  name_contains?: string;
};

export type GeographyCriteria = {
  /** Municipios (texto canónico de `contracting_authorities.municipality`). */
  municipalities?: string[];
  /** País ISO-ish; por defecto los datos son ES. */
  countries?: string[];
};

/**
 * Campos de filtrado. Todos opcionales.
 * Fechas en ISO-8601 (`YYYY-MM-DD` o timestamptz completo según el campo).
 */
export type CriteriaFields = {
  /** Palabras clave; en búsqueda/alertas se aplican a título/descripción. */
  keywords?: string[];
  /** Códigos CPV (`tenders.cpv_code`); suele bastar coincidencia por prefijo. */
  cpv_codes?: string[];
  authority?: AuthorityCriteria;
  geography?: GeographyCriteria;
  /** Importe estimado mínimo inclusive (`tenders.estimated_value`). */
  estimated_value_min?: number;
  /** Importe estimado máximo inclusive. */
  estimated_value_max?: number;
  /** Valores tal cual en `tenders.contract_type` (sin enum cerrado en MVP). */
  contract_types?: string[];
  /** Opcional MVP: `tenders.procedure_type`. */
  procedure_types?: string[];
  /** Opcional: `tenders.status`. */
  statuses?: string[];
  /** `tenders.publication_date` ≥ (fecha `YYYY-MM-DD`). */
  publication_date_from?: string;
  /** `tenders.publication_date` ≤. */
  publication_date_to?: string;
  /** `tenders.deadline_at` ≥ (ISO timestamptz o fecha). */
  deadline_from?: string;
  /** `tenders.deadline_at` ≤. */
  deadline_to?: string;
};

export type SearchCriteria = CriteriaFields & {
  version: CriteriaVersion;
};

/** Alias: alertas y búsquedas guardadas comparten el mismo contrato. */
export type AlertCriteria = SearchCriteria;

/** Ejemplo válido para pruebas manuales / seeds. */
export const CRITERIA_EXAMPLE_V1: SearchCriteria = {
  version: 1,
  keywords: ["software", "mantenimiento"],
  cpv_codes: ["72000000"],
  authority: {
    tax_ids: ["P2807900B"],
  },
  geography: {
    municipalities: ["Madrid"],
    countries: ["ES"],
  },
  estimated_value_min: 10_000,
  estimated_value_max: 500_000,
  contract_types: ["services"],
  procedure_types: ["open"],
  publication_date_from: "2026-01-01",
  publication_date_to: "2026-12-31",
};
