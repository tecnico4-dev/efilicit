"use client";

import Link from "next/link";
import { FavoriteKindBubble } from "@/components/favorites/favorite-kind-bubble";
import { favoriteKindLongLabel, type RecommendationItem } from "@/lib/queries";
import { formatDateTimeMadrid } from "@/lib/datetime";
import { formatTenderStatus } from "@/lib/tender-labels";
import { cn } from "@/lib/cn";
import { formatMoney } from "../favorites/favorites-shared";

function KanbanCard({ item }: { item: RecommendationItem }) {
  const interestQs = item.profileKind
    ? `&interest=${item.profileKind}`
    : "";
  const href = `/tenders/${item.tenderId}?from=recommendations&tab=todas${interestQs}`;

  return (
    <li className="rounded-md border border-border bg-background px-3 py-2.5 shadow-sm">
      <Link
        href={href}
        className="line-clamp-3 text-sm font-medium text-foreground hover:text-link hover:underline"
      >
        {item.title}
      </Link>
      <dl className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
        <div>
          <dt className="inline">Plazo: </dt>
          <dd className="inline">
            {item.deadlineAt ? formatDateTimeMadrid(item.deadlineAt) : "—"}
          </dd>
        </div>
        <div>
          <dt className="inline">Estado: </dt>
          <dd className="inline">{formatTenderStatus(item.status)}</dd>
        </div>
        <div>
          <dt className="inline">Importe: </dt>
          <dd className="inline">
            {formatMoney(item.estimatedValue, item.currency)}
          </dd>
        </div>
      </dl>
    </li>
  );
}

function KanbanColumn({
  title,
  kind,
  items,
}: {
  title: string;
  kind: "propia" | "subcontrata" | null;
  items: RecommendationItem[];
}) {
  return (
    <section className="flex min-h-[20rem] min-w-0 flex-col rounded-lg border border-border bg-muted/30">
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-surface/80 px-3 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {kind ? <FavoriteKindBubble kind={kind} /> : null}
        <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground ring-1 ring-border">
          {items.length}
        </span>
      </header>
      {items.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-muted-foreground">
          Ninguna en esta columna.
        </p>
      ) : (
        <ul className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
          {items.map((item) => (
            <KanbanCard key={item.tenderId} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Vista Kanban: columnas Eficen | Subcontrata (+ Sin clasificar si hay)
 * para comparar categorías lado a lado.
 */
export function RecommendationsKanban({
  propias,
  subcontratas,
  sinPerfil,
}: {
  propias: RecommendationItem[];
  subcontratas: RecommendationItem[];
  sinPerfil: RecommendationItem[];
}) {
  const showOtros = sinPerfil.length > 0;

  return (
    <div
      className={cn(
        "grid gap-3",
        showOtros ? "lg:grid-cols-3" : "md:grid-cols-2",
      )}
    >
      <KanbanColumn
        title={favoriteKindLongLabel("propia")}
        kind="propia"
        items={propias}
      />
      <KanbanColumn
        title={favoriteKindLongLabel("subcontrata")}
        kind="subcontrata"
        items={subcontratas}
      />
      {showOtros ? (
        <KanbanColumn
          title="Sin clasificar"
          kind={null}
          items={sinPerfil}
        />
      ) : null}
    </div>
  );
}
