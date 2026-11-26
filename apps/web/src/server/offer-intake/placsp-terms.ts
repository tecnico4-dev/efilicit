/**
 * Términos estructurados de una entry PLACSP (CODICE) para el expediente.
 * Port server-only de `efilicit_ingestion.offer_intake.placsp_terms` (ADR 035).
 * Sin DB ni red. No importar desde componentes cliente.
 */
import {
  DOMParser,
  type Document as XmlDocument,
  type Element as XmlElement,
} from "@xmldom/xmldom";

export type PliegoType = "pcap" | "ppt" | "anexo" | "otro";
export type DocumentOrigin = "legal" | "technical" | "additional" | "general";
export type CriterionKind = "objetivo" | "subjetivo";
export type QualificationKind =
  | "solvencia_tecnica"
  | "solvencia_economica"
  | "clasificacion"
  | "declaracion";
export type GuaranteeKind =
  | "provisional"
  | "definitiva"
  | "complementaria"
  | "otra";
export type ExecutionKind = "social" | "medioambiental" | "otra";

const GUARANTEE_KINDS: Record<string, GuaranteeKind> = {
  "1": "provisional",
  "2": "definitiva",
  "3": "complementaria",
};

const EXECUTION_KINDS: Record<string, ExecutionKind> = {
  "1": "medioambiental",
  "2": "social",
};

export type OfferDocumentRef = {
  origin: DocumentOrigin;
  pliego_type: PliegoType;
  title: string;
  uri: string;
  document_hash: string | null;
  general_type_code: string | null;
  readonly downloadable: boolean;
  readonly source_key: string;
};

export type OfferLot = {
  lot_id: string;
  name: string | null;
  tax_exclusive_amount: number | null;
  currency: string | null;
};

export type OfferAwardingCriterion = {
  lot_id: string | null;
  kind: CriterionKind;
  description: string;
  note: string | null;
  weight: number | null;
  position: number;
  readonly source_key: string;
};

export type OfferQualification = {
  lot_id: string | null;
  kind: QualificationKind;
  type_code: string | null;
  description: string;
  threshold: number | null;
  position: number;
  readonly source_key: string;
};

export type OfferGuarantee = {
  kind: GuaranteeKind;
  type_code: string | null;
  rate_percent: number | null;
  amount: number | null;
  position: number;
  readonly source_key: string;
};

export type OfferExecutionRequirement = {
  lot_id: string | null;
  kind: ExecutionKind;
  type_code: string | null;
  name: string | null;
  description: string;
  position: number;
  readonly source_key: string;
};

export type OfferIntakeExtract = {
  contract_folder_id: string | null;
  documents: OfferDocumentRef[];
  lots: OfferLot[];
  criteria: OfferAwardingCriterion[];
  qualifications: OfferQualification[];
  guarantees: OfferGuarantee[];
  execution_requirements: OfferExecutionRequirement[];
  submission_deadline_at: Date | null;
  documents_available_until: Date | null;
  questions_deadline_at: Date | null;
  tender_opening_at: Date | null;
};

export class OfferTermsParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfferTermsParseError";
  }
}

function documentRef(input: {
  origin: DocumentOrigin;
  pliego_type: PliegoType;
  title: string;
  uri: string;
  document_hash?: string | null;
  general_type_code?: string | null;
}): OfferDocumentRef {
  const document_hash = input.document_hash ?? null;
  return {
    origin: input.origin,
    pliego_type: input.pliego_type,
    title: input.title,
    uri: input.uri,
    document_hash,
    general_type_code: input.general_type_code ?? null,
    get downloadable() {
      return this.uri.includes("/FileSystem/servlet/");
    },
    get source_key() {
      return `doc:${this.origin}:${this.document_hash || this.uri}`;
    },
  };
}

function criterion(input: Omit<OfferAwardingCriterion, "source_key">): OfferAwardingCriterion {
  return {
    ...input,
    get source_key() {
      return `crit:${this.lot_id || "-"}:${this.position}`;
    },
  };
}

function qualification(
  input: Omit<OfferQualification, "source_key">,
): OfferQualification {
  return {
    ...input,
    get source_key() {
      return `qual:${this.lot_id || "-"}:${this.kind}:${this.position}`;
    },
  };
}

function guarantee(input: Omit<OfferGuarantee, "source_key">): OfferGuarantee {
  return {
    ...input,
    get source_key() {
      return `guar:${this.kind}:${this.position}`;
    },
  };
}

function execution(
  input: Omit<OfferExecutionRequirement, "source_key">,
): OfferExecutionRequirement {
  return {
    ...input,
    get source_key() {
      return `exec:${this.lot_id || "-"}:${this.kind}:${this.position}`;
    },
  };
}

export function parseOfferTerms(raw: Uint8Array | Buffer | string): OfferIntakeExtract {
  const text =
    typeof raw === "string"
      ? raw
      : Buffer.isBuffer(raw)
        ? raw.toString("utf8")
        : Buffer.from(raw).toString("utf8");

  let doc: XmlDocument;
  try {
    doc = new DOMParser({
      onError(level, message) {
        if (level === "fatalError") {
          throw new Error(String(message));
        }
      },
    }).parseFromString(text, "application/xml");
  } catch {
    throw new OfferTermsParseError("invalid Atom XML");
  }

  if (!doc.documentElement) {
    throw new OfferTermsParseError("invalid Atom XML");
  }
  const parseError = doc.getElementsByTagName("parsererror")[0];
  if (parseError) {
    throw new OfferTermsParseError("invalid Atom XML");
  }

  const status = findDescendant(doc.documentElement, "ContractFolderStatus");
  if (!status) {
    throw new OfferTermsParseError("missing ContractFolderStatus");
  }

  return {
    contract_folder_id: textOf(child(status, "ContractFolderID")),
    documents: documents(status),
    lots: lots(status),
    criteria: criteria(status),
    qualifications: qualifications(status),
    guarantees: guarantees(status),
    execution_requirements: executionRequirements(status),
    submission_deadline_at: periodEnd(
      childPath(status, ["TenderingProcess", "TenderSubmissionDeadlinePeriod"]),
    ),
    documents_available_until: periodEnd(
      childPath(status, ["TenderingProcess", "DocumentAvailabilityPeriod"]),
    ),
    questions_deadline_at: periodEnd(
      childPath(status, [
        "TenderingProcess",
        "AdditionalInformationRequestPeriod",
      ]),
    ),
    tender_opening_at: earliestOpenTenderEvent(status),
  };
}

function documents(status: XmlElement): OfferDocumentRef[] {
  const out: OfferDocumentRef[] = [];
  const seen = new Set<string>();
  const direct: Array<[string, DocumentOrigin, PliegoType]> = [
    ["LegalDocumentReference", "legal", "pcap"],
    ["TechnicalDocumentReference", "technical", "ppt"],
    ["AdditionalDocumentReference", "additional", "anexo"],
  ];
  for (const [tag, origin, pliegoType] of direct) {
    for (const ref of children(status, tag)) {
      const uri = textOf(
        childPath(ref, ["Attachment", "ExternalReference", "URI"]),
      );
      if (!uri || seen.has(uri)) continue;
      seen.add(uri);
      out.push(
        documentRef({
          origin,
          pliego_type: pliegoType,
          title: textOf(child(ref, "ID")) || pliegoType.toUpperCase(),
          uri,
          document_hash: textOf(
            childPath(ref, ["Attachment", "ExternalReference", "DocumentHash"]),
          ),
        }),
      );
    }
  }

  for (const general of children(status, "GeneralDocument")) {
    for (const ref of children(general, "GeneralDocumentDocumentReference")) {
      const ext = childPath(ref, ["Attachment", "ExternalReference"]);
      const uri = textOf(child(ext, "URI"));
      if (!uri || seen.has(uri)) continue;
      seen.add(uri);
      const title =
        textOf(child(ext, "FileName")) ||
        textOf(child(ref, "ID")) ||
        "Documento";
      out.push(
        documentRef({
          origin: "general",
          pliego_type: inferGeneralPliegoType(title),
          title,
          uri,
          general_type_code: textOf(child(ref, "DocumentTypeCode")),
        }),
      );
    }
  }
  return out;
}

function inferGeneralPliegoType(title: string): PliegoType {
  const lowered = title.toLowerCase();
  if (
    [
      "cláusulas administrativas",
      "clausulas administrativas",
      "pcap",
      "pliego administrativo",
    ].some((w) => lowered.includes(w))
  ) {
    return "pcap";
  }
  if (
    [
      "prescripciones técnicas",
      "prescripciones tecnicas",
      "ppt",
      "pliego técnico",
      "pliego tecnico",
    ].some((w) => lowered.includes(w))
  ) {
    return "ppt";
  }
  if (
    ["modelo", "anexo", "declaración", "declaracion"].some((w) =>
      lowered.includes(w),
    )
  ) {
    return "anexo";
  }
  return "otro";
}

function lots(status: XmlElement): OfferLot[] {
  const out: OfferLot[] = [];
  for (const lot of children(status, "ProcurementProjectLot")) {
    const lotId = textOf(child(lot, "ID"));
    if (!lotId) continue;
    const amount = childPath(lot, [
      "ProcurementProject",
      "BudgetAmount",
      "TaxExclusiveAmount",
    ]);
    out.push({
      lot_id: lotId,
      name: textOf(childPath(lot, ["ProcurementProject", "Name"])),
      tax_exclusive_amount: numberOf(amount),
      currency: amount?.getAttribute("currencyID") ?? null,
    });
  }
  return out;
}

function termsScopes(status: XmlElement): Array<[string | null, XmlElement]> {
  const scopes: Array<[string | null, XmlElement]> = [];
  const rootTerms = child(status, "TenderingTerms");
  if (rootTerms) scopes.push([null, rootTerms]);
  for (const lot of children(status, "ProcurementProjectLot")) {
    const terms = child(lot, "TenderingTerms");
    const lotId = textOf(child(lot, "ID"));
    if (terms && lotId) scopes.push([lotId, terms]);
  }
  return scopes;
}

function criteria(status: XmlElement): OfferAwardingCriterion[] {
  const out: OfferAwardingCriterion[] = [];
  for (const [lotId, terms] of termsScopes(status)) {
    let position = 0;
    const awarding = child(terms, "AwardingTerms");
    if (!awarding) continue;
    for (const crit of children(awarding, "AwardingCriteria")) {
      const code = (textOf(child(crit, "AwardingCriteriaTypeCode")) || "").toUpperCase();
      const kind: CriterionKind = code === "SUBJ" ? "subjetivo" : "objetivo";
      let subs = children(crit, "SubordinateAwardingCriterion");
      if (subs.length === 0) {
        subs = children(crit, "SubordinateAwardingCriteria");
      }
      if (subs.length > 0) {
        for (const sub of subs) {
          const description = textOf(child(sub, "Description"));
          if (!description) continue;
          position += 1;
          out.push(
            criterion({
              lot_id: lotId,
              kind,
              description,
              note: textOf(child(sub, "Note")),
              weight: numberOf(child(sub, "WeightNumeric")),
              position,
            }),
          );
        }
        continue;
      }
      const description = textOf(child(crit, "Description"));
      if (!description) continue;
      position += 1;
      out.push(
        criterion({
          lot_id: lotId,
          kind,
          description,
          note: textOf(child(crit, "Note")),
          weight: numberOf(child(crit, "WeightNumeric")),
          position,
        }),
      );
    }
  }
  return out;
}

function qualifications(status: XmlElement): OfferQualification[] {
  const out: OfferQualification[] = [];
  const blocks: Array<[string, QualificationKind, string]> = [
    ["TechnicalEvaluationCriteria", "solvencia_tecnica", "EvaluationCriteriaTypeCode"],
    ["FinancialEvaluationCriteria", "solvencia_economica", "EvaluationCriteriaTypeCode"],
    ["SpecificTendererRequirement", "declaracion", "RequirementTypeCode"],
  ];
  for (const [lotId, terms] of termsScopes(status)) {
    const request = child(terms, "TendererQualificationRequest");
    if (!request) continue;
    for (const [tag, kind, codeTag] of blocks) {
      let position = 0;
      for (const node of children(request, tag)) {
        const description = textOf(child(node, "Description"));
        if (!description) continue;
        position += 1;
        out.push(
          qualification({
            lot_id: lotId,
            kind,
            type_code: textOf(child(node, codeTag)),
            description,
            threshold: numberOf(child(node, "ThresholdQuantity")),
            position,
          }),
        );
      }
    }
    let classPos = 0;
    for (const scheme of children(request, "RequiredBusinessClassificationScheme")) {
      const codes: string[] = [];
      for (const cat of children(scheme, "ClassificationCategory")) {
        const code = textOf(child(cat, "CodeValue"));
        if (code) codes.push(code);
      }
      if (codes.length === 0) continue;
      classPos += 1;
      out.push(
        qualification({
          lot_id: lotId,
          kind: "clasificacion",
          type_code: null,
          description: `Clasificación empresarial: ${codes.join(", ")}`,
          threshold: null,
          position: classPos,
        }),
      );
    }
  }
  return out;
}

function executionRequirements(status: XmlElement): OfferExecutionRequirement[] {
  const out: OfferExecutionRequirement[] = [];
  for (const [lotId, terms] of termsScopes(status)) {
    let position = 0;
    for (const node of children(terms, "ContractExecutionRequirement")) {
      const description = textOf(child(node, "Description"));
      if (!description) continue;
      position += 1;
      const code = textOf(child(node, "ExecutionRequirementCode"));
      out.push(
        execution({
          lot_id: lotId,
          kind: EXECUTION_KINDS[code || ""] ?? "otra",
          type_code: code,
          name: textOf(child(node, "Name")),
          description,
          position,
        }),
      );
    }
  }
  return out;
}

function guarantees(status: XmlElement): OfferGuarantee[] {
  const out: OfferGuarantee[] = [];
  const terms = child(status, "TenderingTerms");
  if (!terms) return out;
  let position = 0;
  for (const node of children(terms, "RequiredFinancialGuarantee")) {
    const code = textOf(child(node, "GuaranteeTypeCode"));
    const rate = numberOf(child(node, "AmountRate"));
    const amount = numberOf(child(node, "LiabilityAmount"));
    if ((rate == null || rate === 0) && (amount == null || amount === 0)) {
      continue;
    }
    position += 1;
    out.push(
      guarantee({
        kind: GUARANTEE_KINDS[code || ""] ?? "otra",
        type_code: code,
        rate_percent: rate,
        amount,
        position,
      }),
    );
  }
  return out;
}

function periodEnd(period: XmlElement | null): Date | null {
  if (!period) return null;
  const endDate = textOf(child(period, "EndDate"));
  if (!endDate) return null;
  const endTime = textOf(child(period, "EndTime")) || "23:59:59";
  return madridDateTime(endDate, endTime);
}

function occurrenceAt(event: XmlElement | null): Date | null {
  if (!event) return null;
  const occDate = textOf(child(event, "OccurrenceDate"));
  if (!occDate) return null;
  const occTime = textOf(child(event, "OccurrenceTime")) || "00:00:00";
  return madridDateTime(occDate, occTime);
}

function earliestOpenTenderEvent(status: XmlElement): Date | null {
  const process = child(status, "TenderingProcess");
  if (!process) return null;
  const times: Date[] = [];
  for (const event of children(process, "OpenTenderEvent")) {
    const at = occurrenceAt(event);
    if (at) times.push(at);
  }
  if (times.length === 0) return null;
  return times.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
}

/** Interpreta fecha+hora civil en Europe/Madrid → Date UTC. */
export function madridDateTime(date: string, time: string): Date | null {
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const local = `${date}T${normalizedTime}`;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(local)) return null;

  const asIfUtc = Date.parse(`${local}Z`);
  if (Number.isNaN(asIfUtc)) return null;

  // offset(I) depende de I; 2–3 pasadas bastan alrededor de cambios DST.
  let instant = asIfUtc;
  for (let i = 0; i < 3; i++) {
    instant = asIfUtc - madridOffsetMs(new Date(instant));
  }
  return new Date(instant);
}

function madridOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    timeZoneName: "longOffset",
  }).formatToParts(instant);
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = name.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const mins = Number(match[3] || "0");
  return sign * (hours * 60 + mins) * 60_000;
}

function numberOf(node: XmlElement | null | undefined): number | null {
  const value = textOf(node);
  if (value == null) return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function textOf(node: XmlElement | null | undefined): string | null {
  if (!node) return null;
  const value = (node.textContent || "").trim();
  return value || null;
}

function child(parent: XmlElement | null | undefined, localName: string): XmlElement | null {
  if (!parent) return null;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const n = parent.childNodes[i];
    if (n.nodeType === 1 && (n as XmlElement).localName === localName) {
      return n as XmlElement;
    }
  }
  return null;
}

function children(parent: XmlElement, localName: string): XmlElement[] {
  const out: XmlElement[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const n = parent.childNodes[i];
    if (n.nodeType === 1 && (n as XmlElement).localName === localName) {
      out.push(n as XmlElement);
    }
  }
  return out;
}

function childPath(parent: XmlElement | null | undefined, path: string[]): XmlElement | null {
  let cur: XmlElement | null = parent ?? null;
  for (const name of path) {
    cur = child(cur, name);
    if (!cur) return null;
  }
  return cur;
}

function findDescendant(root: XmlElement | null, localName: string): XmlElement | null {
  if (!root) return null;
  if (root.localName === localName) return root;
  for (let i = 0; i < root.childNodes.length; i++) {
    const n = root.childNodes[i];
    if (n.nodeType !== 1) continue;
    const found = findDescendant(n as XmlElement, localName);
    if (found) return found;
  }
  return null;
}
