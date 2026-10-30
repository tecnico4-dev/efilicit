/** Cuenta atrás humana respecto a ahora (cliente o RSC). */
export function formatCountdown(dueIso: string | null | undefined): {
  label: string;
  tone: "ok" | "soon" | "overdue" | "none";
} {
  if (!dueIso) return { label: "Sin plazo", tone: "none" };
  const due = new Date(dueIso).getTime();
  if (Number.isNaN(due)) return { label: "Sin plazo", tone: "none" };

  const diffMs = due - Date.now();
  const abs = Math.abs(diffMs);
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);

  let span: string;
  if (minutes < 60) span = `${minutes} min`;
  else if (hours < 48) span = `${hours} h`;
  else span = `${days} d`;

  if (diffMs < 0) return { label: `Vencido hace ${span}`, tone: "overdue" };
  if (diffMs < 3 * 86_400_000) return { label: `Quedan ${span}`, tone: "soon" };
  return { label: `Quedan ${span}`, tone: "ok" };
}
