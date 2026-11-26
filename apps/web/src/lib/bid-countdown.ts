export type CountdownTone = "ok" | "soon" | "overdue" | "none";

/** Cuenta atrás humana respecto a ahora (cliente o RSC). */
export function formatCountdown(dueIso: string | null | undefined): {
  label: string;
  tone: CountdownTone;
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

/**
 * Frase en días para el KPI de riesgo: «Vence en X días» / «Vencido hace X días».
 */
export function formatDeadlineDaysPhrase(
  dueIso: string | null | undefined,
): { phrase: string | null; tone: CountdownTone } {
  if (!dueIso) return { phrase: null, tone: "none" };
  const due = new Date(dueIso).getTime();
  if (Number.isNaN(due)) return { phrase: null, tone: "none" };

  const diffMs = due - Date.now();
  const dayMs = 86_400_000;
  const tone: CountdownTone =
    diffMs < 0 ? "overdue" : diffMs < 3 * dayMs ? "soon" : "ok";

  if (diffMs < 0) {
    const days = Math.max(1, Math.ceil(Math.abs(diffMs) / dayMs));
    return {
      phrase: days === 1 ? "Vencido hace 1 día" : `Vencido hace ${days} días`,
      tone,
    };
  }

  const days = Math.max(0, Math.ceil(diffMs / dayMs));
  if (days === 0) return { phrase: "Vence hoy", tone };
  if (days === 1) return { phrase: "Vence en 1 día", tone };
  return { phrase: `Vence en ${days} días`, tone };
}
