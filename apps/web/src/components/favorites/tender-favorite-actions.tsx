"use client";

import { useState } from "react";
import { ShareFavoriteButton } from "@/app/favorites/share-favorite-button";
import {
  type FavoriteKind,
  type SharedFavoriteOwnerInfo,
} from "@/lib/queries";
import { FavoriteHeartButton } from "./favorite-heart-button";

/**
 * Ficha: corazón + avión (Común | Personas).
 * El avión usa el kind del favorito o, si aún no hay, `shareKindHint`
 * (p. ej. interés de la recomendación/alerta).
 */
export function TenderFavoriteActions({
  userId,
  tenderId,
  tenderTitle,
  initiallyFavorited,
  initialKind,
  initialSharedOwner,
  shareKindHint = null,
}: {
  userId: string;
  tenderId: string;
  tenderTitle: string;
  initiallyFavorited: boolean;
  initialKind: FavoriteKind | null;
  initialSharedOwner: SharedFavoriteOwnerInfo | null;
  /** Kind por defecto para compartir si aún no es favorito. */
  shareKindHint?: FavoriteKind | null;
}) {
  const [favorited, setFavorited] = useState(initiallyFavorited);
  const [kind, setKind] = useState<FavoriteKind | null>(initialKind);
  const [sharedOwner, setSharedOwner] = useState(initialSharedOwner);
  const shareKind = kind ?? shareKindHint;

  return (
    <div className="flex flex-wrap items-center gap-1">
      <FavoriteHeartButton
        userId={userId}
        tenderId={tenderId}
        tenderTitle={tenderTitle}
        initiallyFavorited={favorited}
        onFavoritedChange={(_id, next, nextKind) => {
          setFavorited(next);
          setKind(next ? nextKind : null);
          if (!next) setSharedOwner(null);
        }}
      />
      {shareKind ? (
        <ShareFavoriteButton
          userId={userId}
          tenderId={tenderId}
          tenderTitle={tenderTitle}
          kind={shareKind}
          alreadySharedOwner={sharedOwner}
        />
      ) : null}
    </div>
  );
}
