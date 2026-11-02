"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import type { TenderScore } from "@/lib/queries/tender-ratings";

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
 * Puntuación 1–5.
 * Sin nota / editando: 5 estrellas. Con nota y colapsado: «3★».
 * Clic en la misma estrella que la nota actual → quita la puntuación.
 */
export function TenderStarRating({
  score,
  disabled = false,
  onChange,
}: {
  score: TenderScore | null;
  disabled?: boolean;
  onChange: (next: TenderScore | null) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

  // Al llegar una nota guardada (p. ej. carga async), mostrar compacto.
  useEffect(() => {
    if (score != null) setEditing(false);
  }, [score]);

  const showStars = score == null || editing;
  const lit = hover ?? score ?? 0;

  async function apply(next: TenderScore | null) {
    if (disabled || pending) return;
    setPending(true);
    try {
      await onChange(next);
      setEditing(next == null);
      setHover(null);
    } finally {
      setPending(false);
    }
  }

  if (!showStars && score != null) {
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
        aria-label={`Puntuación ${score} de 5. Pulsar para cambiar.`}
        title="Cambiar puntuación"
      >
        <span>{score}</span>
        <StarIcon filled className="size-4" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5",
        (disabled || pending) && "opacity-60",
      )}
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
              void apply(score === n ? null : n);
            }}
            aria-label={
              score === n
                ? `Quitar puntuación (${n} estrellas)`
                : `Puntuar con ${n} estrellas`
            }
            aria-pressed={score != null && n <= score}
          >
            <StarIcon filled={filled} className="size-5 sm:size-[1.35rem]" />
          </button>
        );
      })}
    </div>
  );
}
