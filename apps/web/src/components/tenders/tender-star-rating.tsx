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
const GOLD_SOFT_BG = "color-mix(in srgb, #e8b923 14%, transparent)";
const GOLD_HOVER_BG = "color-mix(in srgb, #e8b923 10%, transparent)";
const GOLD_BORDER_SOFT = "color-mix(in srgb, #e8b923 45%, transparent)";

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
 * Compacto: pill dorada «3★ Eficen» / «3★ Sub».
 * Clic en la misma estrella que la nota → quita la puntuación.
 */
export function TenderStarRating({
  rating,
  disabled = false,
  /** Preselección (p. ej. kind de la alerta) si aún no hay valoración. */
  defaultInterestKind = null,
  onChange,
}: {
  rating: TenderRating | null;
  disabled?: boolean;
  defaultInterestKind?: TenderInterestKind | null;
  onChange: (next: TenderRating | null) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [draftKind, setDraftKind] = useState<TenderInterestKind | null>(
    rating?.interestKind ?? defaultInterestKind ?? null,
  );
  const [nudgeKey, setNudgeKey] = useState(0);
  const [showNudge, setShowNudge] = useState(false);

  useEffect(() => {
    if (rating != null) {
      setEditing(false);
      setDraftKind(rating.interestKind);
      setShowNudge(false);
    } else {
      setDraftKind(defaultInterestKind ?? null);
    }
  }, [rating, defaultInterestKind]);

  // La animación solo mientras dura; no debe repetirse al reabrir el editor.
  useEffect(() => {
    if (!showNudge) return;
    const id = window.setTimeout(() => setShowNudge(false), 420);
    return () => window.clearTimeout(id);
  }, [showNudge, nudgeKey]);

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
      else setDraftKind(defaultInterestKind ?? null);
    } finally {
      setPending(false);
    }
  }

  function nudgeKinds() {
    setNudgeKey((k) => k + 1);
    setShowNudge(true);
  }

  function toggleKind(kind: TenderInterestKind) {
    // Con nota ya guardada no se puede dejar sin clasificar (solo cambiar).
    if (score != null && draftKind === kind) return;
    const nextKind =
      score == null && draftKind === kind ? null : kind;
    setDraftKind(nextKind);
    setShowNudge(false);
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
        onClick={() => {
          setShowNudge(false);
          setEditing(true);
        }}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums transition-opacity",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          (disabled || pending) && "opacity-60",
        )}
        style={{
          color: GOLD,
          borderColor: GOLD_BORDER_SOFT,
          backgroundColor: GOLD_SOFT_BG,
        }}
        aria-label={
          kindLabel
            ? `Puntuación ${rating.score} de 5 (${kindLabel}). Pulsar para cambiar.`
            : `Puntuación ${rating.score} de 5. Pulsar para cambiar.`
        }
        title="Cambiar puntuación"
      >
        <span className="inline-flex items-center gap-0.5">
          <span>{rating.score}</span>
          <StarIcon filled className="size-3.5" />
        </span>
        {kindLabel ? <span>{kindLabel}</span> : null}
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
          showNudge && "interest-chip-nudge",
        )}
        role="group"
        aria-label="Tipo de interés (elige antes de puntuar)"
      >
        <KindChip
          label="Eficen"
          active={draftKind === "propia"}
          disabled={disabled || pending}
          onClick={() => toggleKind("propia")}
        />
        <KindChip
          label="Subcontrata"
          active={draftKind === "subcontrata"}
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
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-pressed={active}
      className={cn(
        "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
        !active && !hovered && "border-border bg-background text-muted-foreground",
        disabled && "opacity-60",
      )}
      style={
        active
          ? {
              color: GOLD,
              borderColor: GOLD,
              backgroundColor: GOLD_SOFT_BG,
            }
          : hovered
            ? {
                color: GOLD,
                borderColor: GOLD_BORDER_SOFT,
                backgroundColor: GOLD_HOVER_BG,
              }
            : undefined
      }
    >
      {label}
    </button>
  );
}
