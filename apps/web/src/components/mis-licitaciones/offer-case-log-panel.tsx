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
        <div className="overflow-x-auto pt-1">
          {/*
            Tabla fecha | tipo | texto.
            La columna de fechas va envuelta en un trazo primary con piquito arriba
            (flecha hacia lo más reciente), sin cabeceras ni líneas verticales.
          */}
          <div className="relative min-w-[30rem]">
            <svg
              className="pointer-events-none absolute left-0 top-0 z-0 h-full w-[7.75rem] text-primary"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              {/* Cuerpo + piquito superior (flecha hacia arriba) */}
              <path
                d="M 50 1.5 L 92 14 L 78 14 L 78 98.5 L 22 98.5 L 22 14 L 8 14 Z"
                fill="currentColor"
                fillOpacity="0.06"
                stroke="currentColor"
                strokeWidth="1.4"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            <table className="relative z-[1] w-full border-collapse text-sm">
              <tbody>
                {entries.map((entry, index) => {
                  const meta = entry.created_by_name
                    ? `Por ${shortName(entry.created_by_name)}`
                    : "Detectado automáticamente";
                  return (
                    <tr key={entry.id} className="border-b border-border">
                      <td
                        className={cn(
                          "w-[7.75rem] whitespace-nowrap px-2 pb-3 text-center align-top text-foreground tabular-nums",
                          index === 0 ? "pt-6" : "pt-3",
                        )}
                      >
                        {formatDateMadrid(entry.happened_on)}
                      </td>
                      <td className="w-[10.5rem] py-3 pl-3 pr-3 align-top">
                        <EventBadge type={entry.event_type} />
                      </td>
                      <td className="py-3 align-top">
                        <p className="whitespace-pre-wrap text-foreground">
                          {entry.body}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {meta}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
