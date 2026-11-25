/**
 * Mis licitaciones — expediente de oferta (ADR 026 + 036, tablas offer_*).
 * Cliente autenticado + RLS is_app_user(); nunca service_role.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FavoriteKind } from "./favorite-kind";
import { asFavoriteKind } from "./favorite-kind";
import { requestOfferCaseIntake } from "./offer-intake";

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
] as const;

export type OfferStage = (typeof OFFER_STAGES)[number];

/** Mismo vocabulario que favoritos: propia = Eficen; subcontrata. */
export type OfferCaseKind = FavoriteKind;

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
};

type OfferCaseRow = Database["public"]["Tables"]["offer_cases"]["Row"];
type OfferRequirementRow =
  Database["public"]["Tables"]["offer_requirements"]["Row"];

export type OfferOwnerMember = {
  id: string;
  display_name: string;
  role_title: string | null;
  avatar_url: string | null;
};

export type OfferRequirementDetail = OfferRequirementRow & {
  owner_member: OfferOwnerMember | null;
};

export const OFFER_COMPLIANCE_STATUSES = [
  "cumple",
  "parcial",
  "no_cumple",
  "sin_verificar",
  "no_aplica",
] as const;

export type OfferComplianceStatus = (typeof OFFER_COMPLIANCE_STATUSES)[number];

export const OFFER_COMPLIANCE_LABELS: Record<OfferComplianceStatus, string> = {
  cumple: "Cumple",
  parcial: "Parcial",
  no_cumple: "No cumple",
  sin_verificar: "Sin verificar",
  no_aplica: "No aplica",
};

export const OFFER_PREP_STATUSES = [
  "pendiente",
  "en_curso",
  "en_revision",
  "listo",
  "bloqueado",
] as const;

export type OfferPrepStatus = (typeof OFFER_PREP_STATUSES)[number];

export const OFFER_PREP_LABELS: Record<OfferPrepStatus, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  en_revision: "En revisión",
  listo: "Listo",
  bloqueado: "Bloqueado",
};

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
  owner_member: OfferOwnerMember | null;
  requirements_total: number;
  requirements_ready: number;
  next_due_at: string | null;
};

export type OfferGoDecision = "go" | "no_go" | "pending";

export type OfferCaseDetail = OfferCaseRow & {
  tenders: OfferCaseTenderSummary | null;
  owner_member: OfferOwnerMember | null;
  requirements: OfferRequirementDetail[];
  /** Nombre de quien registró go/no-go (si hay go_decided_by). */
  go_decider_name: string | null;
};

export function asOfferGoDecision(
  raw: string | null | undefined,
): OfferGoDecision | null {
  if (raw === "go" || raw === "no_go" || raw === "pending") return raw;
  return null;
}

export const OFFER_MEMBER_ROLES = [
  "preparador",
  "revisor",
  "aprobador",
  "otro",
] as const;

export type OfferMemberRole = (typeof OFFER_MEMBER_ROLES)[number];

export const OFFER_MEMBER_ROLE_LABELS: Record<OfferMemberRole, string> = {
  preparador: "Preparador",
  revisor: "Revisor",
  aprobador: "Aprobador",
  otro: "Otro",
};

export type OfferCaseTeamMember = {
  id: string;
  member_id: string;
  member_role: OfferMemberRole;
  member: OfferOwnerMember;
};

function asOwnerMember(
  raw: OfferOwnerMember | OfferOwnerMember[] | null | undefined,
): OfferOwnerMember | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

function isHistoricStage(stage: string): boolean {
  return (HISTORIC_OFFER_STAGES as readonly string[]).includes(stage);
}

export function offerCaseHistoryYear(row: OfferCaseRow): number | null {
  const raw = row.outcome_on ?? row.presented_on ?? row.updated_at;
  if (!raw) return null;
  const y = Number.parseInt(String(raw).slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

export function asOfferCaseKind(
  raw: string | null | undefined,
): OfferCaseKind {
  return asFavoriteKind(raw) ?? "propia";
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
      kind,
      owner_member_id,
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
      owner_member:eficen_members!owner_member_id (
        id,
        display_name,
        role_title,
        avatar_url
      ),
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
      kind: row.kind,
      owner_member_id: row.owner_member_id,
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
      owner_member: asOwnerMember(
        row.owner_member as
          | OfferOwnerMember
          | OfferOwnerMember[]
          | null
          | undefined,
      ),
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
      kind,
      owner_member_id,
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
      owner_member:eficen_members!owner_member_id (
        id,
        display_name,
        role_title,
        avatar_url
      ),
      go_decider:users!go_decided_by (
        display_name
      ),
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
        owner_member_id,
        internal_due_at,
        pliego_ref,
        source_kind,
        source_key,
        pliego_id,
        sort_order,
        legacy_checklist_item_id,
        validated_by,
        validated_at,
        created_at,
        updated_at,
        owner_member:eficen_members!owner_member_id (
          id,
          display_name,
          role_title,
          avatar_url
        )
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

  const goDeciderRaw = (
    data as {
      go_decider?:
        | { display_name: string | null }
        | { display_name: string | null }[]
        | null;
    }
  ).go_decider;
  const goDecider = Array.isArray(goDeciderRaw)
    ? (goDeciderRaw[0] ?? null)
    : (goDeciderRaw ?? null);

  const requirements = (
    (data.offer_requirements ?? []) as Array<
      OfferRequirementRow & {
        owner_member?: OfferOwnerMember | OfferOwnerMember[] | null;
      }
    >
  )
    .slice()
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.created_at.localeCompare(b.created_at);
    })
    .map((row) => {
      const { owner_member: rawOwner, ...rest } = row;
      return {
        ...rest,
        owner_member: asOwnerMember(rawOwner),
      } satisfies OfferRequirementDetail;
    });

  return {
    data: {
      id: data.id,
      tender_id: data.tender_id,
      stage: data.stage,
      kind: data.kind,
      owner_member_id: data.owner_member_id,
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
      owner_member: asOwnerMember(
        data.owner_member as
          | OfferOwnerMember
          | OfferOwnerMember[]
          | null
          | undefined,
      ),
      go_decider_name: goDecider?.display_name?.trim() || null,
      tenders,
      requirements,
    },
    error: null,
  };
}

function asMemberRole(raw: string): OfferMemberRole {
  if ((OFFER_MEMBER_ROLES as readonly string[]).includes(raw)) {
    return raw as OfferMemberRole;
  }
  return "preparador";
}

export async function listOfferCaseMembers(
  client: SupabaseClient<Database>,
  offerCaseId: string,
): Promise<{ data: OfferCaseTeamMember[]; error: Error | null }> {
  const { data, error } = await client
    .from("offer_case_members")
    .select(
      `
      id,
      member_id,
      member_role,
      member:eficen_members!member_id (
        id,
        display_name,
        role_title,
        avatar_url
      )
    `,
    )
    .eq("offer_case_id", offerCaseId)
    .order("id", { ascending: true });

  if (error) return { data: [], error: new Error(error.message) };

  const rows: OfferCaseTeamMember[] = [];
  for (const row of data ?? []) {
    const member = asOwnerMember(
      row.member as OfferOwnerMember | OfferOwnerMember[] | null | undefined,
    );
    if (!member) continue;
    rows.push({
      id: row.id,
      member_id: row.member_id,
      member_role: asMemberRole(row.member_role),
      member,
    });
  }
  rows.sort((a, b) =>
    a.member.display_name.localeCompare(b.member.display_name, "es"),
  );
  return { data: rows, error: null };
}

export async function setOfferCaseOwner(
  client: SupabaseClient<Database>,
  input: { offerCaseId: string; ownerMemberId: string | null },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("offer_cases")
    .update({ owner_member_id: input.ownerMemberId })
    .eq("id", input.offerCaseId);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export const OFFER_LOG_EVENT_TYPES = [
  "alta_expediente",
  "stage_change",
  "go_decision",
  "aclaracion",
  "rectificacion",
  "ampliacion_plazo",
  "requerimiento",
  "subsanacion",
  "requirement_change",
  "comentario",
  "otro",
] as const;

export type OfferLogEventType = (typeof OFFER_LOG_EVENT_TYPES)[number];

/** Tipos que el usuario puede elegir al añadir una entrada manual. */
export const OFFER_LOG_MANUAL_EVENT_TYPES = [
  "comentario",
  "aclaracion",
  "rectificacion",
  "ampliacion_plazo",
  "requerimiento",
  "subsanacion",
  "otro",
] as const satisfies readonly OfferLogEventType[];

export const OFFER_LOG_EVENT_LABELS: Record<OfferLogEventType, string> = {
  alta_expediente: "Alta del expediente",
  stage_change: "Cambio de etapa",
  go_decision: "Decisión GO / NO-GO",
  aclaracion: "Aclaración",
  rectificacion: "Rectificación",
  ampliacion_plazo: "Ampliación de plazo",
  requerimiento: "Requerimiento",
  subsanacion: "Subsanación",
  requirement_change: "Cambio de requisito",
  comentario: "Comentario",
  otro: "Otro",
};

export type OfferCaseLogEntry = {
  id: string;
  offer_case_id: string;
  event_type: OfferLogEventType;
  body: string;
  happened_on: string;
  created_by: string | null;
  created_by_name: string | null;
  related_requirement_id: string | null;
  related_deliverable_id: string | null;
  created_at: string;
};

function asOfferLogEventType(value: string): OfferLogEventType {
  if ((OFFER_LOG_EVENT_TYPES as readonly string[]).includes(value)) {
    return value as OfferLogEventType;
  }
  return "otro";
}

function madridTodayIso(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Madrid",
  });
}

/** Inserta una entrada; no lanza — para auto-log best-effort. */
export async function insertOfferCaseLog(
  client: SupabaseClient<Database>,
  input: {
    offerCaseId: string;
    eventType: OfferLogEventType;
    body: string;
    createdBy: string | null;
    happenedOn?: string | null;
    relatedRequirementId?: string | null;
    relatedDeliverableId?: string | null;
  },
): Promise<{ error: Error | null }> {
  const body = input.body.trim();
  if (!body) {
    return { error: new Error("El texto de la bitácora es obligatorio.") };
  }
  const { error } = await client.from("offer_case_log").insert({
    offer_case_id: input.offerCaseId,
    event_type: input.eventType,
    body,
    happened_on: input.happenedOn?.trim() || madridTodayIso(),
    created_by: input.createdBy,
    related_requirement_id: input.relatedRequirementId ?? null,
    related_deliverable_id: input.relatedDeliverableId ?? null,
  });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function listOfferCaseLog(
  client: SupabaseClient<Database>,
  offerCaseId: string,
): Promise<{ data: OfferCaseLogEntry[]; error: Error | null }> {
  const { data, error } = await client
    .from("offer_case_log")
    .select(
      `
      id,
      offer_case_id,
      event_type,
      body,
      happened_on,
      created_by,
      related_requirement_id,
      related_deliverable_id,
      created_at,
      author:users!created_by (
        display_name
      )
    `,
    )
    .eq("offer_case_id", offerCaseId)
    .order("happened_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };

  const rows: OfferCaseLogEntry[] = (data ?? []).map((row) => {
    const authorRaw = (
      row as {
        author?:
          | { display_name: string | null }
          | { display_name: string | null }[]
          | null;
      }
    ).author;
    const author = Array.isArray(authorRaw)
      ? (authorRaw[0] ?? null)
      : (authorRaw ?? null);
    return {
      id: row.id,
      offer_case_id: row.offer_case_id,
      event_type: asOfferLogEventType(row.event_type),
      body: row.body,
      happened_on: row.happened_on,
      created_by: row.created_by,
      created_by_name: author?.display_name?.trim() || null,
      related_requirement_id: row.related_requirement_id,
      related_deliverable_id: row.related_deliverable_id,
      created_at: row.created_at,
    };
  });

  return { data: rows, error: null };
}

/** Interés → Análisis (ahí aparece el cuadro go/no-go). */
export async function advanceOfferCaseToAnalisis(
  client: SupabaseClient<Database>,
  input: { offerCaseId: string; createdBy: string | null },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("offer_cases")
    .update({ stage: "analisis" })
    .eq("id", input.offerCaseId)
    .eq("stage", "interes");
  if (error) return { error: new Error(error.message) };

  void insertOfferCaseLog(client, {
    offerCaseId: input.offerCaseId,
    eventType: "stage_change",
    body: "Paso de Interés a Análisis.",
    createdBy: input.createdBy,
  });

  return { error: null };
}

export async function setOfferCaseGoDecision(
  client: SupabaseClient<Database>,
  input: {
    offerCaseId: string;
    decision: "go" | "no_go";
    reason: string | null;
    decidedBy: string;
  },
): Promise<{ error: Error | null }> {
  const { data: current, error: readError } = await client
    .from("offer_cases")
    .select("preparation_started_on, outcome_on")
    .eq("id", input.offerCaseId)
    .maybeSingle();
  if (readError) return { error: new Error(readError.message) };

  const today = madridTodayIso();
  // Go cierra Análisis → preparación; no-go → histórico descartada.
  const nextStage = input.decision === "go" ? "preparacion" : "descartada";
  const patch =
    input.decision === "go"
      ? {
          go_decision: input.decision,
          go_reason: input.reason,
          go_decided_at: new Date().toISOString(),
          go_decided_by: input.decidedBy,
          stage: "preparacion" as const,
          preparation_started_on: current?.preparation_started_on ?? today,
        }
      : {
          go_decision: input.decision,
          go_reason: input.reason,
          go_decided_at: new Date().toISOString(),
          go_decided_by: input.decidedBy,
          stage: "descartada" as const,
          outcome_on: current?.outcome_on ?? today,
          discard_reason: input.reason,
        };

  const { error } = await client
    .from("offer_cases")
    .update(patch)
    .eq("id", input.offerCaseId);
  if (error) return { error: new Error(error.message) };

  const decisionLabel = input.decision === "go" ? "GO" : "NO-GO";
  const reasonSuffix = input.reason?.trim()
    ? ` Motivo: ${input.reason.trim()}`
    : "";
  void insertOfferCaseLog(client, {
    offerCaseId: input.offerCaseId,
    eventType: "go_decision",
    body: `Decisión ${decisionLabel}.${reasonSuffix}`,
    createdBy: input.decidedBy,
  });
  void insertOfferCaseLog(client, {
    offerCaseId: input.offerCaseId,
    eventType: "stage_change",
    body:
      nextStage === "preparacion"
        ? "Paso a En preparación tras GO."
        : "Paso a Descartada tras NO-GO.",
    createdBy: input.decidedBy,
  });

  return { error: null };
}

export const OFFER_ENVELOPES = [
  "A",
  "B",
  "C",
  "requerimiento",
  "ninguno",
] as const;

export type OfferEnvelope = (typeof OFFER_ENVELOPES)[number];

export async function updateOfferRequirement(
  client: SupabaseClient<Database>,
  input: {
    id: string;
    patch: {
      compliance_status?: OfferComplianceStatus;
      prep_status?: OfferPrepStatus;
      requirement_type?: OfferRequirementType;
      envelope?: OfferEnvelope | null;
      internal_due_at?: string | null;
      owner_member_id?: string | null;
      /** Estimación / valor propio (p. ej. puntos esperados en un criterio). */
      our_value?: string | null;
    };
  },
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("offer_requirements")
    .update(input.patch)
    .eq("id", input.id);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export const OFFER_REQUIREMENT_TYPES = [
  "excluyente",
  "puntuable",
  "informativo",
] as const;

export type OfferRequirementType = (typeof OFFER_REQUIREMENT_TYPES)[number];

/** Alta manual de un requisito en el expediente. */
export async function createOfferRequirement(
  client: SupabaseClient<Database>,
  input: {
    offerCaseId: string;
    title: string;
    requirement_type?: OfferRequirementType;
    category?: string;
    compliance_status?: OfferComplianceStatus;
    prep_status?: OfferPrepStatus;
    envelope?: OfferEnvelope | null;
    owner_member_id?: string | null;
    internal_due_at?: string | null;
    required_value?: string | null;
    sort_order?: number;
  },
): Promise<{ data: { id: string } | null; error: Error | null }> {
  const title = input.title.trim();
  if (!title) {
    return { data: null, error: new Error("El título del requisito es obligatorio.") };
  }
  if (!input.requirement_type) {
    return { data: null, error: new Error("El tipo es obligatorio.") };
  }
  if (!input.category?.trim()) {
    return { data: null, error: new Error("La categoría es obligatoria.") };
  }

  const requiredValue = input.required_value?.trim() || null;

  const { data, error } = await client
    .from("offer_requirements")
    .insert({
      offer_case_id: input.offerCaseId,
      title,
      requirement_type: input.requirement_type,
      category: input.category.trim(),
      compliance_status: input.compliance_status ?? "sin_verificar",
      prep_status: input.prep_status ?? "pendiente",
      envelope: input.envelope ?? "ninguno",
      owner_member_id: input.owner_member_id ?? null,
      internal_due_at: input.internal_due_at ?? null,
      required_value: requiredValue,
      source_kind: "manual",
      sort_order: input.sort_order ?? 0,
    })
    .select("id")
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data ? { id: data.id } : null, error: null };
}

/** Baja de uno o varios requisitos del expediente. */
export async function deleteOfferRequirements(
  client: SupabaseClient<Database>,
  input: { offerCaseId: string; ids: string[] },
): Promise<{ error: Error | null }> {
  const ids = [...new Set(input.ids.filter(Boolean))];
  if (ids.length === 0) return { error: null };

  const { error } = await client
    .from("offer_requirements")
    .delete()
    .eq("offer_case_id", input.offerCaseId)
    .in("id", ids);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function addOfferCaseMember(
  client: SupabaseClient<Database>,
  input: {
    offerCaseId: string;
    memberId: string;
    memberRole?: OfferMemberRole;
  },
): Promise<{ data: { id: string } | null; error: Error | null }> {
  const { data, error } = await client
    .from("offer_case_members")
    .insert({
      offer_case_id: input.offerCaseId,
      member_id: input.memberId,
      member_role: input.memberRole ?? "preparador",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { data: null, error: new Error("Esa persona ya está en el equipo") };
    }
    return { data: null, error: new Error(error.message) };
  }
  return { data: { id: data.id }, error: null };
}

export async function removeOfferCaseMember(
  client: SupabaseClient<Database>,
  membershipId: string,
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from("offer_case_members")
    .delete()
    .eq("id", membershipId);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function createOfferCase(
  client: SupabaseClient<Database>,
  input: {
    tenderId: string;
    createdBy: string;
    /** Si no viene (p. ej. sin favorito), default propia (= Eficen). */
    kind?: OfferCaseKind | null;
  },
): Promise<{ data: { id: string } | null; error: Error | null }> {
  const kind = asOfferCaseKind(input.kind);
  const { data, error } = await client
    .from("offer_cases")
    .insert({
      tender_id: input.tenderId,
      created_by: input.createdBy,
      owner_member_id: null,
      kind,
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

  void insertOfferCaseLog(client, {
    offerCaseId: data.id,
    eventType: "alta_expediente",
    body: "Añadida a Mis licitaciones (etapa Interés).",
    createdBy: input.createdBy,
  });

  // Best effort: si falla, el expediente existe y se puede reprocesar desde Pliegos.
  await requestOfferCaseIntake(client, {
    offerCaseId: data.id,
    requestedBy: input.createdBy,
  });

  return { data: { id: data.id }, error: null };
}

export const OFFER_TASK_STATUSES = [
  "pendiente",
  "hecha",
  "descartada",
] as const;

export type OfferTaskStatus = (typeof OFFER_TASK_STATUSES)[number];

export const OFFER_TASK_STATUS_LABELS: Record<OfferTaskStatus, string> = {
  pendiente: "Pendiente",
  hecha: "Hecha",
  descartada: "Descartada",
};

export function asOfferTaskStatus(
  raw: string | null | undefined,
): OfferTaskStatus {
  if (raw === "hecha" || raw === "descartada" || raw === "pendiente") {
    return raw;
  }
  return "pendiente";
}

export type OfferTaskItem = {
  id: string;
  offer_case_id: string;
  title: string | null;
  owner_member_id: string | null;
  owner_member: OfferOwnerMember | null;
  due_at: string | null;
  status: OfferTaskStatus;
  notes: string;
  created_by: string | null;
};

export async function listOfferTasks(
  client: SupabaseClient<Database>,
  offerCaseId: string,
): Promise<{ data: OfferTaskItem[]; error: Error | null }> {
  const { data, error } = await client
    .from("offer_tasks")
    .select(
      `
      id,
      offer_case_id,
      title,
      owner_member_id,
      due_at,
      status,
      notes,
      created_by,
      owner_member:eficen_members!owner_member_id (
        id,
        display_name,
        role_title,
        avatar_url
      )
    `,
    )
    .eq("offer_case_id", offerCaseId);

  if (error) return { data: [], error: new Error(error.message) };

  const statusRank: Record<OfferTaskStatus, number> = {
    pendiente: 0,
    hecha: 1,
    descartada: 2,
  };

  const rows: OfferTaskItem[] = (data ?? []).map((row) => ({
    id: row.id,
    offer_case_id: row.offer_case_id,
    title: row.title,
    owner_member_id: row.owner_member_id,
    owner_member: asOwnerMember(
      row.owner_member as
        | OfferOwnerMember
        | OfferOwnerMember[]
        | null
        | undefined,
    ),
    due_at: row.due_at,
    status: asOfferTaskStatus(row.status),
    notes: row.notes ?? "",
    created_by: row.created_by,
  }));

  rows.sort((a, b) => {
    const byStatus = statusRank[a.status] - statusRank[b.status];
    if (byStatus !== 0) return byStatus;
    const aDue = a.due_at
      ? new Date(a.due_at).getTime()
      : Number.POSITIVE_INFINITY;
    const bDue = b.due_at
      ? new Date(b.due_at).getTime()
      : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;
    const aLabel = (a.title?.trim() || a.notes).toLocaleLowerCase("es");
    const bLabel = (b.title?.trim() || b.notes).toLocaleLowerCase("es");
    return aLabel.localeCompare(bLabel, "es");
  });

  return { data: rows, error: null };
}

export async function createOfferTask(
  client: SupabaseClient<Database>,
  input: {
    offerCaseId: string;
    title: string | null;
    ownerMemberId: string | null;
    dueAt: string | null;
    notes: string;
    createdBy: string;
  },
): Promise<{ data: { id: string } | null; error: Error | null }> {
  const notes = input.notes.trim();
  if (!notes) {
    return {
      data: null,
      error: new Error("La descripción de la tarea es obligatoria."),
    };
  }
  const title = input.title?.trim() || null;
  const { data, error } = await client
    .from("offer_tasks")
    .insert({
      offer_case_id: input.offerCaseId,
      title,
      owner_member_id: input.ownerMemberId,
      due_at: input.dueAt,
      notes,
      status: "pendiente",
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: { id: data.id }, error: null };
}

export async function updateOfferTask(
  client: SupabaseClient<Database>,
  input: {
    id: string;
    patch: {
      title?: string | null;
      owner_member_id?: string | null;
      due_at?: string | null;
      notes?: string;
      status?: OfferTaskStatus;
    };
  },
): Promise<{ error: Error | null }> {
  const patch: {
    title?: string | null;
    owner_member_id?: string | null;
    due_at?: string | null;
    notes?: string;
    status?: OfferTaskStatus;
  } = { ...input.patch };
  if (patch.title !== undefined) {
    patch.title = patch.title?.trim() || null;
  }
  if (patch.notes !== undefined) {
    const notes = patch.notes.trim();
    if (!notes) {
      return { error: new Error("La descripción de la tarea es obligatoria.") };
    }
    patch.notes = notes;
  }
  const { error } = await client
    .from("offer_tasks")
    .update(patch)
    .eq("id", input.id);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export async function deleteOfferTask(
  client: SupabaseClient<Database>,
  id: string,
): Promise<{ error: Error | null }> {
  const { error } = await client.from("offer_tasks").delete().eq("id", id);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}
