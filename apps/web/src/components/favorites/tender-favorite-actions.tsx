"use client";

import { useState } from "react";
import { ShareToCommonButton } from "@/app/favorites/share-to-common-button";
import {
  type FavoriteKind,
  type SharedFavoriteOwnerInfo,
} from "@/lib/queries";
import { FavoriteHeartButton } from "./favorite-heart-button";

/**
 * Ficha: corazón + avión a Común (solo si está en favoritos).
 */
export function TenderFavoriteActions({
  userId,
  tenderId,
  tenderTitle,
  initiallyFavorited,
  initialKind,
  initialSharedOwner,
}: {
  userId: string;
  tenderId: string;
  tenderTitle: string;
  initiallyFavorited: boolean;
  initialKind: FavoriteKind | null;
  initialSharedOwner: SharedFavoriteOwnerInfo | null;
}) {
  const [favorited, setFavorited] = useState(initiallyFavorited);
  const [kind, setKind] = useState<FavoriteKind | null>(initialKind);
  const [sharedOwner, setSharedOwner] = useState(initialSharedOwner);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {favorited && kind ? (
        <ShareToCommonButton
          userId={userId}
          tenderId={tenderId}
          tenderTitle={tenderTitle}
          kind={kind}
          alreadySharedOwner={sharedOwner}
        />
      ) : null}
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
    </div>
  );
}
