/**
 * Mapeo puro OfferIntakeExtract → filas offer_* (ADR 035).
 * Port server-only de `efilicit_ingestion.offer_intake.plan`.
 */
import type {
  OfferAwardingCriterion,
  OfferDocumentRef,
  OfferExecutionRequirement,
  OfferGuarantee,
  OfferIntakeExtract,
  OfferQualification,
} from "./placsp-terms";

export const TITLE_MAX = 160;

const CRITERION_NUMBERED_SUFFIX =
  /^([\s\S]+?)[.\-]\s*(\d+[.\-]?\s*[\s\S]+)$/;

const QUALIFICATION_CATEGORY: Record<
  OfferQualification["kind"],
  string
> = {
  solvencia_tecnica: "solvencia_tecnica",
  solvencia_economica: "solvencia_economica",
  clasificacion: "clasificacion",
  declaracion: "habilitacion",
};

const QUALIFICATION_LABEL: Record<OfferQualification["kind"], string> = {
  solvencia_tecnica: "Solvencia técnica",
  solvencia_economica: "Solvencia económica",
  clasificacion: "Clasificación",
  declaracion: "Declaración",
};

const GUARANTEE_LABEL: Record<OfferGuarantee["kind"], string> = {
  provisional: "Garantía provisional",
  definitiva: "Garantía definitiva",
  complementaria: "Garantía complementaria",
  otra: "Garantía",
};

const EXECUTION_LABEL: Record<OfferExecutionRequirement["kind"], string> = {
  social: "Condición de ejecución · social",
  medioambiental: "Condición de ejecución · medioambiental",
  otra: "Condición de ejecución",
};

const ENVELOPE_TITLES: Record<string, string> = {
  A: "Sobre A · Documentación administrativa",
  B: "Sobre B · Criterios sujetos a juicio de valor",
  C: "Sobre C · Criterios evaluables mediante fórmulas",
};

export type PliegoRow = {
  source_key: string;
  pliego_type: string;
  title: string;
  url: string;
  source_uri: string;
  source_hash: string | null;
  downloadable: boolean;
  initial_fetch_status: "pendiente" | "solo_enlace";
};

export type RequirementRow = {
  source_key: string;
  title: string;
  literal_text: string | null;
  category: string;
  requirement_type: string;
  envelope: string | null;
  required_value: string | null;
  sort_order: number;
  from_pcap: boolean;
};

export type DeliverableRow = {
  source_key: string;
  title: string;
  envelope: string | null;
  points_max: number | null;
  sort_order: number;
  parent_key: string | null;
};

export type MilestoneRow = {
  source_key: string;
  code: string;
  title: string;
  due_at: Date;
  sort_order: number;
};

export type IntakePlan = {
  pliegos: PliegoRow[];
  requirements: RequirementRow[];
  deliverables: DeliverableRow[];
  milestones: MilestoneRow[];
};

export function targetLotIds(targetLots: unknown): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(targetLots)) return out;
  for (const item of targetLots) {
    const value =
      item && typeof item === "object" && "id" in item
        ? (item as { id: unknown }).id
        : item;
    if (value != null && String(value).trim()) {
      out.add(String(value).trim());
    }
  }
  return out;
}

export function buildIntakePlan(
  extract: OfferIntakeExtract,
  targetLots: Iterable<string> = [],
): IntakePlan {
  const lots = new Set(targetLots);

  function inScope(lotId: string | null): boolean {
    return lotId == null || lots.size === 0 || lots.has(lotId);
  }

  const plan: IntakePlan = {
    pliegos: extract.documents.map(pliegoRow),
    requirements: [],
    deliverables: [],
    milestones: [],
  };

  const qualifications = extract.qualifications.filter((q) => inScope(q.lot_id));
  const criteriaList = extract.criteria.filter((c) => inScope(c.lot_id));
  const executions = extract.execution_requirements.filter((e) =>
    inScope(e.lot_id),
  );

  let order = 0;
  for (const q of qualifications) {
    order += 1;
    plan.requirements.push(qualificationRow(q, order));
  }
  for (const g of extract.guarantees) {
    order += 1;
    plan.requirements.push(guaranteeRow(g, order));
  }
  for (const e of executions) {
    order += 1;
    plan.requirements.push(executionRow(e, order));
  }

  plan.deliverables = deliverables(plan.requirements, criteriaList);
  plan.milestones = milestones(extract);
  return plan;
}

function pliegoRow(doc: OfferDocumentRef): PliegoRow {
  return {
    source_key: doc.source_key,
    pliego_type: doc.pliego_type,
    title: shortTitle(doc.title),
    url: doc.uri,
    source_uri: doc.uri,
    source_hash: doc.document_hash,
    downloadable: doc.downloadable,
    initial_fetch_status: doc.downloadable ? "pendiente" : "solo_enlace",
  };
}

function qualificationRow(q: OfferQualification, order: number): RequirementRow {
  const label = QUALIFICATION_LABEL[q.kind];
  const title =
    q.kind === "clasificacion" || q.kind === "declaracion"
      ? q.description
      : `${label}: ${q.description}`;
  return {
    source_key: q.source_key,
    title: shortTitle(lotPrefix(q.lot_id) + title),
    literal_text: q.description,
    category: QUALIFICATION_CATEGORY[q.kind],
    requirement_type: "excluyente",
    envelope: "A",
    required_value: q.threshold != null ? `Umbral: ${formatNumber(q.threshold)}` : null,
    sort_order: order,
    from_pcap: true,
  };
}

function guaranteeRow(g: OfferGuarantee, order: number): RequirementRow {
  let value: string | null = null;
  if (g.rate_percent != null) value = `${formatNumber(g.rate_percent)} %`;
  else if (g.amount != null) value = `${formatNumber(g.amount)} €`;
  return {
    source_key: g.source_key,
    title: GUARANTEE_LABEL[g.kind],
    literal_text: null,
    category: "garantias",
    requirement_type: "excluyente",
    envelope: g.kind === "provisional" ? "A" : "requerimiento",
    required_value: value,
    sort_order: order,
    from_pcap: true,
  };
}

function executionRow(
  e: OfferExecutionRequirement,
  order: number,
): RequirementRow {
  const label =
    e.name && e.name.trim() ? e.name.trim() : EXECUTION_LABEL[e.kind];
  return {
    source_key: e.source_key,
    title: shortTitle(lotPrefix(e.lot_id) + label),
    literal_text: e.description,
    category: "condiciones_ejecucion",
    requirement_type: "excluyente",
    envelope: "ninguno",
    required_value: null,
    sort_order: order,
    from_pcap: true,
  };
}

function criterionEnvelope(c: OfferAwardingCriterion): string {
  return c.kind === "subjetivo" ? "B" : "C";
}

function deliverables(
  requirements: RequirementRow[],
  criteriaList: OfferAwardingCriterion[],
): DeliverableRow[] {
  const out: DeliverableRow[] = [];
  const envelopesNeeded = new Set<string>();
  for (const r of requirements) {
    if (r.envelope === "A" || r.envelope === "B" || r.envelope === "C") {
      envelopesNeeded.add(r.envelope);
    }
  }
  for (const c of criteriaList) {
    envelopesNeeded.add(criterionEnvelope(c));
  }

  let order = 0;
  for (const envelope of ["A", "B", "C"] as const) {
    if (!envelopesNeeded.has(envelope)) continue;
    order += 1;
    const own = criteriaList.filter((c) => criterionEnvelope(c) === envelope);
    out.push({
      source_key: `env:${envelope}`,
      title: ENVELOPE_TITLES[envelope],
      envelope,
      points_max: envelopePoints(own),
      sort_order: order * 100,
      parent_key: null,
    });
    own.forEach((crit, idx) => {
      out.push({
        source_key: `env:${envelope}:${crit.source_key}`,
        title: shortTitle(lotPrefix(crit.lot_id) + criterionTitle(crit)),
        envelope,
        points_max: crit.weight,
        sort_order: order * 100 + (idx + 1),
        parent_key: `env:${envelope}`,
      });
    });
  }
  return out;
}

export function criterionTitle(c: OfferAwardingCriterion): string {
  const desc = c.description.split(/\s+/).join(" ");
  const note = c.note ? c.note.split(/\s+/).join(" ") : "";
  const match = CRITERION_NUMBERED_SUFFIX.exec(desc);
  if (match && (match[1]?.length ?? 0) >= 35) {
    const distinctive = match[2].trim();
    return note ? `${distinctive} — ${note}` : distinctive;
  }
  if (note) return `${desc} — ${note}`;
  return desc;
}

function envelopePoints(criteriaList: OfferAwardingCriterion[]): number | null {
  if (criteriaList.length === 0) return null;
  const scopes = new Set(criteriaList.map((c) => c.lot_id));
  let scoped: OfferAwardingCriterion[];
  if (scopes.has(null)) {
    scoped = criteriaList.filter((c) => c.lot_id == null);
  } else if (scopes.size === 1) {
    scoped = criteriaList;
  } else {
    return null;
  }
  const weights = scoped
    .map((c) => c.weight)
    .filter((w): w is number => w != null);
  if (weights.length === 0) return null;
  return Math.round(weights.reduce((a, b) => a + b, 0) * 100) / 100;
}

function milestones(extract: OfferIntakeExtract): MilestoneRow[] {
  const out: MilestoneRow[] = [];
  if (extract.questions_deadline_at) {
    out.push({
      source_key: "ms:preguntas",
      code: "preguntas",
      title: "Límite de preguntas / aclaraciones",
      due_at: extract.questions_deadline_at,
      sort_order: 5,
    });
  }
  if (extract.submission_deadline_at) {
    out.push({
      source_key: "ms:presentacion",
      code: "presentacion",
      title: "Fin de plazo de presentación de ofertas",
      due_at: extract.submission_deadline_at,
      sort_order: 10,
    });
  }
  if (
    extract.documents_available_until &&
    (!extract.submission_deadline_at ||
      extract.documents_available_until.getTime() !==
        extract.submission_deadline_at.getTime())
  ) {
    out.push({
      source_key: "ms:disponibilidad_pliegos",
      code: "disponibilidad_pliegos",
      title: "Fin de disponibilidad de pliegos",
      due_at: extract.documents_available_until,
      sort_order: 20,
    });
  }
  if (extract.tender_opening_at) {
    out.push({
      source_key: "ms:apertura_sobres",
      code: "apertura_sobres",
      title: "Apertura de sobres",
      due_at: extract.tender_opening_at,
      sort_order: 30,
    });
  }
  return out;
}

function lotPrefix(lotId: string | null): string {
  return lotId == null ? "" : `Lote ${lotId} · `;
}

function shortTitle(text: string, limit = TITLE_MAX): string {
  const flat = text.split(/\s+/).join(" ");
  if (flat.length <= limit) return flat;
  return `${flat.slice(0, limit - 1).trimEnd()}…`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "";
  if (Number.isInteger(value)) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  const fixed = value.toFixed(2);
  const [intPart, frac] = fixed.split(".");
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withDots},${frac}`;
}
