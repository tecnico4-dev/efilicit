/**
 * Historial de estados a partir de `tender_events`:
 * primer status visto + cada cambio de `event_status` (no cada fila suelta).
 */

export type TenderEventForTimeline = {
  event_status: string | null;
  occurred_at: string | null;
  created_at: string;
};

export type StatusTimelineEntry = {
  status: string;
  /** `occurred_at` de negocio; si falta, `created_at`. */
  at: string;
};

/** Ordena y compacta eventos → hitos fecha/estado. */
export function buildStatusTimeline(
  events: TenderEventForTimeline[],
): StatusTimelineEntry[] {
  const ordered = [...events].sort((a, b) => {
    const aAt = a.occurred_at || a.created_at;
    const bAt = b.occurred_at || b.created_at;
    if (aAt !== bAt) return aAt < bAt ? -1 : 1;
    return a.created_at < b.created_at ? -1 : 1;
  });

  const out: StatusTimelineEntry[] = [];
  let prev: string | null = null;
  for (const e of ordered) {
    const status = e.event_status?.trim() || null;
    if (!status) continue;
    if (status === prev) continue;
    out.push({
      status,
      at: e.occurred_at || e.created_at,
    });
    prev = status;
  }
  return out;
}
