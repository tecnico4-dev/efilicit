/**
 * Etiquetas legibles para valores canónicos (inglés/códigos → español de producto).
 * Los valores en DB no cambian; solo la presentación en UI.
 */

const STATUS_LABELS: Record<string, string> = {
  published: "Publicada",
  prepared: "En preparación",
  awarded: "Adjudicada",
  resolved: "Formalizada",
  cancelled: "Anulada",
  deserted: "Desierta",
  evaluation: "En evaluación",
};

/** Estado de licitación para mostrar al usuario. */
export function formatTenderStatus(status: string | null | undefined): string {
  if (status == null || status.trim() === "") return "—";
  const key = status.trim().toLowerCase();
  return STATUS_LABELS[key] ?? status.trim();
}
