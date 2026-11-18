"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FavoriteKindBubble } from "@/components/favorites/favorite-kind-bubble";
import { useUndoToast } from "@/components/undo-toast";
import { formatDateTimeMadrid } from "@/lib/datetime";
import {
  upsertOwnTenderRating,
  type RecommendationItem,
  type RecommendationProfileKind,
} from "@/lib/queries";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatTenderStatus } from "@/lib/tender-labels";
import { formatMoney } from "../favorites/favorites-shared";

/** Lista de recomendaciones (una página o bloque). */
export function RecommendationList({
  items,
  userId,
  showKindBubble = true,
  bordered = false,
  listTab = "todas",
}: {
  items: RecommendationItem[];
  userId: string;
  showKindBubble?: boolean;
  bordered?: boolean;
  /** Pestaña activa (Todas/Eficen/Sub) para el «Volver» de la ficha. */
  listTab?: "todas" | RecommendationProfileKind;
}) {
  const router = useRouter();
  const { showStatus } = useUndoToast();
  const [hidden, setHidden] = useState<string[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const visible = items.filter((i) => !hidden.includes(i.tenderId));

  async function onNotInterested(item: RecommendationItem) {
    if (pendingId) return;
    setPendingId(item.tenderId);
    setHidden((h) => [...h, item.tenderId]);
    const client = createSupabaseBrowserClient();
    const { error } = await upsertOwnTenderRating(client, {
      userId,
      tenderId: item.tenderId,
      score: 1,
      interestKind: item.profileKind,
    });
    setPendingId(null);
    if (error) {
      setHidden((h) => h.filter((id) => id !== item.tenderId));
      showStatus(`No se pudo guardar: ${error.message}`);
      return;
    }
    router.refresh();
  }

  if (visible.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Ninguna en esta lista.
      </p>
    );
  }

  return (
    <ul
      className={
        bordered
          ? "divide-y divide-border border-t border-border"
          : "divide-y divide-border"
      }
    >
      {visible.map((item) => (
        <li key={`${item.profileKind}-${item.tenderId}`} className="py-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Link
                href={`/tenders/${item.tenderId}?from=recommendations&tab=${listTab}&interest=${item.profileKind}`}
                className="text-base font-medium text-foreground hover:text-link hover:underline"
              >
                {item.title}
              </Link>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {showKindBubble ? (
                  <FavoriteKindBubble kind={item.profileKind} />
                ) : null}
                <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <div>
                    <dt className="inline">Plazo: </dt>
                    <dd className="inline">
                      {item.deadlineAt
                        ? formatDateTimeMadrid(item.deadlineAt)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">Estado: </dt>
                    <dd className="inline">
                      {formatTenderStatus(item.status)}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">Importe: </dt>
                    <dd className="inline">
                      {formatMoney(item.estimatedValue, item.currency)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
            <button
              type="button"
              disabled={pendingId === item.tenderId}
              onClick={() => void onNotInterested(item)}
              className="shrink-0 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              No me interesa
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export type { RecommendationProfileKind };
