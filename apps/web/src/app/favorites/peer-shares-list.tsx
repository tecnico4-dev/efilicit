import Link from "next/link";
import { FavoriteKindBubble } from "@/components/favorites/favorite-kind-bubble";
import { formatCpvListPreview } from "@/lib/cpv";
import { formatTenderStatus } from "@/lib/tender-labels";
import type { FavoriteShareRow } from "@/lib/queries";
import { formatMoney } from "./favorites-shared";
import { RemoveFavoriteShareButton } from "./remove-favorite-share-button";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      timeZone: "Europe/Madrid",
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function PeerSharesList({ items }: { items: FavoriteShareRow[] }) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {items.map((row) => {
        const title = row.tender?.title?.trim() || "Licitación";
        const who = row.counterpartDisplayName?.trim() || "Otro usuario";
        const directionLabel =
          row.direction === "sent" ? `Enviada a ${who}` : `Recibida de ${who}`;
        return (
          <li key={row.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    row.direction === "sent"
                      ? "inline-flex rounded-full border border-sky-600/30 bg-sky-600/10 px-2 py-0.5 text-[11px] font-medium text-sky-900"
                      : "inline-flex rounded-full border border-amber-600/30 bg-amber-600/10 px-2 py-0.5 text-[11px] font-medium text-amber-900"
                  }
                >
                  {row.direction === "sent" ? "Enviada" : "Recibida"}
                </span>
                <FavoriteKindBubble kind={row.kind} />
              </div>
              <Link
                href={`/tenders/${row.tenderId}?from=favorites-shared`}
                className="text-sm font-medium text-link hover:underline"
              >
                {title}
              </Link>
              <p className="text-xs text-muted-foreground">
                {directionLabel} · {formatWhen(row.createdAt)}
              </p>
              {row.tender ? (
                <p className="text-xs text-muted-foreground">
                  {formatMoney(row.tender.estimated_value, row.tender.currency)}
                  {" · "}
                  {formatCpvListPreview(row.tender.cpv_codes)}
                  {" · "}
                  {formatTenderStatus(row.tender.status)}
                </p>
              ) : null}
              {row.notes?.trim() ? (
                <p className="rounded-md border border-dashed border-border px-2 py-1.5 text-xs text-foreground">
                  Nota: {row.notes.trim()}
                </p>
              ) : null}
            </div>
            <div className="shrink-0">
              <RemoveFavoriteShareButton shareId={row.id} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
