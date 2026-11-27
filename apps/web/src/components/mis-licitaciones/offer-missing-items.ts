import type {
  OfferRequirementDetail,
  OfferTaskItem,
} from "@/lib/queries";

export type MissingSeverity = "bloqueante" | "plazo" | "riesgo";

export type MissingTarget =
  | { kind: "requirement"; id: string }
  | { kind: "task"; id: string };

export type MissingLine = {
  meta: string;
  target: MissingTarget;
  mine: boolean;
};

export type MissingItem = {
  id: string;
  severity: MissingSeverity;
  tone: "bad" | "warn";
  /** Algún ítem del grupo está asignado al viewer. */
  mine: boolean;
  /** Qué pasa (corto; plural si count > 1). */
  title: string;
  /** Hasta 2 líneas más relevantes. */
  lines: MissingLine[];
  totalCount: number;
};

type TitleForms = {
  oneMine: string;
  oneOther: string;
  manyMine: (n: number) => string;
  manyOther: (n: number) => string;
};

type RawEntry = {
  groupKey: string;
  severity: MissingSeverity;
  tone: "bad" | "warn";
  mine: boolean;
  dueAt: string | null;
  meta: string;
  target: MissingTarget;
  titles: TitleForms;
};

const SEVERITY_RANK: Record<MissingSeverity, number> = {
  bloqueante: 0,
  plazo: 1,
  riesgo: 2,
};

/** Orden estable entre cajas BLOQUEANTE. */
const BLOQUEANTE_GROUP_RANK: Record<string, number> = {
  "bloqueante-excl-nocumple": 0,
  "bloqueante-excl-bloqueado": 1,
};

/** 0 = bloqueantes; 1 = grupos con algo mío; 2 = resto. */
function audienceRank(item: MissingItem): number {
  if (item.severity === "bloqueante") return 0;
  return item.mine ? 1 : 2;
}

const PLAZO_SOON_MS = 7 * 24 * 60 * 60 * 1000;
const META_MAX = 120;
const MAX_LINES = 2;

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

function dueMs(dueIso: string | null): number {
  if (!dueIso) return Number.POSITIVE_INFINITY;
  const t = new Date(dueIso).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function isMine(
  ownerMemberId: string | null,
  viewerMemberId: string | null,
): boolean {
  return viewerMemberId != null && ownerMemberId === viewerMemberId;
}

/** Asignado a otro miembro (no al viewer). Sin asignar = false. */
function isAssignedToOther(
  ownerMemberId: string | null,
  viewerMemberId: string | null,
): boolean {
  if (ownerMemberId == null) return false;
  if (viewerMemberId == null) return true;
  return ownerMemberId !== viewerMemberId;
}

/** Cumple / no aplica / listo / en revisión → fuera de «Qué falta». */
function isRequirementOutOfScope(r: OfferRequirementDetail): boolean {
  if (
    r.compliance_status === "cumple" ||
    r.compliance_status === "no_aplica"
  ) {
    return true;
  }
  if (r.prep_status === "listo" || r.prep_status === "en_revision") {
    return true;
  }
  return false;
}

function taskSourceLabel(task: OfferTaskItem): string {
  return truncateMeta(task.title?.trim() || task.notes);
}

function titleFor(titles: TitleForms, count: number, allMine: boolean): string {
  if (count <= 1) return allMine ? titles.oneMine : titles.oneOther;
  return allMine ? titles.manyMine(count) : titles.manyOther(count);
}

function compareEntries(a: RawEntry, b: RawEntry): number {
  if (a.mine !== b.mine) return a.mine ? -1 : 1;
  return dueMs(a.dueAt) - dueMs(b.dueAt);
}

function collapseGroups(raw: RawEntry[]): MissingItem[] {
  const byKey = new Map<string, RawEntry[]>();
  for (const e of raw) {
    const list = byKey.get(e.groupKey);
    if (list) list.push(e);
    else byKey.set(e.groupKey, [e]);
  }

  const items: MissingItem[] = [];
  for (const [groupKey, entries] of byKey) {
    entries.sort(compareEntries);
    const first = entries[0]!;
    const allMine = entries.every((e) => e.mine);
    const anyMine = entries.some((e) => e.mine);
    const totalCount = entries.length;
    const shown = entries.slice(0, MAX_LINES);
    items.push({
      id: groupKey,
      severity: first.severity,
      tone: first.tone,
      mine: anyMine,
      title: titleFor(first.titles, totalCount, allMine),
      lines: shown.map((e) => ({
        meta: e.meta,
        target: e.target,
        mine: e.mine,
      })),
      totalCount,
    });
  }

  items.sort((a, b) => {
    const aud = audienceRank(a) - audienceRank(b);
    if (aud !== 0) return aud;
    const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sev !== 0) return sev;
    if (a.severity === "bloqueante" && b.severity === "bloqueante") {
      return (
        (BLOQUEANTE_GROUP_RANK[a.id] ?? 99) -
        (BLOQUEANTE_GROUP_RANK[b.id] ?? 99)
      );
    }
    return 0;
  });
  return items;
}

export type BuildMissingItemsOptions = {
  viewerMemberId?: string | null;
  now?: number;
};

/** Requisitos + tareas pendientes → ítems de «Qué falta» (agrupados). */
export function buildMissingItems(
  requirements: OfferRequirementDetail[],
  tasks: OfferTaskItem[],
  options: BuildMissingItemsOptions = {},
): MissingItem[] {
  const viewerMemberId = options.viewerMemberId ?? null;
  const now = options.now ?? Date.now();
  const raw: RawEntry[] = [];
  const seenReq = new Set<string>();

  // BLOQUEANTE: excluyente marcado como no cumple (de cualquiera).
  for (const r of requirements) {
    if (isRequirementOutOfScope(r)) continue;
    if (r.requirement_type !== "excluyente") continue;
    if (r.compliance_status !== "no_cumple") continue;
    seenReq.add(r.id);
    raw.push({
      groupKey: "bloqueante-excl-nocumple",
      severity: "bloqueante",
      tone: "bad",
      mine: isMine(r.owner_member_id, viewerMemberId),
      dueAt: r.internal_due_at,
      meta: truncateMeta(r.title),
      target: { kind: "requirement", id: r.id },
      titles: {
        oneMine: "No se cumple un requisito excluyente",
        oneOther: "No se cumple un requisito excluyente",
        manyMine: (n) => `No se cumplen ${n} requisitos excluyentes`,
        manyOther: (n) => `No se cumplen ${n} requisitos excluyentes`,
      },
    });
  }

  // BLOQUEANTE: excluyente con preparación bloqueada (de cualquiera; un solo grupo).
  for (const r of requirements) {
    if (seenReq.has(r.id)) continue;
    if (isRequirementOutOfScope(r)) continue;
    if (r.requirement_type !== "excluyente") continue;
    if (r.prep_status !== "bloqueado") continue;
    seenReq.add(r.id);
    raw.push({
      groupKey: "bloqueante-excl-bloqueado",
      severity: "bloqueante",
      tone: "bad",
      mine: isMine(r.owner_member_id, viewerMemberId),
      dueAt: r.internal_due_at,
      meta: truncateMeta(r.title),
      target: { kind: "requirement", id: r.id },
      titles: {
        oneMine: "Tienes un requisito excluyente bloqueado",
        oneOther: "Hay un requisito excluyente bloqueado",
        manyMine: (n) => `Tienes ${n} requisitos excluyentes bloqueados`,
        manyOther: (n) => `Hay ${n} requisitos excluyentes bloqueados`,
      },
    });
  }

  // A partir de aquí: no info de requisitos asignados a otros.
  // Otros no_cumple (no excluyentes) → provisionalmente RIESGO.
  for (const r of requirements) {
    if (seenReq.has(r.id)) continue;
    if (isRequirementOutOfScope(r)) continue;
    if (isAssignedToOther(r.owner_member_id, viewerMemberId)) continue;
    if (r.compliance_status !== "no_cumple") continue;
    seenReq.add(r.id);
    const mine = isMine(r.owner_member_id, viewerMemberId);
    raw.push({
      groupKey: "riesgo-nocumple",
      severity: "riesgo",
      tone: "warn",
      mine,
      dueAt: r.internal_due_at,
      meta: truncateMeta(r.title),
      target: { kind: "requirement", id: r.id },
      titles: {
        oneMine: "No se cumple un requisito tuyo",
        oneOther: "No se cumple un requisito",
        manyMine: (n) => `No se cumplen ${n} requisitos tuyos`,
        manyOther: (n) => `No se cumplen ${n} requisitos`,
      },
    });
  }

  // Excluyente sin verificar / sin asignar → provisionalmente RIESGO.
  for (const r of requirements) {
    if (seenReq.has(r.id)) continue;
    if (isRequirementOutOfScope(r)) continue;
    if (isAssignedToOther(r.owner_member_id, viewerMemberId)) continue;
    if (r.requirement_type !== "excluyente") continue;
    const unverified = r.compliance_status === "sin_verificar";
    const unassigned = r.owner_member_id == null;
    if (!unverified && !unassigned) continue;
    seenReq.add(r.id);
    const mine = isMine(r.owner_member_id, viewerMemberId);
    if (unverified) {
      raw.push({
        groupKey: "riesgo-excl-sin-verificar",
        severity: "riesgo",
        tone: "warn",
        mine,
        dueAt: r.internal_due_at,
        meta: truncateMeta(r.title),
        target: { kind: "requirement", id: r.id },
        titles: {
          oneMine: "Tienes un excluyente sin verificar",
          oneOther: "Requisito excluyente sin verificar",
          manyMine: (n) => `Tienes ${n} excluyentes sin verificar`,
          manyOther: (n) => `${n} requisitos excluyentes sin verificar`,
        },
      });
    } else {
      raw.push({
        groupKey: "riesgo-excl-sin-asignar",
        severity: "riesgo",
        tone: "warn",
        mine: false,
        dueAt: r.internal_due_at,
        meta: truncateMeta(r.title),
        target: { kind: "requirement", id: r.id },
        titles: {
          oneMine: "Requisito excluyente sin asignar",
          oneOther: "Requisito excluyente sin asignar",
          manyMine: (n) => `${n} requisitos excluyentes sin asignar`,
          manyOther: (n) => `${n} requisitos excluyentes sin asignar`,
        },
      });
    }
  }

  // Preparación pendiente (míos / sin asignar).
  for (const r of requirements) {
    if (seenReq.has(r.id)) continue;
    if (isRequirementOutOfScope(r)) continue;
    if (isAssignedToOther(r.owner_member_id, viewerMemberId)) continue;
    if (r.prep_status === "bloqueado") continue;
    const bucket = dueBucket(r.internal_due_at, now);
    const mine = isMine(r.owner_member_id, viewerMemberId);
    seenReq.add(r.id);
    if (bucket === "overdue") {
      raw.push({
        groupKey: "plazo-req-overdue",
        severity: "plazo",
        tone: "warn",
        mine,
        dueAt: r.internal_due_at,
        meta: truncateMeta(r.title),
        target: { kind: "requirement", id: r.id },
        titles: {
          oneMine: "Tienes un requisito con plazo vencido",
          oneOther: "Requisito con plazo vencido",
          manyMine: (n) => `Tienes ${n} requisitos con plazo vencido`,
          manyOther: (n) => `${n} requisitos con plazo vencido`,
        },
      });
    } else if (bucket === "soon") {
      raw.push({
        groupKey: "plazo-req-soon",
        severity: "plazo",
        tone: "warn",
        mine,
        dueAt: r.internal_due_at,
        meta: truncateMeta(r.title),
        target: { kind: "requirement", id: r.id },
        titles: {
          oneMine: "Tienes un requisito con plazo próximo",
          oneOther: "Requisito con plazo próximo",
          manyMine: (n) => `Tienes ${n} requisitos con plazo próximo`,
          manyOther: (n) => `${n} requisitos con plazo próximo`,
        },
      });
    } else {
      raw.push({
        groupKey: "riesgo-req-prep",
        severity: "riesgo",
        tone: "warn",
        mine,
        dueAt: r.internal_due_at,
        meta: truncateMeta(r.title),
        target: { kind: "requirement", id: r.id },
        titles: {
          oneMine: "Tienes un requisito pendiente de preparar",
          oneOther: "Requisito pendiente de preparar",
          manyMine: (n) => `Tienes ${n} requisitos pendientes de preparar`,
          manyOther: (n) => `${n} requisitos pendientes de preparar`,
        },
      });
    }
  }

  for (const t of tasks) {
    if (t.status !== "pendiente") continue;
    // No mostrar tareas de otros miembros; sí las mías y las sin asignar.
    if (isAssignedToOther(t.owner_member_id, viewerMemberId)) continue;
    const bucket = dueBucket(t.due_at, now);
    const mine = isMine(t.owner_member_id, viewerMemberId);
    if (bucket === "overdue") {
      raw.push({
        groupKey: "plazo-task-overdue",
        severity: "plazo",
        tone: "warn",
        mine,
        dueAt: t.due_at,
        meta: taskSourceLabel(t),
        target: { kind: "task", id: t.id },
        titles: {
          oneMine: "Tienes una tarea con plazo vencido",
          oneOther: "Tarea con plazo vencido",
          manyMine: (n) => `Tienes ${n} tareas con plazo vencido`,
          manyOther: (n) => `${n} tareas con plazo vencido`,
        },
      });
    } else if (bucket === "soon") {
      raw.push({
        groupKey: "plazo-task-soon",
        severity: "plazo",
        tone: "warn",
        mine,
        dueAt: t.due_at,
        meta: taskSourceLabel(t),
        target: { kind: "task", id: t.id },
        titles: {
          oneMine: "Tienes una tarea con plazo próximo",
          oneOther: "Tarea con plazo próximo",
          manyMine: (n) => `Tienes ${n} tareas con plazo próximo`,
          manyOther: (n) => `${n} tareas con plazo próximo`,
        },
      });
    } else {
      raw.push({
        groupKey: "riesgo-task-pendiente",
        severity: "riesgo",
        tone: "warn",
        mine,
        dueAt: t.due_at,
        meta: taskSourceLabel(t),
        target: { kind: "task", id: t.id },
        titles: {
          oneMine: "Tienes una tarea pendiente",
          oneOther: "Tarea pendiente",
          manyMine: (n) => `Tienes ${n} tareas pendientes`,
          manyOther: (n) => `${n} tareas pendientes`,
        },
      });
    }
  }

  return collapseGroups(raw);
}
