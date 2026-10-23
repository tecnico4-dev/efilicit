/** Visualización de instantes canónicos (UTC en BD) en hora peninsular. */
export const DISPLAY_TIME_ZONE = "Europe/Madrid";

export function formatDateMadrid(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: DISPLAY_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTimeMadrid(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: DISPLAY_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** YYYY-MM-DD en calendario Europe/Madrid (para comparar plazos). */
export function calendarDayMadrid(value: string | Date): string | null {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Resta/suma días sobre un YYYY-MM-DD civil (sin TZ). */
function shiftCivilDay(isoDay: string, deltaDays: number): string | null {
  const [y, m, d] = isoDay.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Día relativo en calendario Europe/Madrid: «Hoy» / «Ayer» / fecha absoluta
 * (p. ej. «7 jun 2026»).
 */
export function formatRelativeDayMadrid(
  value: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  const day = calendarDayMadrid(d);
  const today = calendarDayMadrid(now);
  if (!day || !today) return "—";
  if (day === today) return "Hoy";
  if (day === shiftCivilDay(today, -1)) return "Ayer";

  return new Intl.DateTimeFormat("es-ES", {
    timeZone: DISPLAY_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}
