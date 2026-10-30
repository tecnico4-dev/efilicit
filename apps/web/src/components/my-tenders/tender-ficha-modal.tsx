"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { normalizeCpvCode } from "@/lib/cpv";
import { formatCpvSelection } from "@/lib/cpv-dictionary";
import { formatDateMadrid, formatDateTimeMadrid } from "@/lib/datetime";
import {
  formatContractType,
  formatProcedureType,
  formatTenderStatus,
} from "@/lib/tender-labels";
import type { TenderDetail } from "@/lib/queries";

function formatMoney(value: number | null, currency: string): string {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border py-3 sm:grid sm:grid-cols-[9.5rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground sm:mt-0">{children}</dd>
    </div>
  );
}

/**
 * Abre la ficha canónica en un modal centrado (sin navegar a /tenders/[id]).
 */
export function TenderFichaModalButton({ tender }: { tender: TenderDetail }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const authority = tender.contracting_authority;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-link hover:underline"
      >
        Ver ficha pública
      </button>

      {open && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-3 sm:p-6"
              role="presentation"
              onClick={() => setOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="flex max-h-[min(92vh,44rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                  <h2
                    id={titleId}
                    className="min-w-0 flex-1 text-base font-semibold leading-snug tracking-tight text-foreground sm:text-lg"
                  >
                    {tender.title}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Cerrar"
                  >
                    <span aria-hidden className="text-xl leading-none">
                      ×
                    </span>
                  </button>
                </div>

                <div className="overflow-y-auto px-4 py-4 sm:px-5">
                  {tender.description ? (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {tender.description}
                    </p>
                  ) : null}

                  <dl className={tender.description ? "mt-4" : undefined}>
                    <Field label="Importe (sin IVA)">
                      {formatMoney(tender.estimated_value, tender.currency)}
                    </Field>
                    <Field label="CPV">
                      {tender.cpv_codes.length ? (
                        <ul className="space-y-1">
                          {tender.cpv_codes.map((raw) => {
                            const code = normalizeCpvCode(raw) ?? raw;
                            return (
                              <li key={raw} className="font-mono text-sm">
                                {formatCpvSelection(code)}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        "—"
                      )}
                    </Field>
                    <Field label="Estado">
                      {formatTenderStatus(tender.status)}
                    </Field>
                    <Field label="Tipo de contrato">
                      {formatContractType(tender.contract_type)}
                    </Field>
                    <Field label="Procedimiento">
                      {formatProcedureType(tender.procedure_type)}
                    </Field>
                    <Field label="Publicación">
                      {formatDateMadrid(tender.publication_date)}
                    </Field>
                    <Field label="Plazo">
                      {formatDateTimeMadrid(tender.deadline_at)}
                    </Field>
                    <Field label="Comunidad autónoma">
                      {tender.place_ccaa?.name ?? "—"}
                    </Field>
                    <Field label="Municipio">
                      {tender.place_municipality?.name ?? "—"}
                    </Field>
                    <Field label="Órgano de contratación">
                      {authority ? (
                        <span>
                          {authority.name}
                          {authority.tax_id ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · NIF{" "}
                              <span className="font-mono">
                                {authority.tax_id}
                              </span>
                            </span>
                          ) : null}
                          {authority.municipality ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · {authority.municipality}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        "—"
                      )}
                    </Field>
                  </dl>

                  {tender.sources.length > 0 ? (
                    <section className="mt-6">
                      <h3 className="text-sm font-semibold text-foreground">
                        Fuentes
                      </h3>
                      <ul className="mt-2 space-y-2">
                        {tender.sources.map((source) => (
                          <li
                            key={source.id}
                            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                          >
                            <span className="font-mono font-medium">
                              {source.source_code}
                            </span>
                            {source.source_url ? (
                              <p className="mt-1">
                                <a
                                  href={source.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="break-all font-medium text-link hover:underline"
                                >
                                  {source.source_url}
                                </a>
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
