"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDateMadrid } from "@/lib/datetime";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  OFFER_LOG_EVENT_LABELS,
  OFFER_LOG_MANUAL_EVENT_TYPES,
  insertOfferCaseLog,
  listOfferCaseLog,
  type OfferCaseLogEntry,
  type OfferLogEventType,
} from "@/lib/queries";

function shortName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Alguien";
  if (parts.length === 1) return parts[0]!;
  const last = parts[parts.length - 1]!;
  return `${parts[0]} ${last[0]!.toUpperCase()}.`;
}

function madridTodayIso(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Madrid",
  });
}

function EventBadge({ type }: { type: OfferLogEventType }) {
  const tone =
    type === "go_decision"
      ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-800 dark:text-emerald-200"
      : type === "alta_expediente"
        ? "border-sky-500/35 bg-sky-500/10 text-sky-900 dark:text-sky-100"
        : type === "stage_change"
          ? "border-primary/30 bg-primary/10 text-primary"
          : type === "requerimiento" || type === "subsanacion"
            ? "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-100"
            : "border-border bg-muted/50 text-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide",
        tone,
      )}
    >
      {OFFER_LOG_EVENT_LABELS[type]}
    </span>
  );
}

export function OfferCaseLogPanel({
  offerCaseId,
  userId,
}: {
  offerCaseId: string;
  userId: string;
}) {
  const [entries, setEntries] = useState<OfferCaseLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [eventType, setEventType] =
    useState<(typeof OFFER_LOG_MANUAL_EVENT_TYPES)[number]>("comentario");
  const [body, setBody] = useState("");
  const [happenedOn, setHappenedOn] = useState(madridTodayIso);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const result = await listOfferCaseLog(client, offerCaseId);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      setEntries([]);
      return;
    }
    setEntries(result.data);
  }, [offerCaseId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function openComposer() {
    setEventType("comentario");
    setBody("");
    setHappenedOn(madridTodayIso());
    setError(null);
    setComposing(true);
  }

  function closeComposer() {
    if (saving) return;
    setComposing(false);
  }

  async function onSave() {
    if (!body.trim()) {
      setError("Escribe el texto de la entrada.");
      return;
    }
    setSaving(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const result = await insertOfferCaseLog(client, {
      offerCaseId,
      eventType,
      body,
      createdBy: userId,
      happenedOn,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setComposing(false);
    await reload();
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground">
          Historial del expediente: cambios de etapa, decisiones y notas del
          equipo.
        </p>
        {!composing ? (
          <Button type="button" size="sm" onClick={openComposer}>
            Añadir entrada
          </Button>
        ) : null}
      </div>

      {composing ? (
        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">
                Tipo
              </span>
              <select
                value={eventType}
                disabled={saving}
                onChange={(e) =>
                  setEventType(
                    e.target.value as (typeof OFFER_LOG_MANUAL_EVENT_TYPES)[number],
                  )
                }
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {OFFER_LOG_MANUAL_EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {OFFER_LOG_EVENT_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">
                Fecha
              </span>
              <input
                type="date"
                value={happenedOn}
                disabled={saving}
                onChange={(e) => setHappenedOn(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Texto
            </span>
            <textarea
              value={body}
              disabled={saving}
              rows={3}
              placeholder="Qué ha pasado…"
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={closeComposer}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => void onSave()}
            >
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground">Cargando bitácora…</p>
      ) : entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-muted-foreground">
          Sin entradas aún. Los cambios de etapa y la decisión GO / NO-GO se
          registran solos; también puedes añadir notas manuales.
        </p>
      ) : (
        <div className="min-w-[28rem] overflow-x-auto pt-1">
          {/*
            Timeline en chevrones verticales (punta arriba = más reciente),
            como el SmartArt horizontal pero girado; color primary de la UI.
          */}
          <ul className="relative list-none p-0">
            {entries.map((entry, index) => {
              const meta = entry.created_by_name
                ? `Por ${shortName(entry.created_by_name)}`
                : "Detectado automáticamente";
              const isLast = index === entries.length - 1;
              return (
                <li
                  key={entry.id}
                  className={cn(
                    "relative flex items-stretch gap-3 sm:gap-4",
                    index > 0 && "-mt-3",
                  )}
                  style={{ zIndex: entries.length - index }}
                >
                  <div
                    className={cn(
                      "flex w-[7.25rem] shrink-0 items-center justify-center px-2 text-center text-[0.8rem] font-semibold tabular-nums text-primary-foreground",
                      index === 0
                        ? "bg-primary"
                        : index % 2 === 1
                          ? "bg-primary-dark"
                          : "bg-primary",
                    )}
                    style={{
                      // Flecha ↑: punta arriba; abajo muesca hacia dentro (piquito hacia arriba)
                      clipPath:
                        "polygon(50% 0%, 100% 14px, 100% 100%, 50% calc(100% - 14px), 0% 100%, 0% 14px)",
                      paddingTop: "1.35rem",
                      paddingBottom: "1.35rem",
                      minHeight: "4.25rem",
                    }}
                  >
                    {formatDateMadrid(entry.happened_on)}
                  </div>

                  <div
                    className={cn(
                      "grid min-w-0 flex-1 grid-cols-[10.5rem_minmax(0,1fr)] items-center gap-x-4 py-3 pl-1",
                      !isLast && "border-b border-border",
                    )}
                  >
                    <div className="flex justify-start">
                      <EventBadge type={entry.event_type} />
                    </div>
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap text-foreground">
                        {entry.body}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {meta}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
