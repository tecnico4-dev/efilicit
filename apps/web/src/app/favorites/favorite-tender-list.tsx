"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FavoriteHeartButton } from "@/components/favorites/favorite-heart-button";
import { FavoriteKindBubble } from "@/components/favorites/favorite-kind-bubble";
import { useUndoToast } from "@/components/undo-toast";
import { formatCpvListPreview } from "@/lib/cpv";
import {
  addOwnFavorite,
  type FavoriteKind,
  type FavoriteWithTender,
  type SharedFavoriteOwnerInfo,
} from "@/lib/queries";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatTenderStatus } from "@/lib/tender-labels";
import { formatMoney } from "./favorites-shared";
import { ShareToCommonButton } from "./share-to-common-button";

/**
 * Lista de favoritos propios: corazón (quitar + Revertir) a la izquierda del avión.
 */
export function FavoriteTenderList({
  favorites,
  from = "favorites",
  bordered = true,
  shareUserId,
  sharedOwners,
}: {
  favorites: FavoriteWithTender[];
  from?: "favorites" | "favorites-tenders";
  bordered?: boolean;
  /** Usuario: corazón siempre; avión a Común si hay listado ampliado. */
  shareUserId?: string;
  sharedOwners?: Readonly<Record<string, SharedFavoriteOwnerInfo>>;
}) {
  const router = useRouter();
  const { showUndo } = useUndoToast();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());

  const visible = favorites.filter((f) => !hiddenIds.has(f.id));
  const showShare = Boolean(shareUserId);

  function hideFavorite(favId: string, tenderId: string, kind: FavoriteKind) {
    setHiddenIds((prev) => new Set(prev).add(favId));
    showUndo("Has quitado la licitación de favoritos.", async () => {
      if (!shareUserId) return;
      const client = createSupabaseBrowserClient();
      await addOwnFavorite(client, {
        userId: shareUserId,
        tenderId,
        kind,
      });
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.delete(favId);
        return next;
      });
      router.refresh();
    });
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
      {visible.map((fav) => {
        const tender = fav.tenders;
        if (!tender) {
          return (
            <li key={fav.id} className="py-4 text-sm text-muted-foreground">
              Licitación no disponible
            </li>
          );
        }
        return (
          <li key={fav.id} className="flex items-start gap-3 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/tenders/${tender.id}?from=${from}`}
                  className="text-base font-medium text-foreground hover:text-link hover:underline"
                >
                  {tender.title}
                </Link>
                <FavoriteKindBubble kind={fav.kind} />
              </div>
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <div>
                  <dt className="inline text-muted-foreground">Importe: </dt>
                  <dd className="inline">
                    {formatMoney(tender.estimated_value, tender.currency)}
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
                  <dd className="inline">{formatTenderStatus(tender.status)}</dd>
                </div>
              </dl>
            </div>
            {shareUserId ? (
              <div className="flex shrink-0 items-start gap-0.5">
                <FavoriteHeartButton
                  userId={shareUserId}
                  tenderId={tender.id}
                  tenderTitle={tender.title}
                  initiallyFavorited
                  onFavoritedChange={(_id, favorited) => {
                    if (!favorited) {
                      hideFavorite(fav.id, tender.id, fav.kind);
                    }
                  }}
                />
                {showShare ? (
                  <ShareToCommonButton
                    userId={shareUserId}
                    tenderId={tender.id}
                    tenderTitle={tender.title}
                    kind={fav.kind}
                    alreadySharedOwner={sharedOwners?.[tender.id] ?? null}
                  />
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
