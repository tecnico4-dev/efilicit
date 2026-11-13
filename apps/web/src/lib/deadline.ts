/**
 * Plazos de presentación (Europe/Madrid) para home «Última oportunidad».
 */
import { calendarDayMadrid } from "@/lib/datetime";
import type { FavoriteWithTender } from "@/lib/queries";

export function daysUntilDeadlineMadrid(iso: string | null): number | null {
  if (!iso) return null;
  const deadlineDay = calendarDayMadrid(iso);
  const todayDay = calendarDayMadrid(new Date());
  if (!deadlineDay || !todayDay) return null;
  const deadline = new Date(`${deadlineDay}T12:00:00Z`);
  const today = new Date(`${todayDay}T12:00:00Z`);
  return Math.round(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function deadlineLabel(iso: string | null): string {
  const diff = daysUntilDeadlineMadrid(iso);
  if (diff == null) return "Sin plazo";
  if (diff < 0) return `Venció hace ${Math.abs(diff)} d`;
  if (diff === 0) return "Vence hoy";
  if (diff === 1) return "Vence mañana";
  return `Vence en ${diff} días`;
}

export function deadlineUrgencyClass(iso: string | null): string {
  const diff = daysUntilDeadlineMadrid(iso);
  if (diff == null) return "text-muted-foreground";
  if (diff < 0) return "text-destructive";
  if (diff <= 7) return "text-primary-dark";
  return "text-muted-foreground";
}

/**
 * Última oportunidad: máx. 5.
 * - Oculta si venció hace más de 5 días.
 * - Primero por vencer (más cercano primero); luego vencidas recientes;
 *   sin plazo al final.
 */
export function attentionFavorites(
  favorites: FavoriteWithTender[],
): FavoriteWithTender[] {
  return [...favorites]
    .filter((f) => {
      if (!f.tenders) return false;
      const diff = daysUntilDeadlineMadrid(f.tenders.deadline_at);
      if (diff != null && diff < -5) return false;
      return true;
    })
    .sort((a, b) => {
      const da = a.tenders?.deadline_at ?? null;
      const db = b.tenders?.deadline_at ?? null;
      const diffA = daysUntilDeadlineMadrid(da);
      const diffB = daysUntilDeadlineMadrid(db);

      if (diffA == null && diffB == null) return 0;
      if (diffA == null) return 1;
      if (diffB == null) return -1;

      const upcomingA = diffA >= 0;
      const upcomingB = diffB >= 0;
      if (upcomingA !== upcomingB) return upcomingA ? -1 : 1;

      // Por vencer: más cercano primero. Vencidas: más reciente primero.
      if (upcomingA) return diffA - diffB;
      return diffB - diffA;
    })
    .slice(0, 5);
}
