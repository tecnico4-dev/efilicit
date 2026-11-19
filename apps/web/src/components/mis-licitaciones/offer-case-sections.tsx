import { cn } from "@/lib/cn";
import { formatDateTimeMadrid } from "@/lib/datetime";
import {
  PLIEGO_TYPE_LABELS,
  type OfferCasePliego,
  type OfferDeliverableRow,
  type OfferMilestoneRow,
} from "@/lib/queries";
import type { Database } from "@efilicit/types";

type RequirementRow = Database["public"]["Tables"]["offer_requirements"]["Row"];

export const REQUIREMENT_CATEGORY_LABELS: Record<string, string> = {
  habilitacion: "Habilitación",
  solvencia_economica: "Solvencia económica",
  solvencia_tecnica: "Solvencia técnica",
  clasificacion: "Clasificación",
  adscripcion_medios: "Adscripción de medios",
  criterio_adjudicacion: "Criterio de adjudicación",
  garantias: "Garantías",
  administrativo: "Administrativo",
  otros: "Otros",
};

export const ENVELOPE_LABELS: Record<string, string> = {
  A: "Sobre A",
  B: "Sobre B",
  C: "Sobre C",
  requerimiento: "Requerimiento",
  ninguno: "Sin sobre",
};

const ENVELOPE_FALLBACK: Record<"A" | "B" | "C", { title: string; hint: string }> = {
  A: {
    title: "Sobre A · Documentación administrativa",
    hint: "DEUC, declaraciones, solvencia formal.",
  },
  B: {
    title: "Sobre B · Criterios sujetos a juicio de valor",
    hint: "Memoria técnica por criterio.",
  },
  C: {
    title: "Sobre C · Criterios evaluables mediante fórmulas",
    hint: "Oferta económica y mejoras cuantificables.",
  },
};

const FETCH_STATUS: Record<string, { label: string; tone: Tone }> = {
  descargado: { label: "Descargado", tone: "ok" },
  pendiente: { label: "Pendiente de descarga", tone: "warn" },
  solo_enlace: { label: "Solo enlace oficial", tone: "muted" },
  error: { label: "Error de descarga", tone: "bad" },
};

type Tone = "ok" | "warn" | "bad" | "muted";

function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
        tone === "ok" && "border-emerald-300/60 bg-emerald-50 text-emerald-900",
        tone === "warn" && "border-amber-300/60 bg-amber-50 text-amber-900",
        tone === "bad" && "border-destructive/40 bg-destructive/10 text-destructive",
        tone === "muted" && "border-border bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function formatBytes(bytes: number | null): string | null {
  if (bytes == null) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function formatPoints(value: number | null): string | null {
  if (value == null) return null;
  const text = Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(".", ",");
  return `${text} pts`;
}

export function PliegosList({ pliegos }: { pliegos: OfferCasePliego[] }) {
  if (pliegos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        Sin PCAP/PPT/anexos vinculados.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {pliegos.map((p) => {
        const status = FETCH_STATUS[p.fetch_status ?? ""] ?? null;
        const detail = [
          formatBytes(p.byte_size),
          p.fetch_status === "error" ? p.fetch_error : null,
          p.source_key ? null : "Añadido a mano",
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            <span className="inline-flex min-w-14 justify-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {PLIEGO_TYPE_LABELS[p.pliego_type] ?? p.pliego_type}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground" title={p.title}>
                {p.title}
              </p>
              {detail ? (
                <p className="text-xs text-muted-foreground">{detail}</p>
              ) : null}
            </div>
            {status ? <Chip tone={status.tone}>{status.label}</Chip> : null}
            <div className="flex items-center gap-3 text-sm">
              {p.signed_url ? (
                <a
                  href={p.signed_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-link hover:underline"
                >
                  Abrir
                </a>
              ) : null}
              {p.url ? (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  Fuente oficial
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function SobresList({
  deliverables,
  requirements,
}: {
  deliverables: OfferDeliverableRow[];
  requirements: RequirementRow[];
}) {
  const roots = deliverables.filter((d) => d.parent_id == null);
  const childrenOf = (id: string) => deliverables.filter((d) => d.parent_id === id);

  const envelopes = (["A", "B", "C"] as const).map((env) => {
    const root = roots.find((d) => d.envelope === env) ?? null;
    const items = root ? childrenOf(root.id) : [];
    const reqs = requirements.filter((r) => r.envelope === env);
    return { env, root, items, reqs };
  });
  const extraRoots = roots.filter(
    (d) => !envelopes.some((e) => e.root?.id === d.id),
  );

  return (
    <div className="space-y-3">
      {envelopes.map(({ env, root, items, reqs }) => {
        const fallback = ENVELOPE_FALLBACK[env];
        const tracked = items.length > 0 ? items : reqs;
        const done =
          items.length > 0
            ? items.filter((d) => d.status === "listo").length
            : reqs.filter((r) => r.prep_status === "listo").length;
        const progress =
          tracked.length > 0 ? Math.round((done / tracked.length) * 100) : null;
        const points = formatPoints(root?.points_max ?? null);
        return (
          <div key={env} className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium text-foreground">
                {root?.title ?? fallback.title}
              </p>
              <span className="text-xs text-muted-foreground">
                {[points, progress != null ? `${progress}% listo` : "Sin entregables"]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            {progress != null ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${progress}%` }}
                />
              </div>
            ) : null}
            {items.length > 0 ? (
              <ul className="mt-2.5 space-y-1">
                {items.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 text-foreground">{d.title}</span>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      {formatPoints(d.points_max) ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : reqs.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {reqs.length} requisitos de este sobre en la pestaña Requisitos.
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{fallback.hint}</p>
            )}
          </div>
        );
      })}
      {extraRoots.map((d) => (
        <div key={d.id} className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="font-medium text-foreground">{d.title}</p>
        </div>
      ))}
    </div>
  );
}

export function MilestoneRows({ milestones }: { milestones: OfferMilestoneRow[] }) {
  return (
    <>
      {milestones.map((m) => (
        <li
          key={m.id}
          className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border py-2.5"
        >
          <div>
            <p className="font-medium text-foreground">{m.title}</p>
            <p className="text-xs text-muted-foreground">
              {m.kind === "oficial" ? "Oficial · pliego" : "Interno"}
            </p>
          </div>
          <span className="text-foreground">
            {m.due_at ? formatDateTimeMadrid(m.due_at) : "—"}
          </span>
        </li>
      ))}
    </>
  );
}
