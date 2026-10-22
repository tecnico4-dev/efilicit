/**
 * Histórico registrado de estados de una licitación (`tender_events`).
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildStatusTimeline,
  type StatusTimelineEntry,
} from "@/lib/tender-status-timeline";

export type { StatusTimelineEntry };

/**
 * Carga hitos de estado (compactados) para la ficha.
 * Solo eventos con `event_status`; lectura pública del canónico.
 */
export async function listTenderStatusHistory(
  client: SupabaseClient<Database>,
  tenderId: string,
): Promise<{ data: StatusTimelineEntry[]; error: Error | null }> {
  const { data, error } = await client
    .from("tender_events")
    .select("event_status, occurred_at, created_at")
    .eq("tender_id", tenderId)
    .not("event_status", "is", null)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return { data: [], error: new Error(error.message) };

  return {
    data: buildStatusTimeline(data ?? []),
    error: null,
  };
}
