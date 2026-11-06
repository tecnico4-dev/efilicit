/**
 * Mis licitaciones — expediente de oferta (ADR 026, tablas offer_*).
 * Cliente autenticado + RLS is_app_user(); nunca service_role.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const OFFER_STAGES = [
  "interes",
  "analisis",
  "preparacion",
  "presentada",
  "en_evaluacion",
  "requerimiento",
  "adjudicada",
  "no_adjudicada",
  "descartada",
  "subcontrata",
  "desierta",
] as const;

export type OfferStage = (typeof OFFER_STAGES)[number];

export const ACTIVE_OFFER_STAGES = [
  "interes",
  "analisis",
  "preparacion",
  "presentada",
  "en_evaluacion",
  "requerimiento",
] as const satisfies readonly OfferStage[];

export const HISTORIC_OFFER_STAGES = [
  "adjudicada",
  "no_adjudicada",
  "descartada",
  "subcontrata",
  "desierta",
] as const satisfies readonly OfferStage[];

export const OFFER_STAGE_LABELS: Record<OfferStage, string> = {
  interes: "Interés",
  analisis: "Análisis / Go-No go",
  preparacion: "En preparación",
  presentada: "Presentada",
  en_evaluacion: "En evaluación",
  requerimiento: "Requerimiento",
  adjudicada: "Adjudicada",
  no_adjudicada: "No adjudicada",
  descartada: "Descartada",
  subcontrata: "Subcontrata",
  desierta: "Desierta",
};

type OfferCaseRow = Database["public"]["Tables"]["offer_cases"]["Row"];
type OfferRequirementRow =
  Database["public"]["Tables"]["offer_requirements"]["Row"];

export type OfferCaseTenderSummary = {
  id: string;
  title: string;
  status: string | null;
  estimated_value: number | null;
  currency: string;
  publication_date: string | null;
  deadline_at: string | null;
};

export type OfferCaseListItem = OfferCaseRow & {
  tenders: OfferCaseTenderSummary | null;
  requirements_total: number;
  requirements_ready: number;
  next_due_at: string | null;
};

export type OfferCaseDetail = OfferCaseRow & {
  tenders: OfferCaseTenderSummary | null;
  requirements: OfferRequirementRow[];
};

function isHistoricStage(stage: string): boolean {
  return (HISTORIC_OFFER_STAGES as readonly string[]).includes(stage);
}

export function offerCaseHistoryYear(row: OfferCaseRow): number | null {
  const raw = row.outcome_on ?? row.presented_on ?? row.updated_at;
  if (!raw) return null;
  const y = Number.parseInt(String(raw).slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

export async function getOfferCaseIdByTenderId(
  client: SupabaseClient<Database>,
  tenderId: string,
): Promise<{ data: string | null; error: Error | null }> {
  const { data, error } = await client
    .from("offer_cases")
    .select("id")
    .eq("tender_id", tenderId)
    .maybeSingle();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data?.id ?? null, error: null };
}

export async function listOfferCases(
  client: SupabaseClient<Database>,
  opts?: { scope?: "active" | "historic" | "all"; year?: number },
): Promise<{ data: OfferCaseListItem[]; error: Error | null }> {
  const scope = opts?.scope ?? "active";

  const { data, error } = await client
    .from("offer_cases")
    .select(
      `
      id,
      tender_id,
      stage,
      owner_name,
      owner_user_id,
      preparation_started_on,
      presented_on,
      outcome_on,
      internal_deadline_at,
      notes,
      go_decision,
      go_decided_at,
      go_decided_by,
      go_reason,
      discard_reason,
      legacy_bid_case_id,
      target_lots,
      created_by,
      created_at,
      updated_at,
      tenders (
        id,
        title,
        status,
        estimated_value,
        currency,
        publication_date,
        deadline_at
      ),
      offer_requirements (
        id,
        prep_status,
        internal_due_at
      )
    `,
    )
    .order("updated_at", { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };

  let rows: OfferCaseListItem[] = (data ?? []).map((row) => {
    const items = (row.offer_requirements ?? []) as {
      id: string;
      prep_status: string;
      internal_due_at: string | null;
    }[];
    const pendingDue = items
      .filter((i) => i.prep_status !== "listo" && i.internal_due_at)
      .map((i) => i.internal_due_at as string)
      .sort();
    const tender =
      row.tenders as OfferCaseTenderSummary | OfferCaseTenderSummary[] | null;
    const tenders = Array.isArray(tender) ? (tender[0] ?? null) : tender;
    return {
      id: row.id,
      tender_id: row.tender_id,
      stage: row.stage,
      owner_name: row.owner_name,
      owner_user_id: row.owner_user_id,
      preparation_started_on: row.preparation_started_on,
      presented_on: row.presented_on,
      outcome_on: row.outcome_on,
      internal_deadline_at: row.internal_deadline_at,
      notes: row.notes,
      go_decision: row.go_decision,
      go_decided_at: row.go_decided_at,
      go_decided_by: row.go_decided_by,
      go_reason: row.go_reason,
      discard_reason: row.discard_reason,
      legacy_bid_case_id: row.legacy_bid_case_id,
      target_lots: row.target_lots,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      tenders,
      requirements_total: items.length,
      requirements_ready: items.filter((i) => i.prep_status === "listo").length,
      next_due_at: pendingDue[0] ?? null,
    };
  });

  if (scope === "active") {
    rows = rows.filter((r) => !isHistoricStage(r.stage));
  } else if (scope === "historic") {
    rows = rows.filter((r) => isHistoricStage(r.stage));
    if (opts?.year != null) {
      rows = rows.filter((r) => offerCaseHistoryYear(r) === opts.year);
    }
  }

  if (scope === "active") {
    rows.sort((a, b) => {
      const aDue =
        a.next_due_at ?? a.internal_deadline_at ?? a.tenders?.deadline_at ?? null;
      const bDue =
        b.next_due_at ?? b.internal_deadline_at ?? b.tenders?.deadline_at ?? null;
      if (aDue && bDue) {
        return new Date(aDue).getTime() - new Date(bDue).getTime();
      }
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }

  return { data: rows, error: null };
}

export async function listOfferCaseHistoryYears(
  client: SupabaseClient<Database>,
): Promise<{ data: number[]; error: Error | null }> {
  const { data, error } = await listOfferCases(client, { scope: "historic" });
  if (error) return { data: [], error };
  const years = new Set<number>();
  for (const row of data) {
    const y = offerCaseHistoryYear(row);
    if (y != null) years.add(y);
  }
  return { data: [...years].sort((a, b) => b - a), error: null };
}

export async function getOfferCaseById(
  client: SupabaseClient<Database>,
  id: string,
): Promise<{ data: OfferCaseDetail | null; error: Error | null }> {
  const { data, error } = await client
    .from("offer_cases")
    .select(
      `
      id,
      tender_id,
      stage,
      owner_name,
      owner_user_id,
      preparation_started_on,
      presented_on,
      outcome_on,
      internal_deadline_at,
      notes,
      go_decision,
      go_decided_at,
      go_decided_by,
      go_reason,
      discard_reason,
      legacy_bid_case_id,
      target_lots,
      created_by,
      created_at,
      updated_at,
      tenders (
        id,
        title,
        status,
        estimated_value,
        currency,
        publication_date,
        deadline_at
      ),
      offer_requirements (
        id,
        offer_case_id,
        title,
        literal_text,
        category,
        requirement_type,
        required_value,
        our_value,
        compliance_status,
        prep_status,
        envelope,
        owner_user_id,
        owner_name,
        internal_due_at,
        pliego_ref,
        source_kind,
        sort_order,
        legacy_checklist_item_id,
        validated_by,
        validated_at,
        created_at,
        updated_at
      )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: null };

  const tender =
    data.tenders as OfferCaseTenderSummary | OfferCaseTenderSummary[] | null;
  const tenders = Array.isArray(tender) ? (tender[0] ?? null) : tender;

  const requirements = (
    (data.offer_requirements ?? []) as OfferRequirementRow[]
  )
    .slice()
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.created_at.localeCompare(b.created_at);
    });

  return {
    data: {
      id: data.id,
      tender_id: data.tender_id,
      stage: data.stage,
      owner_name: data.owner_name,
      owner_user_id: data.owner_user_id,
      preparation_started_on: data.preparation_started_on,
      presented_on: data.presented_on,
      outcome_on: data.outcome_on,
      internal_deadline_at: data.internal_deadline_at,
      notes: data.notes,
      go_decision: data.go_decision,
      go_decided_at: data.go_decided_at,
      go_decided_by: data.go_decided_by,
      go_reason: data.go_reason,
      discard_reason: data.discard_reason,
      legacy_bid_case_id: data.legacy_bid_case_id,
      target_lots: data.target_lots,
      created_by: data.created_by,
      created_at: data.created_at,
      updated_at: data.updated_at,
      tenders,
      requirements,
    },
    error: null,
  };
}

export async function createOfferCase(
  client: SupabaseClient<Database>,
  input: {
    tenderId: string;
    createdBy: string;
    ownerName?: string | null;
  },
): Promise<{ data: { id: string } | null; error: Error | null }> {
  const { data, error } = await client
    .from("offer_cases")
    .insert({
      tender_id: input.tenderId,
      created_by: input.createdBy,
      owner_name: input.ownerName ?? null,
      stage: "interes",
      preparation_started_on: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const existing = await getOfferCaseIdByTenderId(client, input.tenderId);
      if (existing.data) return { data: { id: existing.data }, error: null };
    }
    return { data: null, error: new Error(error.message) };
  }

  return { data: { id: data.id }, error: null };
}
