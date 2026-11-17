import Link from "next/link";
import { FavoriteKindBubble } from "@/components/favorites/favorite-kind-bubble";
import { ShareDirectionBubble } from "@/components/favorites/share-direction-bubble";
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

/** Listado peer-share con el mismo layout que Común. */
export function PeerSharesList({
  items,
  bordered = true,
  noteWide = false,
  showKindBubble = true,
}: {
  items: FavoriteShareRow[];
  bordered?: boolean;
  noteWide?: boolean;
  /** False en pestaña Eficen/Subcontrata (todas son del mismo kind). */
  showKindBubble?: boolean;
}) {
  return (
    <ul
      className={
        bordered
          ? "divide-y divide-border border-t border-border"
          : "divide-y divide-border"
      }
    >
      {items.map((row) => {
        const tender = row.tender;
        if (!tender) {
          return (
            <li key={row.id} className="py-4 text-sm text-muted-foreground">
              Licitación no disponible
            </li>
          );
        }
        const who = row.counterpartDisplayName?.trim() || "Otro usuario";
        const meta =
          row.direction === "sent"
            ? `Enviada a ${who} (${formatWhen(row.createdAt)})`
            : `Recibida de ${who} (${formatWhen(row.createdAt)})`;
        const note = row.notes?.trim() || "";
        return (
          <li key={row.id} className="flex items-start gap-3 py-4">
            <div className="min-w-0 flex-1">
              <Link
                href={`/tenders/${tender.id}?from=favorites-shared`}
                className="text-base font-medium text-foreground hover:text-link hover:underline"
              >
                {tender.title}
              </Link>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <ShareDirectionBubble direction={row.direction} />
                    {showKindBubble ? (
                      <FavoriteKindBubble kind={row.kind} />
                    ) : null}
                    <p className="text-xs text-muted-foreground">{meta}</p>
                  </div>
                  <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <div>
                      <dt className="inline text-muted-foreground">Importe: </dt>
                      <dd className="inline">
                        {formatMoney(
                          tender.estimated_value,
                          tender.currency,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline text-muted-foreground">CPV: </dt>
                      <dd className="inline font-mono">
                        {formatCpvListPreview(tender.cpv_codes)}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline text-muted-foreground">Estado: </dt>
                      <dd className="inline">
                        {formatTenderStatus(tender.status)}
                      </dd>
                    </div>
                  </dl>
                </div>
                {note ? (
                  <p
                    className={
                      noteWide
                        ? "w-full min-w-0 rounded-md border border-dashed border-border px-2.5 py-1.5 text-sm text-muted-foreground sm:ml-auto sm:min-w-[14rem] sm:max-w-[min(100%,36rem)] sm:flex-1"
                        : "w-full shrink-0 rounded-md border border-dashed border-border px-2.5 py-1.5 text-sm text-muted-foreground sm:ml-auto sm:w-[min(100%,16rem)]"
                    }
                  >
                    <span className="font-medium text-foreground">Nota:</span>{" "}
                    {note}
                  </p>
                ) : null}
              </div>
            </div>
            <RemoveFavoriteShareButton shareId={row.id} />
          </li>
        );
      })}
    </ul>
  );
}
