"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

const CHUNK = 5;

/**
 * Sección de resumen con lista plegable:
 * Mostrar más (otro cacho) · Ver todas · Mostrar menos.
 */
export function ExpandableSummarySection({
  title,
  href,
  hrefLabel,
  emptyMessage,
  emptyHref,
  emptyCta,
  items,
  chunkSize = CHUNK,
}: {
  title: string;
  href: string;
  hrefLabel: string;
  emptyMessage: string;
  emptyHref: string;
  emptyCta: string;
  items: ReactNode[];
  chunkSize?: number;
}) {
  const [visible, setVisible] = useState(chunkSize);
  const total = items.length;
  const shown = Math.min(visible, total);
  const fullyExpanded = total > 0 && shown >= total;
  const hasMoreChunks = total > chunkSize;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <Link
          href={href}
          className="text-sm font-medium text-link hover:underline"
        >
          {hrefLabel}
        </Link>
      </div>

      {total === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {emptyMessage}{" "}
          <Link
            href={emptyHref}
            className="font-medium text-link hover:underline"
          >
            {emptyCta}
          </Link>
        </p>
      ) : (
        <div className="mt-3">
          <ul className="divide-y divide-border border-t border-border">
            {items.slice(0, shown).map((item, i) => (
              <li key={i} className="py-3">
                {item}
              </li>
            ))}
          </ul>

          {hasMoreChunks ? (
            <p className="py-3 text-center text-sm">
              {fullyExpanded ? (
                <button
                  type="button"
                  className="font-medium text-primary hover:text-primary-dark hover:underline"
                  onClick={() => setVisible(chunkSize)}
                >
                  Mostrar menos
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="font-medium text-primary hover:text-primary-dark hover:underline"
                    onClick={() =>
                      setVisible((v) => Math.min(v + chunkSize, total))
                    }
                  >
                    Mostrar más
                  </button>
                  <span className="text-muted-foreground"> · </span>
                  <button
                    type="button"
                    className="font-medium text-primary hover:text-primary-dark hover:underline"
                    onClick={() => setVisible(total)}
                  >
                    Ver todas
                  </button>
                </>
              )}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
