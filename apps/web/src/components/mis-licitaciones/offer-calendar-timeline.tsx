import { cn } from "@/lib/cn";
import { calendarDayMadrid, DISPLAY_TIME_ZONE } from "@/lib/datetime";

export type OfferCalendarEvent = {
  id: string;
  title: string;
  /** ISO date or datetime. */
  dueAt: string;
  kind: "oficial" | "interno";
  detail?: string | null;
};

type TimelineRow =
  | { type: "event"; event: OfferCalendarEvent; day: string; past: boolean }
  | { type: "today"; day: string };

function shortDateMadrid(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: DISPLAY_TIME_ZONE,
    day: "2-digit",
    month: "short",
  })
    .format(d)
    .replace(/\.$/, "")
    .toLowerCase();
}

/** Formatea un YYYY-MM-DD civil (sin TZ) como «04 nov». */
function shortCivilDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return "—";
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
  })
    .format(dt)
    .replace(/\.$/, "")
    .toLowerCase();
}

/** Días hábiles (lun–vie) desde `fromDay` exclusivo hasta `toDay` inclusivo. */
function businessDaysAhead(fromDay: string, toDay: string): number {
  if (toDay <= fromDay) return 0;
  let count = 0;
  const [y, m, d] = fromDay.split("-").map(Number);
  let cursor = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
  const [ty, tm, td] = toDay.split("-").map(Number);
  const end = Date.UTC(ty!, tm! - 1, td!, 12, 0, 0);
  for (;;) {
    cursor = new Date(cursor.getTime() + 86_400_000);
    if (cursor.getTime() > end) break;
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return count;
}

function statusLabel(past: boolean, day: string, today: string): string {
  if (past || day < today) return "hecho";
  if (day === today) return "hoy";
  const days = businessDaysAhead(today, day);
  if (days <= 0) return "hoy";
  if (days === 1) return "en 1 día hábil";
  return `en ${days} días hábiles`;
}

function buildRows(
  events: OfferCalendarEvent[],
  now: Date,
): TimelineRow[] {
  const today = calendarDayMadrid(now);
  if (!today) return [];

  const dated = events
    .map((event) => {
      const day = calendarDayMadrid(event.dueAt);
      if (!day) return null;
      return { event, day, past: day < today };
    })
    .filter((x): x is { event: OfferCalendarEvent; day: string; past: boolean } =>
      x != null,
    )
    .sort((a, b) => {
      if (a.day !== b.day) return a.day < b.day ? -1 : 1;
      return a.event.title.localeCompare(b.event.title, "es");
    });

  const rows: TimelineRow[] = [];
  let insertedToday = false;
  for (const item of dated) {
    if (!insertedToday && item.day >= today) {
      rows.push({ type: "today", day: today });
      insertedToday = true;
    }
    rows.push({ type: "event", ...item });
  }
  if (!insertedToday) {
    rows.push({ type: "today", day: today });
  }
  return rows;
}

/**
 * Timeline de plazos del expediente (estilo mock: fecha · punto · título · countdown).
 */
export function OfferCalendarTimeline({
  events,
  now = new Date(),
}: {
  events: OfferCalendarEvent[];
  now?: Date;
}) {
  const today = calendarDayMadrid(now) ?? "";
  const rows = buildRows(events, now);

  return (
    <div className="rounded-xl border border-border bg-muted/25 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            Calendario y plazos
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Días hábiles sin fines de semana (festivos nacionales, más adelante).
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full bg-primary"
              aria-hidden
            />
            Oficial
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full border-2 border-muted-foreground/70 bg-transparent"
              aria-hidden
            />
            Interno
          </span>
        </div>
      </div>

      <ul className="mt-4">
        {rows.map((row) => {
          if (row.type === "today") {
            return (
              <li key="today" className="py-3" aria-label="Hoy">
                <div className="flex items-center gap-3">
                  <div className="h-1 min-w-0 flex-1 rounded-full bg-primary" aria-hidden />
                  <p className="shrink-0 text-center text-[11px] font-semibold tracking-wide text-primary">
                    HOY {shortCivilDay(row.day)}
                  </p>
                  <div className="h-1 min-w-0 flex-1 rounded-full bg-primary" aria-hidden />
                </div>
              </li>
            );
          }

          const { event, day, past } = row;
          const faded = past;
          const status = statusLabel(past, day, today);

          return (
            <li
              key={event.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-border py-3 first:border-t-0"
            >
              <p
                className={cn(
                  "w-[4.75rem] shrink-0 text-sm tabular-nums sm:w-[5.5rem]",
                  faded
                    ? "text-muted-foreground"
                    : "font-medium text-foreground",
                )}
              >
                {shortDateMadrid(event.dueAt)}
              </p>
              <span
                className={cn(
                  "mt-1 size-2.5 shrink-0 rounded-full",
                  event.kind === "oficial"
                    ? faded
                      ? "bg-primary/40"
                      : "bg-primary"
                    : faded
                      ? "border-2 border-muted-foreground/40 bg-transparent"
                      : "border-2 border-muted-foreground/70 bg-transparent",
                )}
                title={event.kind === "oficial" ? "Oficial" : "Interno"}
                aria-label={event.kind === "oficial" ? "Oficial" : "Interno"}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm",
                    faded
                      ? "text-muted-foreground"
                      : "font-medium text-foreground",
                  )}
                >
                  {event.title}
                </p>
                {event.detail?.trim() ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {event.detail.trim()}
                  </p>
                ) : null}
              </div>
              <p
                className={cn(
                  "w-full text-right text-xs sm:w-auto sm:shrink-0",
                  faded ? "text-muted-foreground" : "text-muted-foreground",
                )}
              >
                {status}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
