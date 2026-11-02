"use client";

import { useState } from "react";
import { TenderStarRating } from "@/components/tenders/tender-star-rating";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  deleteOwnTenderRating,
  upsertOwnTenderRating,
  type TenderScore,
} from "@/lib/queries";

/**
 * Puntuación 1–5 en la ficha (misma tabla `tender_ratings` que buzón / alertas).
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
  const [score, setScore] = useState<TenderScore | null>(initialScore);
  const [error, setError] = useState<string | null>(null);

  async function onChange(next: TenderScore | null) {
    const client = createSupabaseBrowserClient();
    const prev = score;
    setScore(next);
    setError(null);
    const result =
      next == null
        ? await deleteOwnTenderRating(client, { userId, tenderId })
        : await upsertOwnTenderRating(client, { userId, tenderId, score: next });
    if (result.error) {
      setScore(prev);
      setError(result.error.message);
    }
  }

  return (
    <div className="flex flex-col items-center text-center">
      <TenderStarRating score={score} onChange={onChange} />
      {error ? (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
