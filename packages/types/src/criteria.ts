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
 * - Dentro de un array, los valores se combinan con OR
 *   (excepción CPV: `cpv_match` `"any"` | `"all"`, default `"any"`).
 * - `{}` o solo `{ "version": 1 }` en una **alerta** no debe generar matches
 *   (evita spam); en **búsqueda guardada** significa “sin filtros”.
 * - Geografía de ejecución: `geography.ccaa_codes` / `municipality_codes` →
 *   `tenders.place_*` (ADR 018). Legacy `municipalities` = sede del organismo.
 * - Identidad de organismo vía `contracting_authorities` (join).
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
  /**
   * Códigos INE de CCAA (`tenders.place_ccaa_code` / `geo_ccaa.code`).
   * Preferido para filtrar lugar de ejecución (ADR 018).
   */
  ccaa_codes?: string[];
  /**
   * Códigos INE de municipio (`tenders.place_municipality_code`).
   * Solo tendrá hits cuando el catálogo `geo_municipio` esté cargado y la fuente aporte código.
   */
  municipality_codes?: string[];
  /**
   * Legacy: municipios por texto sobre sede del organismo
   * (`contracting_authorities.municipality`). No es lugar de ejecución.
   */
  municipalities?: string[];
  /** País ISO-ish; por defecto los datos son ES. */
  countries?: string[];
};

/**
 * Campos de filtrado. Todos opcionales.
 * Fechas en ISO-8601 (`YYYY-MM-DD` o timestamptz completo según el campo).
 */
/** Cómo combinar varios `cpv_codes` contra el conjunto del tender. */
export type CpvMatchMode = "any" | "all";

export type CriteriaFields = {
  /** Palabras clave; en búsqueda/alertas se aplican a título/descripción. */
  keywords?: string[];
  /** Códigos CPV (`tender_cpvs`); coincidencia por prefijo. */
  cpv_codes?: string[];
  /**
   * `any` (default): basta que algún CPV del tender cumpla algún criterio.
   * `all`: cada criterio debe cumplirse con algún CPV del tender (AND de prefijos).
   * Solo aplica con ≥1 `cpv_codes`; omitido = `any`.
   */
  cpv_match?: CpvMatchMode;
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
  /** `tenders.deadline_at` ≥ (ISO UTC o fecha; fecha = 00:00 Europe/Madrid → UTC). */
  deadline_from?: string;
  /** `tenders.deadline_at` ≤. */
  deadline_to?: string;
  /**
   * Solo licitaciones aún en plazo: `deadline_at > now()` (UTC).
   * Sin plazo (`null`) no entran. Independiente de `deadline_from`/`to`.
   */
  open_for_submission?: boolean;
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
    ccaa_codes: ["13"],
    municipality_codes: ["28079"],
    countries: ["ES"],
  },
  estimated_value_min: 10_000,
  estimated_value_max: 500_000,
  contract_types: ["servicios"],
  procedure_types: ["abierto"],
  publication_date_from: "2026-01-01",
  publication_date_to: "2026-12-31",
};
