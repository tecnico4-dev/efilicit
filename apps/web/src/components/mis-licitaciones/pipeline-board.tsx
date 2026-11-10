"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  OFFER_STAGE_LABELS,
  type OfferCaseListItem,
  type OfferStage,
} from "@/lib/queries";
import { formatCountdown } from "@/lib/bid-countdown";
import { formatDateMadrid } from "@/lib/datetime";
import { CaseStageBadge } from "@/components/mis-licitaciones/case-stage-badge";
import {
  DEFAULT_PAGE_SIZE,
  ListPager,
  type PageSize,
} from "@/app/favorites/list-pager";
import { cn } from "@/lib/cn";

type Scope = "active" | "historic";

const ACTIVE_KANBAN: { label: string; stages: OfferStage[] }[] = [
  { label: "Interés / Análisis", stages: ["interes", "analisis"] },
  { label: "En preparación", stages: ["preparacion"] },
  { label: "Presentada / Evaluación", stages: ["presentada", "en_evaluacion"] },
  { label: "Requerimiento", stages: ["requerimiento"] },
];

const HISTORIC_KANBAN: { label: string; stages: OfferStage[] }[] = [
  { label: "Adjudicada", stages: ["adjudicada"] },
  { label: "No adjudicada", stages: ["no_adjudicada"] },
  { label: "Subcontrata", stages: ["subcontrata"] },
  { label: "Descartada / Desierta", stages: ["descartada", "desierta"] },
];

function formatMoneySafe(
  value: number | null | undefined,
  currency: string | undefined,
): string {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency ?? ""}`;
  }
}

function prepPct(item: OfferCaseListItem): number | null {
  if (item.requirements_total <= 0) return null;
  return Math.round(
    (item.requirements_ready / item.requirements_total) * 100,
  );
}

function riskTone(
  item: OfferCaseListItem,
  scope: Scope,
): { label: string; className: string } | null {
  if (scope === "historic") return null;
  const due =
    item.next_due_at ??
    item.internal_deadline_at ??
    item.tenders?.deadline_at ??
    null;
  const cd = formatCountdown(due);
  if (cd.tone === "overdue") {
    return {
      label: "🔴 Crítico",
      className: "border-destructive/40 bg-destructive/10 text-destructive",
    };
  }
  if (cd.tone === "soon") {
    return {
      label: "🟠 Ajustado",
      className: "border-amber-300/60 bg-amber-50 text-amber-900",
    };
  }
  if (cd.tone === "ok") {
    return {
      label: "🟢 Holgado",
      className: "border-emerald-300/60 bg-emerald-50 text-emerald-900",
    };
  }
  return null;
}

function CaseListRow({
  item,
  scope,
}: {
  item: OfferCaseListItem;
  scope: Scope;
}) {
  const pct = prepPct(item);
  const risk = riskTone(item, scope);
  const due =
    item.next_due_at ??
    item.internal_deadline_at ??
    item.tenders?.deadline_at ??
    null;
  const cd = formatCountdown(scope === "active" ? due : null);
  return (
    <li>
      <Link
        href={`/mis-licitaciones/${item.id}`}
        className="block px-4 py-4 transition-colors hover:bg-muted/50 sm:px-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">
              {item.tenders?.title ?? "Licitación eliminada"}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <CaseStageBadge stage={item.stage} />
              {item.owner_name ? <span>Resp. {item.owner_name}</span> : null}
              {scope === "historic" &&
              (item.outcome_on || item.presented_on) ? (
                <span>
                  {formatDateMadrid(item.outcome_on ?? item.presented_on)}
                </span>
              ) : null}
              {cd.tone !== "none" ? (
                <span
                  className={cn(
                    "font-medium",
                    cd.tone === "overdue" && "text-destructive",
                    cd.tone === "soon" && "text-amber-700",
                  )}
                >
                  {cd.label}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
              {formatMoneySafe(
                item.tenders?.estimated_value,
                item.tenders?.currency,
              )}
            </span>
            {pct != null ? (
              <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
                Prep. {pct}%
              </span>
            ) : null}
            {item.requirements_total > 0 ? (
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-link">
                {item.requirements_ready}/{item.requirements_total}
              </span>
            ) : null}
            {risk ? (
              <span
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                  risk.className,
                )}
              >
                {risk.label}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}

export function PipelineBoard({
  scope,
  cases,
}: {
  scope: Scope;
  cases: OfferCaseListItem[];
}) {
  const [view, setView] = useState<"lista" | "kanban">("lista");
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const columns = scope === "historic" ? HISTORIC_KANBAN : ACTIVE_KANBAN;

  const total = cases.length;
  const showPager = total > DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pageItems = useMemo(() => {
    const safe = Math.min(Math.max(page, 1), totalPages);
    const start = (safe - 1) * pageSize;
    return cases.slice(start, start + pageSize);
  }, [cases, page, pageSize, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [scope]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function onPageSizeChange(next: number) {
    setPageSize(next as PageSize);
    setPage(1);
  }

  const byStage = useMemo(() => {
    const map = new Map<string, OfferCaseListItem[]>();
    for (const col of columns) {
      map.set(
        col.label,
        cases.filter((c) =>
          (col.stages as readonly string[]).includes(c.stage),
        ),
      );
    }
    return map;
  }, [cases, columns]);

  return (
    <div className="mt-6">
      <div className="mb-4 inline-flex overflow-hidden rounded-md border border-border bg-background">
        <button
          type="button"
          onClick={() => setView("lista")}
          className={cn(
            "px-3 py-1.5 text-sm font-medium transition-colors",
            view === "lista"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Lista
        </button>
        <button
          type="button"
          onClick={() => setView("kanban")}
          className={cn(
            "px-3 py-1.5 text-sm font-medium transition-colors",
            view === "kanban"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Kanban
        </button>
      </div>

      {view === "lista" ? (
        showPager ? (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <ul
              key={`${scope}-${page}-${pageSize}`}
              className="divide-y divide-border"
            >
              {pageItems.map((item) => (
                <CaseListRow key={item.id} item={item} scope={scope} />
              ))}
            </ul>
            <div className="border-t border-border bg-background px-4 py-3 sm:px-5">
              <ListPager
                page={page}
                totalPages={totalPages}
                pageSize={pageSize}
                showing={pageItems.length}
                total={total}
                itemLabel="licitaciones"
                ariaPageSizeLabel="Licitaciones por página"
                onPageChange={setPage}
                onPageSizeChange={onPageSizeChange}
              />
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {pageItems.map((item) => (
              <CaseListRow key={item.id} item={item} scope={scope} />
            ))}
          </ul>
        )
      ) : (
        <div className="grid gap-3 overflow-x-auto pb-2 md:grid-cols-3 lg:grid-cols-4">
          {columns.map((col) => {
            const rows = byStage.get(col.label) ?? [];
            return (
              <section
                key={col.label}
                className="min-w-[220px] rounded-xl border border-border bg-muted/40 p-3"
              >
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {col.label}{" "}
                  <span className="tabular-nums">({rows.length})</span>
                </h3>
                <div className="mt-2 space-y-2">
                  {rows.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border bg-surface/70 px-3 py-4 text-center text-xs text-muted-foreground">
                      Ninguno
                    </p>
                  ) : (
                    rows.map((item) => (
                      <Link
                        key={item.id}
                        href={`/mis-licitaciones/${item.id}`}
                        className="block rounded-lg border border-border bg-surface p-3 text-sm shadow-sm transition-colors hover:border-primary/40"
                      >
                        <p className="font-medium text-foreground">
                          {item.tenders?.title ?? "Licitación eliminada"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatMoneySafe(
                            item.tenders?.estimated_value,
                            item.tenders?.currency,
                          )}
                          {item.owner_name ? ` · ${item.owner_name}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {OFFER_STAGE_LABELS[item.stage as OfferStage] ??
                            item.stage}
                        </p>
                      </Link>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
