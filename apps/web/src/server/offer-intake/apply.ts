/**
 * Volcado idempotente del IntakePlan a offer_* (espejo de postgres.apply_plan).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@efilicit/types";
import type { IntakePlan } from "./plan";

export type ApplyStats = {
  pliegos: number;
  requirements: number;
  deliverables: number;
  milestones: number;
};

export async function applyIntakePlan(
  admin: SupabaseClient<Database>,
  offerCaseId: string,
  plan: IntakePlan,
): Promise<ApplyStats> {
  const stats: ApplyStats = {
    pliegos: 0,
    requirements: 0,
    deliverables: 0,
    milestones: 0,
  };

  if (plan.pliegos.length > 0) {
    const { data, error } = await admin
      .from("offer_case_pliegos")
      .upsert(
        plan.pliegos.map((p) => ({
          offer_case_id: offerCaseId,
          pliego_type: p.pliego_type,
          title: p.title,
          url: p.url,
          source_key: p.source_key,
          source_uri: p.source_uri,
          source_hash: p.source_hash,
          fetch_status: p.initial_fetch_status,
        })),
        { onConflict: "offer_case_id,source_key", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw new Error(error.message);
    stats.pliegos = data?.length ?? 0;
  }

  const { data: pcapRow } = await admin
    .from("offer_case_pliegos")
    .select("id")
    .eq("offer_case_id", offerCaseId)
    .eq("pliego_type", "pcap")
    .not("source_key", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const pcapId = pcapRow?.id ?? null;

  const { data: maxOrderRow } = await admin
    .from("offer_requirements")
    .select("sort_order")
    .eq("offer_case_id", offerCaseId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const baseOrder = maxOrderRow?.sort_order ?? 0;

  if (plan.requirements.length > 0) {
    const { data, error } = await admin
      .from("offer_requirements")
      .upsert(
        plan.requirements.map((r) => ({
          offer_case_id: offerCaseId,
          title: r.title,
          literal_text: r.literal_text,
          category: r.category,
          requirement_type: r.requirement_type,
          envelope: r.envelope,
          required_value: r.required_value,
          source_kind: "pliego_xml",
          source_key: r.source_key,
          pliego_id: r.from_pcap ? pcapId : null,
          sort_order: baseOrder + r.sort_order,
        })),
        { onConflict: "offer_case_id,source_key", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw new Error(error.message);
    stats.requirements = data?.length ?? 0;
  }

  // Padres antes que hijos (parent_key → parent_id).
  const parents = plan.deliverables.filter((d) => !d.parent_key);
  const children = plan.deliverables.filter((d) => d.parent_key);
  for (const batch of [parents, children]) {
    if (batch.length === 0) continue;
    const rows = [];
    for (const d of batch) {
      let parentId: string | null = null;
      if (d.parent_key) {
        const { data: parent } = await admin
          .from("offer_deliverables")
          .select("id")
          .eq("offer_case_id", offerCaseId)
          .eq("source_key", d.parent_key)
          .maybeSingle();
        parentId = parent?.id ?? null;
      }
      rows.push({
        offer_case_id: offerCaseId,
        parent_id: parentId,
        envelope: d.envelope,
        title: d.title,
        points_max: d.points_max,
        sort_order: d.sort_order,
        source_key: d.source_key,
      });
    }
    const { data, error } = await admin
      .from("offer_deliverables")
      .upsert(rows, {
        onConflict: "offer_case_id,source_key",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) throw new Error(error.message);
    stats.deliverables += data?.length ?? 0;
  }

  if (plan.milestones.length > 0) {
    const { data, error } = await admin
      .from("offer_milestones")
      .upsert(
        plan.milestones.map((m) => ({
          offer_case_id: offerCaseId,
          kind: "oficial",
          code: m.code,
          title: m.title,
          due_at: m.due_at.toISOString(),
          sort_order: m.sort_order,
          source_key: m.source_key,
        })),
        { onConflict: "offer_case_id,source_key", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw new Error(error.message);
    stats.milestones = data?.length ?? 0;
  }

  return stats;
}
