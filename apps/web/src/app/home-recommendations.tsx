"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FavoriteKindBubble } from "@/components/favorites/favorite-kind-bubble";
import { useUndoToast } from "@/components/undo-toast";
import { formatDateTimeMadrid } from "@/lib/datetime";
import {
  upsertOwnTenderRating,
  type RecommendationItem,
  type RecommendationProfileKind,
} from "@/lib/queries";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatMoney } from "./favorites/favorites-shared";

function emptyCopy(kind: RecommendationProfileKind): string {
  if (kind === "propia") {
    return "Valora con 4–5 estrellas o guarda en favoritos licitaciones de Eficen (y deja que el job calcule) para ver recomendaciones.";
  }
  return "Valora o guarda favoritos de Subcontrata para ver recomendaciones de ese perfil.";
}

function ProfileColumn({
  kind,
  label,
  items,
  userId,
  showEmptyHint,
}: {
  kind: RecommendationProfileKind;
  label: string;
  items: RecommendationItem[];
  userId: string;
  showEmptyHint: boolean;
}) {
  const router = useRouter();
  const { showStatus } = useUndoToast();
  const [hidden, setHidden] = useState<string[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const visible = items.filter((i) => !hidden.includes(i.tenderId));

  async function onNotInterested(item: RecommendationItem) {
    if (pendingId) return;
    setPendingId(item.tenderId);
    setHidden((h) => [...h, item.tenderId]);
    const client = createSupabaseBrowserClient();
    const { error } = await upsertOwnTenderRating(client, {
      userId,
      tenderId: item.tenderId,
      score: 1,
      interestKind: kind,
    });
    setPendingId(null);
    if (error) {
      setHidden((h) => h.filter((id) => id !== item.tenderId));
      showStatus(`No se pudo guardar: ${error.message}`);
      return;
    }
    router.refresh();
  }

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-base font-semibold text-foreground">{label}</h3>
        <FavoriteKindBubble kind={kind} />
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {showEmptyHint ? emptyCopy(kind) : "Ninguna por encima del umbral ahora."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => (
            <li
              key={item.tenderId}
              className="rounded-lg border border-border bg-surface/60 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/tenders/${item.tenderId}?from=recommendations&interest=${kind}`}
                  className="min-w-0 text-sm font-medium text-foreground hover:text-primary"
                >
                  {item.title}
                </Link>
                <button
                  type="button"
                  disabled={pendingId === item.tenderId}
                  onClick={() => void onNotInterested(item)}
                  className="shrink-0 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  No me interesa
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.reasonLabel}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.deadlineAt
                  ? `Plazo ${formatDateTimeMadrid(item.deadlineAt)}`
                  : "Sin plazo"}
                {" · "}
                {formatMoney(item.estimatedValue, item.currency)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function HomeRecommendations({
  userId,
  propia,
  subcontrata,
  computedAt,
  compact = false,
  /** Si false, el título lo pone el carrusel del home. */
  showHeading = true,
}: {
  userId: string;
  propia: RecommendationItem[];
  subcontrata: RecommendationItem[];
  computedAt: string | null;
  /** Home: mensajes de vacío más cortos si nunca hubo cálculo. */
  compact?: boolean;
  showHeading?: boolean;
}) {
  const hasAny = propia.length > 0 || subcontrata.length > 0;
  const showEmptyHint = !computedAt;

  return (
    <div>
      {showHeading ? (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Recomendadas para ti
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Según tus valoraciones y favoritos, con un empujón del perfil
              Eficen. Solo aparecen si encajan de verdad.
            </p>
          </div>
          {compact ? (
            <Link
              href="/recommendations"
              className="text-sm font-medium text-primary hover:underline"
            >
              Ver todas
            </Link>
          ) : null}
        </div>
      ) : compact ? (
        <div className="mb-1 flex justify-end">
          <Link
            href="/recommendations"
            className="text-sm font-medium text-primary hover:underline"
          >
            Ver todas
          </Link>
        </div>
      ) : null}

      <div
        className={
          showHeading ? "mt-4 grid gap-6 md:grid-cols-2" : "grid gap-6 md:grid-cols-2"
        }
      >
        <ProfileColumn
          kind="propia"
          label="Para Eficen"
          items={propia}
          userId={userId}
          showEmptyHint={showEmptyHint}
        />
        <ProfileColumn
          kind="subcontrata"
          label="Para Subcontrata"
          items={subcontrata}
          userId={userId}
          showEmptyHint={showEmptyHint}
        />
      </div>

      {computedAt ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Actualizado el {formatDateTimeMadrid(computedAt)}
          {!hasAny ? " · ninguna superó el umbral" : null}
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Aún no hay cálculo. En local:{" "}
          <code className="rounded bg-muted px-1">
            run-recommendations --write
          </code>
        </p>
      )}
    </div>
  );
}
