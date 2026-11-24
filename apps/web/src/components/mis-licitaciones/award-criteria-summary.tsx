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
    .map((r) => ({
      id: r.id,
      title: r.title?.trim() || "Criterio",
      typeLabel: criterionTypeLabel(r.envelope),
      pointsLabel: pointsLabel(r.required_value),
      envelopeLabel:
        r.envelope && r.envelope in ENVELOPE_LABELS
          ? ENVELOPE_LABELS[r.envelope]!
          : r.envelope ?? "—",
      estimate: r.our_value?.trim() || null,
    }));
}

function totalsByEnvelope(rows: CriterionRow[]): string | null {
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const n = Number(
      row.pointsLabel.replace(/\s*pt$/i, "").replace(",", "."),
    );
    if (!Number.isFinite(n)) continue;
    const key = row.envelopeLabel;
    buckets.set(key, (buckets.get(key) ?? 0) + n);
  }
  if (buckets.size === 0) return null;
  return [...buckets.entries()]
    .map(([env, pts]) => {
      const text = Number.isInteger(pts)
        ? String(pts)
        : pts.toFixed(2).replace(".", ",");
      return `${env} ${text} pt`;
    })
    .join(" · ");
}

function EstimateCell({
  requirementId,
  initial,
}: {
  requirementId: string;
  initial: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(initial ?? "");
  }, [initial]);

  async function save() {
    const next = value.trim();
    const prev = (initial ?? "").trim();
    if (next === prev) return;
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const { error: err } = await updateOfferRequirement(client, {
      id: requirementId,
      patch: { our_value: next.length > 0 ? next : null },
    });
    setPending(false);
    if (err) {
      setError(err.message);
      setValue(initial ?? "");
      return;
    }
    router.refresh();
  }

  return (
    <div className="min-w-[4.5rem]">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder="—"
        aria-label="Estimación de puntos"
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            setValue(initial ?? "");
            e.currentTarget.blur();
          }
        }}
        className="w-full max-w-[5.5rem] rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground hover:border-border focus:border-border focus:bg-surface focus:ring-2 focus:ring-ring/40 disabled:opacity-60"
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

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Criterios de adjudicación
        </h3>
        {totals ? (
          <p className="text-xs text-muted-foreground">{totals}</p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          Sin criterios extraídos del pliego. Si el intake ya corrió, puede que
          el CODICE no trajera{" "}
          <span className="font-medium text-foreground">AwardingCriteria</span>.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Criterio</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">
                  Tipo
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">
                  Puntos
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">
                  Sobre
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">
                  Estimación
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-3 py-2.5 text-foreground">{row.title}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                    {row.typeLabel}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    {row.pointsLabel}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                    {row.envelopeLabel}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <EstimateCell
                      requirementId={row.id}
                      initial={row.estimate}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        Estimación = puntos que creéis obtener (editable). Detalle en Requisitos.
      </p>
    </div>
  );
}
