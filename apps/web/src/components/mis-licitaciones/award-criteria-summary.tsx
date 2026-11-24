"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ENVELOPE_LABELS } from "@/components/mis-licitaciones/offer-case-sections";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  updateOfferRequirement,
  type OfferRequirementDetail,
} from "@/lib/queries";

type CriterionRow = {
  id: string;
  title: string;
  typeLabel: string;
  pointsLabel: string;
  pointsMax: number | null;
  envelopeLabel: string;
  estimate: string | null;
};

function criterionTypeLabel(envelope: string | null): string {
  if (envelope === "B") return "Juicio de valor";
  if (envelope === "C") return "Fórmula";
  return "—";
}

function pointsLabel(requiredValue: string | null): string {
  const raw = requiredValue?.trim() ?? "";
  if (!raw) return "—";
  // Intake suele dejar "12 puntos"; acortar a "12 pt".
  const match = raw.match(/^([\d.,]+)\s*puntos?$/i);
  if (match) return `${match[1]} pt`;
  return raw;
}

function mapCriteria(requirements: OfferRequirementDetail[]): CriterionRow[] {
  return requirements
    .filter((r) => r.category === "criterio_adjudicacion")
    .slice()
    .sort((a, b) => {
      const env = (a.envelope ?? "").localeCompare(b.envelope ?? "", "es");
      if (env !== 0) return env;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    })
    .map((r) => {
      const label = pointsLabel(r.required_value);
      return {
        id: r.id,
        title: r.title?.trim() || "Criterio",
        typeLabel: criterionTypeLabel(r.envelope),
        pointsLabel: label,
        pointsMax: parseScore(r.required_value) ?? parseScore(label),
        envelopeLabel:
          r.envelope && r.envelope in ENVELOPE_LABELS
            ? ENVELOPE_LABELS[r.envelope]!
            : r.envelope ?? "—",
        estimate: r.our_value?.trim() || null,
      };
    });
}

function parseScore(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.trim().match(/([\d]+(?:[.,]\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]!.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formatScore(n: number | null, suffix = " pt"): string {
  if (n == null) return "—";
  const text = Number.isInteger(n)
    ? String(n)
    : n.toFixed(2).replace(".", ",");
  return `${text}${suffix}`;
}

function totalsByEnvelope(rows: CriterionRow[]): string | null {
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const n = parseScore(row.pointsLabel);
    if (n == null) continue;
    const key = row.envelopeLabel;
    buckets.set(key, (buckets.get(key) ?? 0) + n);
  }
  if (buckets.size === 0) return null;
  return [...buckets.entries()]
    .map(([env, pts]) => `${env} ${formatScore(pts)}`)
    .join("\t");
}

function sumScores(
  rows: CriterionRow[],
  pick: (row: CriterionRow) => string | null,
): number | null {
  let sum = 0;
  let any = false;
  for (const row of rows) {
    const n = parseScore(pick(row));
    if (n == null) continue;
    sum += n;
    any = true;
  }
  return any ? Math.round(sum * 100) / 100 : null;
}

/** Solo dígitos y un separador decimal (, o .). */
function sanitizeEstimateInput(raw: string): string {
  let out = "";
  let seenSep = false;
  for (const ch of raw.replace(/\s/g, "")) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
      continue;
    }
    if ((ch === "," || ch === ".") && !seenSep) {
      out += ch;
      seenSep = true;
    }
  }
  return out;
}

function formatEstimateStored(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function EstimateCell({
  requirementId,
  initial,
  pointsMax,
}: {
  requirementId: string;
  initial: string | null;
  pointsMax: number | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(initial ?? "");
    setError(null);
  }, [initial]);

  async function save() {
    const nextRaw = value.trim();
    const prev = (initial ?? "").trim();
    if (nextRaw === prev) {
      setError(null);
      return;
    }

    if (nextRaw.length === 0) {
      setPending(true);
      setError(null);
      const client = createSupabaseBrowserClient();
      const { error: err } = await updateOfferRequirement(client, {
        id: requirementId,
        patch: { our_value: null },
      });
      setPending(false);
      if (err) {
        setError(err.message);
        setValue(initial ?? "");
        return;
      }
      router.refresh();
      return;
    }

    const n = parseScore(nextRaw);
    if (n == null || n < 0) {
      setError("Solo un número ≥ 0");
      setValue(initial ?? "");
      return;
    }
    if (pointsMax != null && n > pointsMax) {
      setError(`Máx. ${formatEstimateStored(pointsMax)}`);
      setValue(initial ?? "");
      return;
    }

    const stored = formatEstimateStored(n);
    if (stored === prev) {
      setValue(stored);
      setError(null);
      return;
    }

    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const { error: err } = await updateOfferRequirement(client, {
      id: requirementId,
      patch: { our_value: stored },
    });
    setPending(false);
    if (err) {
      setError(err.message);
      setValue(initial ?? "");
      return;
    }
    setValue(stored);
    router.refresh();
  }

  const maxAttr =
    pointsMax != null ? String(pointsMax).replace(".", ",") : undefined;

  return (
    <div className="min-w-[4.5rem]">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder="—"
        aria-label={
          pointsMax != null
            ? `Estimación de puntos (máximo ${formatEstimateStored(pointsMax)})`
            : "Estimación de puntos"
        }
        title={
          pointsMax != null
            ? `Entre 0 y ${formatEstimateStored(pointsMax)}`
            : undefined
        }
        max={maxAttr}
        disabled={pending}
        onChange={(e) => {
          setError(null);
          setValue(sanitizeEstimateInput(e.target.value));
        }}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            setValue(initial ?? "");
            setError(null);
            e.currentTarget.blur();
          }
        }}
        className="w-full max-w-[5.5rem] rounded-md border border-transparent bg-transparent px-1.5 py-1 text-center text-sm font-medium text-foreground outline-none placeholder:text-center placeholder:text-muted-foreground hover:border-border focus:border-border focus:bg-surface focus:ring-2 focus:ring-ring/40 disabled:opacity-60"
      />
      {error ? (
        <p className="mt-0.5 text-[10px] text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

/**
 * Vista resumida de criterios de adjudicación (intake → offer_requirements).
 * Estimación propia = `our_value` (editable).
 */
export function AwardCriteriaSummary({
  requirements,
}: {
  requirements: OfferRequirementDetail[];
}) {
  const rows = mapCriteria(requirements);
  const totals = totalsByEnvelope(rows);
  const pointsTotal = sumScores(rows, (r) => r.pointsLabel);
  const estimateTotal = sumScores(rows, (r) => r.estimate);

  return (
    <div className="rounded-xl border border-border bg-muted/25 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          Criterios de adjudicación
        </h3>
        {totals ? (
          <p className="shrink-0 whitespace-pre text-xs text-muted-foreground">
            {totals}
          </p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No hay criterios de adjudicación en este expediente.
        </p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Criterio</th>
                  <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">
                    Tipo
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">
                    Puntos
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">
                    Sobre
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-center font-semibold">
                    Estimación
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-3 py-2.5 text-left text-foreground">
                      {row.title}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center text-muted-foreground">
                      {row.typeLabel}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center font-medium text-foreground">
                      {row.pointsLabel}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center text-muted-foreground">
                      {row.envelopeLabel}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-center">
                      <div className="inline-flex justify-center">
                        <EstimateCell
                          requirementId={row.id}
                          initial={row.estimate}
                          pointsMax={row.pointsMax}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/50">
                  <td className="px-3 py-2.5 text-left text-sm font-semibold text-foreground">
                    Total
                  </td>
                  <td className="px-3 py-2.5" />
                  <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm font-semibold text-foreground">
                    {formatScore(pointsTotal)}
                  </td>
                  <td className="px-3 py-2.5" />
                  <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm font-semibold text-foreground">
                    {formatScore(estimateTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Detalle y preparación en la pestaña Requisitos.
          </p>
        </>
      )}
    </div>
  );
}
