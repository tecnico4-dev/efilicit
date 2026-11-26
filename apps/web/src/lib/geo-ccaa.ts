/**
 * 17 comunidades autónomas (sin Ceuta/Melilla) para el filtro de búsqueda.
 * Códigos = `geo_ccaa.code` (INE). Nombres en castellano, formato homogéneo.
 * `shortName` = etiqueta compacta (p. ej. listados de municipio multi-CCAA).
 */
export const SEARCH_CCAA_OPTIONS: ReadonlyArray<{
  code: string;
  name: string;
  shortName: string;
}> = [
  { code: "01", name: "Andalucía", shortName: "Andalucía" },
  { code: "02", name: "Aragón", shortName: "Aragón" },
  { code: "03", name: "Principado de Asturias", shortName: "Asturias" },
  { code: "04", name: "Islas Baleares", shortName: "Baleares" },
  { code: "05", name: "Canarias", shortName: "Canarias" },
  { code: "06", name: "Cantabria", shortName: "Cantabria" },
  { code: "07", name: "Castilla y León", shortName: "Castilla y León" },
  { code: "08", name: "Castilla La Mancha", shortName: "Castilla La Mancha" },
  { code: "09", name: "Cataluña", shortName: "Cataluña" },
  { code: "10", name: "Comunidad Valenciana", shortName: "Valencia" },
  { code: "11", name: "Extremadura", shortName: "Extremadura" },
  { code: "12", name: "Galicia", shortName: "Galicia" },
  { code: "13", name: "Comunidad de Madrid", shortName: "Madrid" },
  { code: "14", name: "Región de Murcia", shortName: "Murcia" },
  { code: "15", name: "Comunidad Foral de Navarra", shortName: "Navarra" },
  { code: "16", name: "País Vasco", shortName: "País Vasco" },
  { code: "17", name: "La Rioja", shortName: "La Rioja" },
];

export function ccaaShortLabel(code: string): string {
  return SEARCH_CCAA_OPTIONS.find((o) => o.code === code)?.shortName ?? code;
}
