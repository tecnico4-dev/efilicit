"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { TenderStarRating } from "@/components/tenders/tender-star-rating";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  deleteOwnTenderRating,
  upsertOwnTenderRating,
  type TenderScore,
} from "@/lib/queries";

function persistScore(
  userId: string,
  tenderId: string,
  next: TenderScore | null,
) {
  const client = createSupabaseBrowserClient();
  if (next == null) {
    return deleteOwnTenderRating(client, { userId, tenderId });
  }
  return upsertOwnTenderRating(client, { userId, tenderId, score: next });
}

/**
 * Puntuación en ficha (from=notifications|alerts|email) + aviso al salir
 * si aún no hay nota.
 */
export function TenderDetailRating({
  userId,
  tenderId,
  initialScore,
}: {
  userId: string;
  tenderId: string;
  initialScore: TenderScore | null;
}) {
  const router = useRouter();
  const [score, setScore] = useState<TenderScore | null>(initialScore);
  const [error, setError] = useState<string | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const onChange = useCallback(
    async (next: TenderScore | null) => {
      const prev = score;
      setScore(next);
      setError(null);
      const result = await persistScore(userId, tenderId, next);
      if (result.error) {
        setScore(prev);
        setError(result.error.message);
      }
    },
    [score, tenderId, userId],
  );

  const proceedTo = useCallback(
    (href: string) => {
      setExitOpen(false);
      setPendingHref(null);
      if (href.startsWith("http://") || href.startsWith("https://")) {
        window.location.assign(href);
        return;
      }
      router.push(href);
    },
    [router],
  );

  // Intercepta clics a otras rutas mientras no haya valoración.
  useEffect(() => {
    if (score != null) return;

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const hrefAttr = anchor.getAttribute("href");
      if (!hrefAttr || hrefAttr.startsWith("#")) return;
      if (
        hrefAttr.startsWith("mailto:") ||
        hrefAttr.startsWith("tel:") ||
        hrefAttr.startsWith("javascript:")
      ) {
        return;
      }

      let url: URL;
      try {
        url = new URL(hrefAttr, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const path = url.pathname;
      // Misma ficha (con o sin query): no interceptar.
      if (path === `/tenders/${tenderId}` || path === `/tenders/${tenderId}/`) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      setPendingHref(`${url.pathname}${url.search}${url.hash}`);
      setExitOpen(true);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [score, tenderId]);

  async function onExitRate(next: TenderScore | null) {
    if (next == null) return;
    const prev = score;
    setScore(next);
    setError(null);
    const result = await persistScore(userId, tenderId, next);
    if (result.error) {
      setScore(prev);
      setError(result.error.message);
      return;
    }
    if (pendingHref) proceedTo(pendingHref);
  }

  function onLater() {
    if (pendingHref) proceedTo(pendingHref);
    else {
      setExitOpen(false);
      setPendingHref(null);
    }
  }

  return (
    <>
      <div className="flex w-full flex-col items-center justify-center text-center">
        <p className="mb-1.5 text-sm font-medium text-foreground">
          Tu valoración
        </p>
        <div className="flex w-full justify-center">
          <TenderStarRating score={score} onChange={onChange} />
        </div>
        {error && !exitOpen ? (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {mounted && exitOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="tender-exit-rating-title"
            >
              <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
                <h2
                  id="tender-exit-rating-title"
                  className="text-center text-lg font-semibold text-foreground"
                >
                  ¿Te ha parecido interesante esta licitación?
                </h2>
                <div className="mt-5 flex justify-center">
                  <TenderStarRating score={null} onChange={onExitRate} />
                </div>
                {error ? (
                  <p className="mt-2 text-center text-xs text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={onLater}
                    className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Valorar más tarde.
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
