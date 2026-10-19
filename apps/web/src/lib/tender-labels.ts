/**
 * Etiquetas legibles para valores canónicos ES (y alias EN legacy).
 */

const STATUS_LABELS: Record<string, string> = {
  publicada: "Publicada",
  preparada: "Preparada",
  adjudicada: "Adjudicada",
  resuelta: "Resuelta",
  anulada: "Anulada",
  desierta: "Desierta",
  evaluacion: "En evaluación",
  // legacy EN
  published: "Publicada",
  prepared: "Preparada",
  awarded: "Adjudicada",
  resolved: "Resuelta",
  cancelled: "Anulada",
  deserted: "Desierta",
  evaluation: "En evaluación",
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  suministros: "Suministros",
  servicios: "Servicios",
  obras: "Obras",
  administrativo_especial: "Administrativo especial",
  privado: "Privado",
  gestion_servicios_publicos: "Gestión de servicios públicos",
  concesion_servicios: "Concesión de servicios",
  concesion_obras_publicas: "Concesión de obras públicas",
  concesion_obras: "Concesión de obras",
  colaboracion_publico_privada: "Colaboración público-privada",
  patrimonial: "Patrimonial",
  otro: "Otro",
  // legacy EN
  supplies: "Suministros",
  services: "Servicios",
  works: "Obras",
  other: "Otro",
};

const PROCEDURE_TYPE_LABELS: Record<string, string> = {
  abierto: "Abierto",
  abierto_simplificado: "Abierto simplificado",
  restringido: "Restringido",
  negociado: "Negociado",
  dialogo_competitivo: "Diálogo competitivo",
  asociacion_innovacion: "Asociación para la innovación",
  otro: "Otro",
  open: "Abierto",
  restricted: "Restringido",
  negotiated: "Negociado",
  competitive_dialogue: "Diálogo competitivo",
  innovation_partnership: "Asociación para la innovación",
  other: "Otro",
};

function labelFrom(
  map: Record<string, string>,
  value: string | null | undefined,
): string {
  if (value == null || value.trim() === "") return "—";
  const key = value.trim().toLowerCase();
  return map[key] ?? value.trim();
}

/** Estado de licitación para mostrar al usuario. */
export function formatTenderStatus(status: string | null | undefined): string {
  return labelFrom(STATUS_LABELS, status);
}

/** Tipo de contrato canónico. */
export function formatContractType(value: string | null | undefined): string {
  return labelFrom(CONTRACT_TYPE_LABELS, value);
}

/** Procedimiento de adjudicación. */
export function formatProcedureType(value: string | null | undefined): string {
  return labelFrom(PROCEDURE_TYPE_LABELS, value);
}
