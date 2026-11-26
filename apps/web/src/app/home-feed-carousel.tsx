"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type HomeFeedSlide = {
  id: string;
  /** Etiqueta corta para el pie / accesibilidad. */
  label: string;
  content: ReactNode;
};

/**
 * Marco fijo bajo las métricas del home: fichas que se deslizan
 * (Recomendadas, Favoritos, …).
 */
export function HomeFeedCarousel({ slides }: { slides: HomeFeedSlide[] }) {
  const [index, setIndex] = useState(0);
  const total = slides.length;
  if (total === 0) return null;

  const safeIndex = Math.min(index, total - 1);

  function go(next: number) {
    setIndex(((next % total) + total) % total);
  }

  return (
    <section
      className="home-anim home-anim-delay-7 mt-10 overflow-hidden rounded-xl border border-border/80 bg-surface/50"
      aria-roledescription="carrusel"
      aria-label="Resumen de actividad"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => go(safeIndex - 1)}
          disabled={total < 2}
          aria-label="Ficha anterior"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <Chevron dir="left" />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-semibold text-foreground">
            {slides[safeIndex]?.label}
          </p>
          <div className="mt-1.5 flex items-center justify-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Ir a ${s.label}`}
                aria-current={i === safeIndex ? "true" : undefined}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === safeIndex
                    ? "w-5 bg-primary"
                    : "w-1.5 bg-border hover:bg-muted-foreground/50",
                )}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => go(safeIndex + 1)}
          disabled={total < 2}
          aria-label="Ficha siguiente"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <Chevron dir="right" />
        </button>
      </div>

      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${safeIndex * 100}%)` }}
        >
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="w-full shrink-0 px-4 py-5 sm:px-5 sm:py-6"
              aria-hidden={slide.id !== slides[safeIndex]?.id}
            >
              {slide.content}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden
    >
      {dir === "left" ? (
        <path d="M15 6 9 12l6 6" />
      ) : (
        <path d="m9 6 6 6-6 6" />
      )}
    </svg>
  );
}
