import type {
  OfferRequirementDetail,
  OfferTaskItem,
} from "@/lib/queries";

export type MissingSeverity = "bloqueante" | "plazo" | "riesgo";

export type MissingItem = {
  id: string;
  severity: MissingSeverity;
  tone: "bad" | "warn";
  /** Asignado al miembro que mira la pantalla. */
  mine: boolean;
  /** Qué pasa (corto). */
  title: string;
  /** Inicio del requisito/tarea + … */
  meta: string;
  target:
    | { kind: "requirement"; id: string }
    | { kind: "task"; id: string };
};

const SEVERITY_RANK: Record<MissingSeverity, number> = {
  bloqueante: 0,
  plazo: 1,
  riesgo: 2,
};

/** 0 = bloqueantes globales; 1 = lo mío; 2 = resto. */
function audienceRank(item: MissingItem): number {
  if (item.severity === "bloqueante") return 0;
  return item.mine ? 1 : 2;
}

const PLAZO_SOON_MS = 7 * 24 * 60 * 60 * 1000;
const META_MAX = 64;

function truncateMeta(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return "—";
  if (t.length <= META_MAX) return t;
  return `${t.slice(0, META_MAX - 1)}…`;
}

function dueBucket(
  dueIso: string | null,
  now: number,
): "overdue" | "soon" | "later" | "none" {
  if (!dueIso) return "none";
  const t = new Date(dueIso).getTime();
  if (Number.isNaN(t)) return "none";
  if (t < now) return "overdue";
  if (t - now <= PLAZO_SOON_MS) return "soon";
  return "later";
}

function isMine(
  ownerMemberId: string | null,
  viewerMemberId: string | null,
): boolean {
  return viewerMemberId != null && ownerMemberId === viewerMemberId;
}

function taskSourceLabel(task: OfferTaskItem): string {
  return truncateMeta(task.title?.trim() || task.notes);
}

export type BuildMissingItemsOptions = {
  viewerMemberId?: string | null;
  now?: number;
};

/** Requisitos + tareas pendientes → ítems de «Qué falta». */
export function buildMissingItems(
  requirements: OfferRequirementDetail[],
  tasks: OfferTaskItem[],
  options: BuildMissingItemsOptions = {},
): MissingItem[] {
  const viewerMemberId = options.viewerMemberId ?? null;
  const now = options.now ?? Date.now();
  const items: MissingItem[] = [];
  const seenReq = new Set<string>();

  // BLOQUEANTE: solo excluyente marcado como no cumple.
  for (const r of requirements) {
    if (r.requirement_type !== "excluyente") continue;
    if (r.compliance_status !== "no_cumple") continue;
    seenReq.add(r.id);
    items.push({
      id: `req-bloqueante-${r.id}`,
      severity: "bloqueante",
      tone: "bad",
      mine: isMine(r.owner_member_id, viewerMemberId),
      title: "No se cumple un requisito excluyente",
      meta: truncateMeta(r.title),
      target: { kind: "requirement", id: r.id },
    });
  }

  // Otros no_cumple (no excluyentes) → provisionalmente RIESGO.
  for (const r of requirements) {
    if (seenReq.has(r.id)) continue;
    if (r.compliance_status !== "no_cumple") continue;
    seenReq.add(r.id);
    const mine = isMine(r.owner_member_id, viewerMemberId);
    items.push({
      id: `req-nocumple-${r.id}`,
      severity: "riesgo",
      tone: "warn",
      mine,
      title: mine
        ? "No se cumple un requisito tuyo"
        : "No se cumple un requisito",
      meta: truncateMeta(r.title),
      target: { kind: "requirement", id: r.id },
    });
  }

  // Excluyente sin verificar / sin asignar → provisionalmente RIESGO.
  for (const r of requirements) {
    if (seenReq.has(r.id)) continue;
    if (r.requirement_type !== "excluyente") continue;
    if (r.compliance_status === "cumple" || r.compliance_status === "no_aplica") {
      continue;
    }
    const unverified = r.compliance_status === "sin_verificar";
    const unassigned = r.owner_member_id == null;
    if (!unverified && !unassigned) continue;
    seenReq.add(r.id);
    const mine = isMine(r.owner_member_id, viewerMemberId);
    items.push({
      id: `req-excl-${r.id}`,
      severity: "riesgo",
      tone: "warn",
      mine,
      title: unverified
        ? mine
          ? "Tienes un excluyente sin verificar"
          : "Requisito excluyente sin verificar"
        : "Requisito excluyente sin asignar",
      meta: truncateMeta(r.title),
      target: { kind: "requirement", id: r.id },
    });
  }

  // Preparación pendiente.
  for (const r of requirements) {
    if (seenReq.has(r.id)) continue;
    if (r.prep_status === "listo") continue;
    const bucket = dueBucket(r.internal_due_at, now);
    const mine = isMine(r.owner_member_id, viewerMemberId);
    seenReq.add(r.id);
    if (bucket === "overdue") {
      items.push({
        id: `req-plazo-${r.id}`,
        severity: "plazo",
        tone: "warn",
        mine,
        title: mine
          ? "Tienes un requisito con plazo vencido"
          : "Requisito con plazo vencido",
        meta: truncateMeta(r.title),
        target: { kind: "requirement", id: r.id },
      });
    } else if (bucket === "soon") {
      items.push({
        id: `req-plazo-soon-${r.id}`,
        severity: "plazo",
        tone: "warn",
        mine,
        title: mine
          ? "Tienes un requisito con plazo próximo"
          : "Requisito con plazo próximo",
        meta: truncateMeta(r.title),
        target: { kind: "requirement", id: r.id },
      });
    } else {
      items.push({
        id: `req-riesgo-${r.id}`,
        severity: "riesgo",
        tone: "warn",
        mine,
        title: mine
          ? "Tienes un requisito pendiente de preparar"
          : "Requisito pendiente de preparar",
        meta: truncateMeta(r.title),
        target: { kind: "requirement", id: r.id },
      });
    }
  }

  for (const t of tasks) {
    if (t.status !== "pendiente") continue;
    const bucket = dueBucket(t.due_at, now);
    const mine = isMine(t.owner_member_id, viewerMemberId);
    if (bucket === "overdue") {
      items.push({
        id: `task-plazo-${t.id}`,
        severity: "plazo",
        tone: "warn",
        mine,
        title: mine
          ? "Tienes una tarea con plazo vencido"
          : "Tarea con plazo vencido",
        meta: taskSourceLabel(t),
        target: { kind: "task", id: t.id },
      });
    } else if (bucket === "soon") {
      items.push({
        id: `task-plazo-soon-${t.id}`,
        severity: "plazo",
        tone: "warn",
        mine,
        title: mine
          ? "Tienes una tarea con plazo próximo"
          : "Tarea con plazo próximo",
        meta: taskSourceLabel(t),
        target: { kind: "task", id: t.id },
      });
    } else {
      items.push({
        id: `task-riesgo-${t.id}`,
        severity: "riesgo",
        tone: "warn",
        mine,
        title: mine ? "Tienes una tarea pendiente" : "Tarea pendiente",
        meta: taskSourceLabel(t),
        target: { kind: "task", id: t.id },
      });
    }
  }

  items.sort((a, b) => {
    const aud = audienceRank(a) - audienceRank(b);
    if (aud !== 0) return aud;
    return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  });
  return items;
}
