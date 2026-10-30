/**
 * Mis licitaciones — pipeline compartido Eficen (ADR 023).
 * Cliente autenticado + RLS is_app_user(); nunca service_role.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const BID_STAGES = [
  "interes",
  "preparacion",
  "presentada",
  "adjudicada",
  "no_adjudicada",
  "descartada",
] as const;

export type BidStage = (typeof BID_STAGES)[number];

export const ACTIVE_BID_STAGES = [
  "interes",
  "preparacion",
  "presentada",
] as const satisfies readonly BidStage[];

export const HISTORIC_BID_STAGES = [
  "adjudicada",
  "no_adjudicada",
  "descartada",
] as const satisfies readonly BidStage[];

export const BID_STAGE_LABELS: Record<BidStage, string> = {
  interes: "Interés",
  preparacion: "En preparación",
  presentada: "Presentada",
  adjudicada: "Adjudicada",
  no_adjudicada: "No adjudicada",
  descartada: "Descartada",
};

export const DEFAULT_CHECKLIST_TITLES = [
  "Pliego leído y anotado",
  "Solvencia económica",
  "Solvencia técnica",
  "Oferta técnica",
  "Oferta económica",
  "Documentación administrativa",
  "Garantía provisional (si aplica)",
] as const;

type BidCaseRow = Database["public"]["Tables"]["bid_cases"]["Row"];
type ChecklistRow = Database["public"]["Tables"]["bid_case_checklist_items"]["Row"];
type UpdateRow = Database["public"]["Tables"]["bid_case_updates"]["Row"];
type DocumentRow = Database["public"]["Tables"]["bid_documents"]["Row"];

export type BidCaseTenderSummary = {
  id: string;
  title: string;
  status: string | null;
  estimated_value: number | null;
  currency: string;
  publication_date: string | null;
  deadline_at: string | null;
};

export type BidCaseListItem = BidCaseRow & {
  tenders: BidCaseTenderSummary | null;
  checklist_total: number;
  checklist_done: number;
  next_due_at: string | null;
};

export type BidCaseDetail = BidCaseRow & {
  tenders: BidCaseTenderSummary | null;
  checklist: ChecklistRow[];
  updates: UpdateRow[];
  documents: DocumentRow[];
};

function isHistoricStage(stage: string): boolean {
  return (HISTORIC_BID_STAGES as readonly string[]).includes(stage);
}

/** Año de histórico: outcome → presented → updated. */
export function bidCaseHistoryYear(row: BidCaseRow): number | null {
  const raw = row.outcome_on ?? row.presented_on ?? row.updated_at;
  if (!raw) return null;
  const y = Number.parseInt(String(raw).slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

export async function getBidCaseIdByTenderId(
  client: SupabaseClient<Database>,
  tenderId: string,
): Promise<{ data: string | null; error: Error | null }> {
  const { data, error } = await client
    .from("bid_cases")
    .select("id")
    .eq("tender_id", tenderId)
    .maybeSingle();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data?.id ?? null, error: null };
}

export async function listBidCases(
  client: SupabaseClient<Database>,
  opts?: { scope?: "active" | "historic" | "all"; year?: number },
): Promise<{ data: BidCaseListItem[]; error: Error | null }> {
  const scope = opts?.scope ?? "active";

  const { data, error } = await client
    .from("bid_cases")
    .select(
      `
      id,
      tender_id,
      stage,
      owner_name,
      preparation_started_on,
      presented_on,
      outcome_on,
      notes,
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
      bid_case_checklist_items (
        id,
        due_at,
        done_at
      )
    `,
    )
    .order("updated_at", { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };

  const now = Date.now();
  let rows: BidCaseListItem[] = (data ?? []).map((row) => {
    const items = (row.bid_case_checklist_items ?? []) as {
      id: string;
      due_at: string | null;
      done_at: string | null;
    }[];
    const pendingDue = items
      .filter((i) => !i.done_at && i.due_at)
      .map((i) => i.due_at as string)
      .sort();
    const tender = row.tenders as BidCaseTenderSummary | BidCaseTenderSummary[] | null;
    const tenders = Array.isArray(tender) ? (tender[0] ?? null) : tender;
    return {
      id: row.id,
      tender_id: row.tender_id,
      stage: row.stage,
      owner_name: row.owner_name,
      preparation_started_on: row.preparation_started_on,
      presented_on: row.presented_on,
      outcome_on: row.outcome_on,
      notes: row.notes,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      tenders,
      checklist_total: items.length,
      checklist_done: items.filter((i) => i.done_at).length,
      next_due_at: pendingDue[0] ?? null,
    };
  });

  if (scope === "active") {
    rows = rows.filter((r) => !isHistoricStage(r.stage));
  } else if (scope === "historic") {
    rows = rows.filter((r) => isHistoricStage(r.stage));
    if (opts?.year != null) {
      rows = rows.filter((r) => bidCaseHistoryYear(r) === opts.year);
    }
  }

  // Activas: las con deadline/due más cercanos primero, luego updated.
  if (scope === "active") {
    rows.sort((a, b) => {
      const aDue = a.next_due_at ?? a.tenders?.deadline_at ?? null;
      const bDue = b.next_due_at ?? b.tenders?.deadline_at ?? null;
      if (aDue && bDue) {
        return new Date(aDue).getTime() - new Date(bDue).getTime();
      }
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }

  void now;
  return { data: rows, error: null };
}

export async function listBidCaseHistoryYears(
  client: SupabaseClient<Database>,
): Promise<{ data: number[]; error: Error | null }> {
  const { data, error } = await listBidCases(client, { scope: "historic" });
  if (error) return { data: [], error };
  const years = new Set<number>();
  for (const row of data) {
    const y = bidCaseHistoryYear(row);
    if (y != null) years.add(y);
  }
  return { data: [...years].sort((a, b) => b - a), error: null };
}

export async function getBidCaseById(
  client: SupabaseClient<Database>,
  id: string,
): Promise<{ data: BidCaseDetail | null; error: Error | null }> {
  const { data, error } = await client
    .from("bid_cases")
    .select(
      `
      id,
      tender_id,
      stage,
      owner_name,
      preparation_started_on,
      presented_on,
      outcome_on,
      notes,
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
      bid_case_checklist_items (
        id,
        bid_case_id,
        title,
        due_at,
        done_at,
        sort_order,
        created_at
      ),
      bid_case_updates (
        id,
        bid_case_id,
        body,
        happened_on,
        created_by,
        created_at
      ),
      bid_case_documents (
        document_id,
        bid_documents (
          id,
          title,
          url,
          tags,
          notes,
          created_by,
          created_at,
          updated_at
        )
      )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: null };

  const tender = data.tenders as BidCaseTenderSummary | BidCaseTenderSummary[] | null;
  const tenders = Array.isArray(tender) ? (tender[0] ?? null) : tender;

  const checklist = (
    (data.bid_case_checklist_items ?? []) as ChecklistRow[]
  ).slice().sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.created_at.localeCompare(b.created_at);
  });

  const updates = ((data.bid_case_updates ?? []) as UpdateRow[])
    .slice()
    .sort((a, b) => {
      const d = b.happened_on.localeCompare(a.happened_on);
      if (d !== 0) return d;
      return b.created_at.localeCompare(a.created_at);
    });

  const documents = (
    (data.bid_case_documents ?? []) as {
      document_id: string;
      bid_documents: DocumentRow | DocumentRow[] | null;
    }[]
  )
    .map((link) => {
      const doc = link.bid_documents;
      return Array.isArray(doc) ? (doc[0] ?? null) : doc;
    })
    .filter((d): d is DocumentRow => Boolean(d));

  return {
    data: {
      id: data.id,
      tender_id: data.tender_id,
      stage: data.stage,
      owner_name: data.owner_name,
      preparation_started_on: data.preparation_started_on,
      presented_on: data.presented_on,
      outcome_on: data.outcome_on,
      notes: data.notes,
      created_by: data.created_by,
      created_at: data.created_at,
      updated_at: data.updated_at,
      tenders,
      checklist,
      updates,
      documents,
    },
    error: null,
  };
}

export async function createBidCase(
  client: SupabaseClient<Database>,
  input: {
    tenderId: string;
    createdBy: string;
    ownerName?: string | null;
    withDefaultChecklist?: boolean;
  },
): Promise<{ data: { id: string } | null; error: Error | null }> {
  const { data, error } = await client
    .from("bid_cases")
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
    // unique tender_id → ya existe
    if (error.code === "23505") {
      const existing = await getBidCaseIdByTenderId(client, input.tenderId);
      if (existing.data) return { data: { id: existing.data }, error: null };
    }
    return { data: null, error: new Error(error.message) };
  }

  if (input.withDefaultChecklist !== false && data) {
    const rows = DEFAULT_CHECKLIST_TITLES.map((title, i) => ({
      bid_case_id: data.id,
      title,
      sort_order: i,
    }));
    const { error: checkError } = await client
      .from("bid_case_checklist_items")
      .insert(rows);
    if (checkError) {
      return { data: { id: data.id }, error: new Error(checkError.message) };
    }
  }

  return { data: { id: data.id }, error: null };
}

export async function updateBidCase(
  client: SupabaseClient<Database>,
  id: string,
  patch: Database["public"]["Tables"]["bid_cases"]["Update"],
): Promise<{ error: Error | null }> {
  const { error } = await client.from("bid_cases").update(patch).eq("id", id);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function deleteBidCase(
  client: SupabaseClient<Database>,
  id: string,
): Promise<{ error: Error | null }> {
  const { error } = await client.from("bid_cases").delete().eq("id", id);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function addChecklistItem(
  client: SupabaseClient<Database>,
  input: {
    bidCaseId: string;
    title: string;
    dueAt?: string | null;
    sortOrder?: number;
  },
): Promise<{ data: ChecklistRow | null; error: Error | null }> {
  const { data, error } = await client
    .from("bid_case_checklist_items")
    .insert({
      bid_case_id: input.bidCaseId,
      title: input.title.trim(),
      due_at: input.dueAt ?? null,
      sort_order: input.sortOrder ?? 100,
    })
    .select("*")
    .single();
  if (error) return { data: null, error: new Error(error.message) };
  return { data, error: null };
}

export async function setChecklistItemDone(
  client: SupabaseClient<Database>,
  id: string,
  done: boolean,
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("bid_case_checklist_items")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function updateChecklistItem(
  client: SupabaseClient<Database>,
  id: string,
  patch: Database["public"]["Tables"]["bid_case_checklist_items"]["Update"],
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("bid_case_checklist_items")
    .update(patch)
    .eq("id", id);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function deleteChecklistItem(
  client: SupabaseClient<Database>,
  id: string,
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("bid_case_checklist_items")
    .delete()
    .eq("id", id);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function addBidCaseUpdate(
  client: SupabaseClient<Database>,
  input: {
    bidCaseId: string;
    body: string;
    happenedOn?: string;
    createdBy?: string | null;
  },
): Promise<{ data: UpdateRow | null; error: Error | null }> {
  const { data, error } = await client
    .from("bid_case_updates")
    .insert({
      bid_case_id: input.bidCaseId,
      body: input.body.trim(),
      happened_on: input.happenedOn,
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();
  if (error) return { data: null, error: new Error(error.message) };
  return { data, error: null };
}

export async function deleteBidCaseUpdate(
  client: SupabaseClient<Database>,
  id: string,
): Promise<{ error: Error | null }> {
  const { error } = await client.from("bid_case_updates").delete().eq("id", id);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function listBidDocuments(
  client: SupabaseClient<Database>,
): Promise<{ data: DocumentRow[]; error: Error | null }> {
  const { data, error } = await client
    .from("bid_documents")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) return { data: [], error: new Error(error.message) };
  return { data: data ?? [], error: null };
}

export async function createBidDocument(
  client: SupabaseClient<Database>,
  input: {
    title: string;
    url?: string | null;
    tags?: string[];
    notes?: string | null;
    createdBy?: string | null;
    linkToCaseId?: string | null;
  },
): Promise<{ data: DocumentRow | null; error: Error | null }> {
  const tags = (input.tags ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const { data, error } = await client
    .from("bid_documents")
    .insert({
      title: input.title.trim(),
      url: input.url?.trim() || null,
      tags,
      notes: input.notes?.trim() || null,
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();
  if (error) return { data: null, error: new Error(error.message) };

  if (input.linkToCaseId && data) {
    const { error: linkError } = await client
      .from("bid_case_documents")
      .insert({ bid_case_id: input.linkToCaseId, document_id: data.id });
    if (linkError) return { data, error: new Error(linkError.message) };
  }

  return { data, error: null };
}

export async function linkDocumentToCase(
  client: SupabaseClient<Database>,
  input: { bidCaseId: string; documentId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client.from("bid_case_documents").upsert({
    bid_case_id: input.bidCaseId,
    document_id: input.documentId,
  });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function unlinkDocumentFromCase(
  client: SupabaseClient<Database>,
  input: { bidCaseId: string; documentId: string },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("bid_case_documents")
    .delete()
    .eq("bid_case_id", input.bidCaseId)
    .eq("document_id", input.documentId);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}
