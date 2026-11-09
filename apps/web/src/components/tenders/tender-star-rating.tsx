"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import {
  interestKindShortLabel,
  type TenderInterestKind,
  type TenderRating,
  type TenderScore,
} from "@/lib/queries/tender-ratings";

const GOLD = "#e8b923";
const GOLD_MUTED = "#d4d4d8";

function StarIcon({
  filled,
  className,
}: {
  filled: boolean;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
    >
      <path
        d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.47L12 17.77l-5.8 3.05 1.11-6.47-4.7-4.58 6.49-.94L12 2.5z"
        fill={filled ? GOLD : "none"}
        stroke={filled ? GOLD : GOLD_MUTED}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Puntuación 1–5 + interés (Eficen / Subcontrata) obligatorio antes de puntuar.
 * Compacto: «3★ Eficen», «3★ Sub».
 * Clic en la misma estrella que la nota → quita la puntuación.
 */
export function TenderStarRating({
  rating,
  disabled = false,
  onChange,
}: {
  rating: TenderRating | null;
  disabled?: boolean;
  onChange: (next: TenderRating | null) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [draftKind, setDraftKind] = useState<TenderInterestKind | null>(
    rating?.interestKind ?? null,
  );
  const [nudgeKey, setNudgeKey] = useState(0);

  useEffect(() => {
    if (rating != null) {
      setEditing(false);
      setDraftKind(rating.interestKind);
    } else {
      setDraftKind(null);
    }
  }, [rating]);

  const score = rating?.score ?? null;
  const showStars = rating == null || editing;
  const lit = hover ?? score ?? 0;
  const kindLabel = interestKindShortLabel(rating?.interestKind ?? null);

  async function apply(next: TenderRating | null) {
    if (disabled || pending) return;
    setPending(true);
    try {
      await onChange(next);
      setEditing(next == null);
      setHover(null);
      if (next) setDraftKind(next.interestKind);
      else setDraftKind(null);
    } finally {
      setPending(false);
    }
  }

  function nudgeKinds() {
    setNudgeKey((k) => k + 1);
  }

  function toggleKind(kind: TenderInterestKind) {
    // Con nota ya guardada no se puede dejar sin clasificar (solo cambiar).
    if (score != null && draftKind === kind) return;
    const nextKind =
      score == null && draftKind === kind ? null : kind;
    setDraftKind(nextKind);
    if (score != null && nextKind != null) {
      void apply({ score, interestKind: nextKind });
    }
  }

  async function onStarClick(n: TenderScore) {
    if (score === n) {
      await apply(null);
      return;
    }
    if (draftKind == null) {
      nudgeKinds();
      return;
    }
    await apply({ score: n, interestKind: draftKind });
  }

  if (!showStars && rating != null) {
    return (
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => setEditing(true)}
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-sm font-semibold tabular-nums transition-colors",
          "hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          (disabled || pending) && "opacity-60",
        )}
        style={{ color: GOLD }}
        aria-label={
          kindLabel
            ? `Puntuación ${rating.score} de 5 (${kindLabel}). Pulsar para cambiar.`
            : `Puntuación ${rating.score} de 5. Pulsar para cambiar.`
        }
        title="Cambiar puntuación"
      >
        <span>{rating.score}</span>
        <StarIcon filled className="size-4" />
        {kindLabel ? (
          <span className="ml-0.5 text-xs font-semibold text-foreground">
            {kindLabel}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex flex-col items-end gap-1.5",
        (disabled || pending) && "opacity-60",
      )}
    >
      <div
        key={nudgeKey}
        className={cn(
          "inline-flex items-center gap-1",
          nudgeKey > 0 && "interest-chip-nudge",
        )}
        role="group"
        aria-label="Tipo de interés (elige antes de puntuar)"
      >
        <KindChip
          label="Eficen"
          active={draftKind === "propia"}
          insist={nudgeKey > 0 && draftKind == null}
          disabled={disabled || pending}
          onClick={() => toggleKind("propia")}
        />
        <KindChip
          label="Subcontrata"
          active={draftKind === "subcontrata"}
          insist={nudgeKey > 0 && draftKind == null}
          disabled={disabled || pending}
          onClick={() => toggleKind("subcontrata")}
        />
      </div>
      <div
        className="inline-flex items-center gap-0.5"
        onMouseLeave={() => setHover(null)}
        role="group"
        aria-label="Puntuar licitación"
      >
        {([1, 2, 3, 4, 5] as const).map((n) => {
          const filled = n <= lit;
          return (
            <button
              key={n}
              type="button"
              disabled={disabled || pending}
              className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onClick={() => {
                void onStarClick(n);
              }}
              aria-label={
                score === n
                  ? `Quitar puntuación (${n} estrellas)`
                  : draftKind == null
                    ? `Elige Eficen o Subcontrata antes de puntuar con ${n}`
                    : `Puntuar con ${n} estrellas`
              }
              aria-pressed={score != null && n <= score}
            >
              <StarIcon filled={filled} className="size-5 sm:size-[1.35rem]" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function KindChip({
  label,
  active,
  insist,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  insist?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
        active
          ? "border-primary/50 bg-primary/15 text-primary-dark"
          : insist
            ? "border-primary bg-primary/10 text-primary-dark"
            : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        disabled && "opacity-60",
      )}
    >
      {label}
    </button>
  );
}
