"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FavoriteKindBubble } from "@/components/favorites/favorite-kind-bubble";
import { FavoriteHeartButton } from "@/components/favorites/favorite-heart-button";
import { TenderStarRating } from "@/components/tenders/tender-star-rating";
import { ShareFavoriteButton } from "@/app/favorites/share-favorite-button";
import { useUndoToast } from "@/components/undo-toast";
import { formatDateTimeMadrid } from "@/lib/datetime";
import {
  upsertOwnTenderRating,
  type FavoriteKind,
  type RecommendationItem,
  type RecommendationProfileKind,
  type TenderRating,
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
  const [ratingOpenId, setRatingOpenId] = useState<string | null>(null);
  /** Kind del corazón si el usuario guarda favorito (para el avión). */
  const [shareKindById, setShareKindById] = useState<
    Record<string, FavoriteKind>
  >({});

  const visible = items.filter((i) => !hidden.includes(i.tenderId));

  async function persistRating(
    tenderId: string,
    next: TenderRating | null,
    interestFallback: RecommendationProfileKind | null,
  ) {
    const client = createSupabaseBrowserClient();
    if (next == null) {
      return { error: null as Error | null };
    }
    return upsertOwnTenderRating(client, {
      userId,
      tenderId,
      score: next.score,
      interestKind: next.interestKind ?? interestFallback,
    });
  }

  async function onNotInterested(item: RecommendationItem) {
    if (pendingId) return;
    setPendingId(item.tenderId);
    setHidden((h) => [...h, item.tenderId]);
    const { error } = await persistRating(
      item.tenderId,
      { score: 1, interestKind: item.profileKind },
      item.profileKind,
    );
    setPendingId(null);
    if (error) {
      setHidden((h) => h.filter((id) => id !== item.tenderId));
      showStatus(`No se pudo guardar: ${error.message}`);
      return;
    }
    setRatingOpenId(null);
    router.refresh();
  }

  async function onRate(
    item: RecommendationItem,
    next: TenderRating | null,
  ) {
    if (next == null) return;
    setPendingId(item.tenderId);
    const { error } = await persistRating(
      item.tenderId,
      next,
      item.profileKind,
    );
    setPendingId(null);
    if (error) {
      showStatus(`No se pudo guardar: ${error.message}`);
      return;
    }
    setHidden((h) => (h.includes(item.tenderId) ? h : [...h, item.tenderId]));
    setRatingOpenId(null);
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
      {visible.map((item) => {
        const interestQs = item.profileKind
          ? `&interest=${item.profileKind}`
          : "";
        const detailHref = `/tenders/${item.tenderId}?from=recommendations&tab=${listTab}${interestQs}`;
        const shareKind =
          shareKindById[item.tenderId] ?? item.profileKind ?? null;
        const ratingOpen = ratingOpenId === item.tenderId;

        return (
          <li key={item.tenderId} className="py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={detailHref}
                  className="text-base font-medium text-foreground hover:text-link hover:underline"
                >
                  {item.title}
                </Link>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  {showKindBubble && item.profileKind ? (
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

              <div className="flex shrink-0 flex-col items-center gap-0.5">
                <div className="flex items-center justify-center gap-0.5">
                  <FavoriteHeartButton
                    userId={userId}
                    tenderId={item.tenderId}
                    tenderTitle={item.title}
                    initiallyFavorited={false}
                    onFavoritedChange={(id, favorited, kind) => {
                      if (favorited && kind) {
                        setShareKindById((prev) => ({ ...prev, [id]: kind }));
                        setHidden((h) =>
                          h.includes(id) ? h : [...h, id],
                        );
                        router.refresh();
                      } else {
                        setShareKindById((prev) => {
                          const next = { ...prev };
                          delete next[id];
                          return next;
                        });
                      }
                    }}
                  />
                  {shareKind ? (
                    <ShareFavoriteButton
                      userId={userId}
                      tenderId={item.tenderId}
                      tenderTitle={item.title}
                      kind={shareKind}
                    />
                  ) : null}
                </div>

                {ratingOpen ? (
                  <div className="flex flex-col items-center">
                    <TenderStarRating
                      rating={null}
                      defaultInterestKind={item.profileKind}
                      disabled={pendingId === item.tenderId}
                      onChange={(next) => void onRate(item, next)}
                    />
                    <button
                      type="button"
                      className="mt-1 text-[11px] text-muted-foreground hover:underline"
                      onClick={() => setRatingOpenId(null)}
                    >
                      Cerrar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary hover:underline"
                    onClick={() => setRatingOpenId(item.tenderId)}
                  >
                    Valorar
                  </button>
                )}

                <button
                  type="button"
                  disabled={pendingId === item.tenderId}
                  onClick={() => void onNotInterested(item)}
                  className="text-xs text-destructive hover:underline disabled:opacity-50"
                >
                  No me interesa
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export type { RecommendationProfileKind };
