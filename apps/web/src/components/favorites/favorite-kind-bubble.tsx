import {
  favoriteKindLabel,
  favoriteKindLongLabel,
  type FavoriteKind,
} from "@/lib/queries";

/** Burbuja Eficen (teal) / Subcontrata (violeta) — favoritos y alertas. */
export function FavoriteKindBubble({ kind }: { kind: FavoriteKind }) {
  const isEficen = kind === "propia";
  return (
    <span
      className={
        isEficen
          ? "inline-flex shrink-0 items-center rounded-full border border-teal-600/35 bg-teal-600/12 px-2 py-0.5 text-[11px] font-medium text-teal-800 dark:text-teal-200"
          : "inline-flex shrink-0 items-center rounded-full border border-violet-500/35 bg-violet-500/12 px-2 py-0.5 text-[11px] font-medium text-violet-800 dark:text-violet-200"
      }
      title={favoriteKindLongLabel(kind)}
    >
      {favoriteKindLabel(kind)}
    </span>
  );
}
