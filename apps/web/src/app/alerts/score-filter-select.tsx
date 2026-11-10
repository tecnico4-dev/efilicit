"use client";

import { useRef, useState } from "react";
import { AnchoredPortal } from "@/components/ui/anchored-portal";
import { cn } from "@/lib/cn";
import type { TenderScore } from "@/lib/queries";

const ALL_SCORES: TenderScore[] = [1, 2, 3, 4, 5];

/**
 * Resumen cerrado del filtro multi-puntuación.
 * Vacío o las 5 → «Cualquiera»; rangos con `-`; huecos con `, `.
 * Ej.: `1★` · `1★-3★` · `4★-5★` · `1★, 3★-5★`
 */
export function formatScoreFilterSummary(
  scores: readonly TenderScore[],
): string {
  const unique = [
    ...new Set(
      scores.filter(
        (s): s is TenderScore =>
          s === 1 || s === 2 || s === 3 || s === 4 || s === 5,
      ),
    ),
  ].sort((a, b) => a - b);

  if (unique.length === 0 || unique.length === ALL_SCORES.length) {
    return "Cualquiera";
  }

  const runs: [TenderScore, TenderScore][] = [];
  let start = unique[0]!;
  let prev = unique[0]!;
  for (let i = 1; i < unique.length; i++) {
    const n = unique[i]!;
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    runs.push([start, prev]);
    start = n;
    prev = n;
  }
  runs.push([start, prev]);

  return runs
    .map(([a, b]) => (a === b ? `${a}★` : `${a}★-${b}★`))
    .join(", ");
}

function normalizeScores(scores: readonly TenderScore[]): TenderScore[] {
  const unique = [
    ...new Set(
      scores.filter(
        (s): s is TenderScore =>
          s === 1 || s === 2 || s === 3 || s === 4 || s === 5,
      ),
    ),
  ].sort((a, b) => a - b);
  if (unique.length === ALL_SCORES.length) return [];
  return unique;
}

/**
 * Multi-select de puntuación (1★…5★) con «Cualquiera» por defecto.
 * Vacío = sin filtro de nota (entre valoradas).
 */
export function ScoreFilterSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: readonly TenderScore[];
  onChange: (next: TenderScore[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = normalizeScores(value);
  const isAny = selected.length === 0;
  const summary = formatScoreFilterSummary(selected);

  function toggle(score: TenderScore) {
    const set = new Set(selected);
    if (set.has(score)) set.delete(score);
    else set.add(score);
    onChange(normalizeScores([...set]));
  }

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs text-muted-foreground"
      >
        Puntuación
      </label>
      <div className="relative mt-1">
        <button
          ref={triggerRef}
          type="button"
          id={id}
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex h-9 w-full min-w-[7rem] items-center justify-between gap-2 rounded-md border border-border bg-background px-2 text-left text-sm text-foreground outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50",
          )}
        >
          <span className="min-w-0 truncate">{summary}</span>
          <span aria-hidden className="shrink-0 text-xs text-muted-foreground">
            ▾
          </span>
        </button>
        <AnchoredPortal
          open={open}
          anchorRef={triggerRef}
          onDismiss={() => setOpen(false)}
          className="flex flex-col overflow-hidden bg-surface p-0"
          maxHeight={280}
          overflowY="hidden"
          matchAnchorWidth={false}
          minWidth={160}
        >
          <ul
            role="listbox"
            aria-multiselectable
            aria-label="Puntuación"
            className="py-1"
          >
            <li role="option" aria-selected={isAny}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
                  isAny
                    ? "bg-primary/10 font-medium text-foreground"
                    : "text-foreground hover:bg-muted",
                )}
                onClick={() => {
                  onChange([]);
                  setOpen(false);
                }}
              >
                Cualquiera
              </button>
            </li>
            {ALL_SCORES.map((score) => {
              const checked = selected.includes(score);
              return (
                <li key={score} role="option" aria-selected={checked}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted">
                    <input
                      type="checkbox"
                      className="ef-checkbox"
                      checked={checked}
                      onChange={() => toggle(score)}
                    />
                    <span>{score}★</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </AnchoredPortal>
      </div>
    </div>
  );
}
