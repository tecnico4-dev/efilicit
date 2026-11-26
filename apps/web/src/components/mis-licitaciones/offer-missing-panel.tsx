import { cn } from "@/lib/cn";
import { formatDateMadrid } from "@/lib/datetime";
import type {
  OfferRequirementDetail,
  OfferTaskItem,
} from "@/lib/queries";

export type MissingSeverity = "bloqueante" | "plazo" | "riesgo";

export type MissingItem = {
  id: string;
  severity: MissingSeverity;
  /** Caja: rojo = bloqueante; ámbar = plazo/riesgo. */
  tone: "bad" | "warn";
  title: string;
  meta: string;
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

const REQ_TYPE_LABEL: Record<string, string> = {
  excluyente: "Excluyente",
  puntuable: "Puntuable",
  informativo: "Informativo",
};

const PLAZO_SOON_MS = 7 * 24 * 60 * 60 * 1000;

function shortPerson(name: string | null | undefined): string | null {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[1]!.charAt(0).toUpperCase()}.`;
}

function joinMeta(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" · ");
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

function taskTitle(task: OfferTaskItem): string {
  const titled = task.title?.trim();
  if (titled) return titled;
  const notes = task.notes.trim().replace(/\s+/g, " ");
  if (notes.length <= 72) return notes || "Tarea";
  return `${notes.slice(0, 71)}…`;
}

/** Requisitos + tareas pendientes → ítems de «Qué falta». */
export function buildMissingItems(
  requirements: OfferRequirementDetail[],
  tasks: OfferTaskItem[],
  now = Date.now(),
): MissingItem[] {
  const items: MissingItem[] = [];
  const seenReq = new Set<string>();

  for (const r of requirements) {
    if (r.compliance_status !== "no_cumple") continue;
    seenReq.add(r.id);
    items.push({
      id: `req-nocumple-${r.id}`,
      severity: "bloqueante",
      tone: "bad",
      title: r.title.trim() || "Requisito",
      meta: joinMeta([
        REQ_TYPE_LABEL[r.requirement_type] ?? r.requirement_type,
        "No cumple",
        shortPerson(r.owner_member?.display_name),
      ]),
    });
  }

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
      severity: "bloqueante",
      tone: "bad",
      title: r.title.trim() || "Requisito excluyente",
      meta: joinMeta([
        "Excluyente",
        unverified ? "Sin verificar" : null,
        unassigned
          ? "Sin asignar"
          : shortPerson(r.owner_member?.display_name),
      ]),
    });
  }

  for (const r of requirements) {
    if (seenReq.has(r.id)) continue;
    if (r.prep_status === "listo") continue;
    const bucket = dueBucket(r.internal_due_at, now);
    const person = shortPerson(r.owner_member?.display_name) ?? "Sin asignar";
    const typeLabel =
      REQ_TYPE_LABEL[r.requirement_type] ?? r.requirement_type;
    const title = r.title.trim() || "Requisito";

    if (bucket === "overdue" || bucket === "soon") {
      seenReq.add(r.id);
      items.push({
        id: `req-plazo-${r.id}`,
        severity: "plazo",
        tone: "warn",
        title,
        meta: joinMeta([
          typeLabel,
          bucket === "overdue"
            ? "Vencido"
            : r.internal_due_at
              ? `Vence ${formatDateMadrid(r.internal_due_at)}`
              : null,
          person,
        ]),
      });
      continue;
    }

    seenReq.add(r.id);
    items.push({
      id: `req-riesgo-${r.id}`,
      severity: "riesgo",
      tone: "warn",
      title,
      meta: joinMeta([
        typeLabel,
        "Pendiente de preparar",
        r.internal_due_at
          ? `Vence ${formatDateMadrid(r.internal_due_at)}`
          : null,
        person,
      ]),
    });
  }

  for (const t of tasks) {
    if (t.status !== "pendiente") continue;
    const bucket = dueBucket(t.due_at, now);
    const person = shortPerson(t.owner_member?.display_name) ?? "Sin asignar";
    const title = taskTitle(t);

    if (bucket === "overdue" || bucket === "soon") {
      items.push({
        id: `task-plazo-${t.id}`,
        severity: "plazo",
        tone: "warn",
        title,
        meta: joinMeta([
          "Tarea",
          bucket === "overdue"
            ? "Vencida"
            : t.due_at
              ? `Para el ${formatDateMadrid(t.due_at)}`
              : null,
          person,
        ]),
      });
      continue;
    }

    items.push({
      id: `task-riesgo-${t.id}`,
      severity: "riesgo",
      tone: "warn",
      title,
      meta: joinMeta([
        "Tarea",
        "Pendiente",
        t.due_at ? `Para el ${formatDateMadrid(t.due_at)}` : null,
        person,
      ]),
    });
  }

  items.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  return items;
}

export function OfferMissingPanel({ items }: { items: MissingItem[] }) {
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
            <li
              key={m.id}
              className={cn(
                "rounded-r-md border-l-4 px-3 py-2 text-sm",
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
              {m.meta ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{m.meta}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
