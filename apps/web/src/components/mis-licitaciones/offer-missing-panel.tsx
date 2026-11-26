"use client";

import { navigateDetailTab } from "@/components/mis-licitaciones/detail-tabs";
import { cn } from "@/lib/cn";
import type {
  OfferRequirementDetail,
  OfferTaskItem,
} from "@/lib/queries";

export type MissingSeverity = "bloqueante" | "plazo" | "riesgo";

export type MissingItem = {
  id: string;
  severity: MissingSeverity;
  tone: "bad" | "warn";
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

const SEVERITY_LABEL: Record<MissingSeverity, string> = {
  bloqueante: "BLOQUEANTE",
  plazo: "PLAZO",
  riesgo: "RIESGO",
};

const SEVERITY_LABEL_CLASS: Record<MissingSeverity, string> = {
  bloqueante: "text-destructive",
  plazo: "text-sky-700 dark:text-sky-300",
  riesgo: "text-amber-800 dark:text-amber-300",
};

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

function taskSourceLabel(task: OfferTaskItem): string {
  return truncateMeta(task.title?.trim() || task.notes);
}

/** Requisitos + tareas pendientes → ítems de «Qué falta». */
export function buildMissingItems(
  requirements: OfferRequirementDetail[],
  tasks: OfferTaskItem[],
  now = Date.now(),
): MissingItem[] {
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
    items.push({
      id: `req-nocumple-${r.id}`,
      severity: "riesgo",
      tone: "warn",
      title: "No se cumple un requisito",
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
    items.push({
      id: `req-excl-${r.id}`,
      severity: "riesgo",
      tone: "warn",
      title: unverified
        ? "Requisito excluyente sin verificar"
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
    seenReq.add(r.id);
    if (bucket === "overdue") {
      items.push({
        id: `req-plazo-${r.id}`,
        severity: "plazo",
        tone: "warn",
        title: "Requisito con plazo vencido",
        meta: truncateMeta(r.title),
        target: { kind: "requirement", id: r.id },
      });
    } else if (bucket === "soon") {
      items.push({
        id: `req-plazo-soon-${r.id}`,
        severity: "plazo",
        tone: "warn",
        title: "Requisito con plazo próximo",
        meta: truncateMeta(r.title),
        target: { kind: "requirement", id: r.id },
      });
    } else {
      items.push({
        id: `req-riesgo-${r.id}`,
        severity: "riesgo",
        tone: "warn",
        title: "Requisito pendiente de preparar",
        meta: truncateMeta(r.title),
        target: { kind: "requirement", id: r.id },
      });
    }
  }

  for (const t of tasks) {
    if (t.status !== "pendiente") continue;
    const bucket = dueBucket(t.due_at, now);
    if (bucket === "overdue") {
      items.push({
        id: `task-plazo-${t.id}`,
        severity: "plazo",
        tone: "warn",
        title: "Tarea con plazo vencido",
        meta: taskSourceLabel(t),
        target: { kind: "task", id: t.id },
      });
    } else if (bucket === "soon") {
      items.push({
        id: `task-plazo-soon-${t.id}`,
        severity: "plazo",
        tone: "warn",
        title: "Tarea con plazo próximo",
        meta: taskSourceLabel(t),
        target: { kind: "task", id: t.id },
      });
    } else {
      items.push({
        id: `task-riesgo-${t.id}`,
        severity: "riesgo",
        tone: "warn",
        title: "Tarea pendiente",
        meta: taskSourceLabel(t),
        target: { kind: "task", id: t.id },
      });
    }
  }

  items.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  return items;
}

export function OfferMissingPanel({ items }: { items: MissingItem[] }) {
  function onOpen(item: MissingItem) {
    const tab = item.target.kind === "requirement" ? "requisitos" : "tareas";
    const scrollAttr =
      item.target.kind === "requirement"
        ? "data-offer-requirement-id"
        : "data-offer-task-id";
    navigateDetailTab({
      tab,
      scrollAttr,
      scrollId: item.target.id,
    });
  }

  return (
    <aside className="h-fit rounded-xl border border-border bg-surface p-4 lg:sticky lg:top-24">
      <h2 className="text-sm font-semibold text-foreground">Qué falta</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No hay pendientes detectados.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onOpen(m)}
                className={cn(
                  "w-full rounded-r-md border-l-4 px-3 py-2 text-left text-sm transition-colors",
                  "hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  m.tone === "bad" &&
                    "border-destructive bg-destructive/10 text-foreground",
                  m.tone === "warn" &&
                    "border-amber-500 bg-amber-50 text-foreground dark:bg-amber-950/30",
                )}
              >
                <p
                  className={cn(
                    "text-[0.65rem] font-semibold uppercase tracking-wide",
                    SEVERITY_LABEL_CLASS[m.severity],
                  )}
                >
                  {SEVERITY_LABEL[m.severity]}
                </p>
                <p className="mt-0.5 font-medium leading-snug">{m.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{m.meta}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
