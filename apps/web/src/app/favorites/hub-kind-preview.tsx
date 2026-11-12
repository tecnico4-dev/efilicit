"use client";

import type { ReactNode } from "react";
import { FavoriteKindTabs } from "./favorite-kind-tabs";

const HUB_KIND_PREVIEW = 3;

/**
 * Preview del hub Favoritos: pestañas Eficen / Subcontrata con recorte por pestaña.
 */
export function HubKindPreview<T>({
  propias,
  subcontratas,
  render,
}: {
  propias: T[];
  subcontratas: T[];
  render: (items: T[]) => ReactNode;
}) {
  return (
    <FavoriteKindTabs
      ariaLabel="Tipo"
      propiasCount={propias.length}
      subcontratasCount={subcontratas.length}
      propias={
        propias.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">Ninguna aún.</p>
        ) : (
          render(propias.slice(0, HUB_KIND_PREVIEW))
        )
      }
      subcontratas={
        subcontratas.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">Ninguna aún.</p>
        ) : (
          render(subcontratas.slice(0, HUB_KIND_PREVIEW))
        )
      }
    />
  );
}
