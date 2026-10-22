import Link from "next/link";
import { notFound } from "next/navigation";
import { FavoriteToggle } from "@/components/favorites/favorite-toggle";
import { PAGE_MAIN_CLASS } from "@/components/shell/page-width";
import { ErrorState } from "@/components/ui/state-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOwnProfile,
  getTenderById,
  isOwnFavorite,
  type TenderSourceSummary,
} from "@/lib/queries";
import { formatCpvSelection, normalizeCpvCode } from "@/lib/cpv";
import {
  formatContractType,
  formatProcedureType,
  formatTenderStatus,
} from "@/lib/tender-labels";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function allParam(value: string | string[] | undefined): string[] {
  if (value == null) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw.map((v) => v.trim()).filter(Boolean);
}

function backLinkFromParams(
  params: Record<string, string | string[] | undefined>,
): { href: string; label: string } {
  const from = first(params.from);
  if (from === "home") {
    return {
      href: "/",
      label: "← Volver al Inicio",
    };
  }
  if (from === "favorites-tenders") {
    return {
      href: "/favorites/tenders",
      label: "← Volver a la lista de licitaciones favoritas",
    };
  }
  if (from === "favorites") {
    return {
      href: "/favorites",
      label: "← Volver a la lista de favoritos",
    };
  }

  if (from === "search") {
    const qs = new URLSearchParams();
    const q = first(params.q).trim();
    const cpvCodes = allParam(params.cpv);
    const cpvMatch = first(params.cpv_match).trim().toLowerCase();
    const min = first(params.min).trim();
    const max = first(params.max).trim();
    const ccaa = first(params.ccaa).trim();
    const municipality = first(params.municipality).trim();
    const status = first(params.status).trim();
    const procedure = first(params.procedure).trim();
    const contractType = first(params.contract_type).trim();
    const pubFrom = first(params.pub_from).trim();
    const pubTo = first(params.pub_to).trim();
    const enPlazo = first(params.en_plazo).trim() === "1";
    if (q) qs.set("q", q);
    for (const code of cpvCodes) qs.append("cpv", code);
    if (cpvCodes.length >= 2 && cpvMatch === "all") {
      qs.set("cpv_match", "all");
    }
    if (min) qs.set("min", min);
    if (max) qs.set("max", max);
    if (ccaa) qs.set("ccaa", ccaa);
    if (municipality) qs.set("municipality", municipality);
    if (status) qs.set("status", status);
    if (procedure) qs.set("procedure", procedure);
    if (contractType) qs.set("contract_type", contractType);
    if (pubFrom) qs.set("pub_from", pubFrom);
    if (pubTo) qs.set("pub_to", pubTo);
    if (enPlazo) qs.set("en_plazo", "1");
    const query = qs.toString();
    return {
      href: query ? `/search?${query}` : "/search",
      label: "← Volver a la búsqueda",
    };
  }

  return { href: "/search", label: "← Volver a la búsqueda" };
}

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

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border py-3 sm:grid sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground sm:mt-0">{children}</dd>
    </div>
  );
}

function SourcesList({
  sources,
  canonicalSourceCode,
}: {
  sources: TenderSourceSummary[];
  canonicalSourceCode: string;
}) {
  if (sources.length === 0) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        No hay fuentes enlazadas para esta licitación.
      </p>
    );
  }

  return (
    <ul className="mt-3 space-y-3">
      {sources.map((source) => {
        const isCanonical = source.source_code === canonicalSourceCode;
        return (
          <li
            key={source.id}
            className="rounded-md border border-border bg-surface px-4 py-3 text-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-medium text-foreground">
                {source.source_code}
              </span>
              {isCanonical ? (
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-link">
                  Canónica
                </span>
              ) : null}
            </div>
            <dl className="mt-2 space-y-1 text-muted-foreground">
              <div>
                <dt className="inline">Id en fuente · </dt>
                <dd className="inline font-mono text-foreground">
                  {source.source_tender_id}
                </dd>
              </div>
              <div>
                <dt className="inline">Visto · </dt>
                <dd className="inline text-foreground">
                  {formatDate(source.last_seen_at)}
                </dd>
              </div>
              {source.match_method ? (
                <div>
                  <dt className="inline">Emparejado · </dt>
                  <dd className="inline text-foreground">
                    {source.match_method}
                    {source.review_status
                      ? ` · ${source.review_status}`
                      : null}
                  </dd>
                </div>
              ) : null}
              {source.source_url ? (
                <div>
                  <dt className="inline">URL · </dt>
                  <dd className="inline">
                    <a
                      href={source.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-link hover:underline break-all"
                    >
                      {source.source_url}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

export default async function TenderDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const back = backLinkFromParams(query);
  const supabase = await createSupabaseServerClient();
  const { data: tender, error } = await getTenderById(supabase, id);

  if (error) {
    return (
      <main className={PAGE_MAIN_CLASS}>
        <ErrorState>
          No se pudo cargar la licitación: {error.message}
        </ErrorState>
        <p className="mt-4 text-sm">
          <Link href={back.href} className="font-medium text-link hover:underline">
            {back.label.replace(/^←\s*/, "")}
          </Link>
        </p>
      </main>
    );
  }

  if (!tender) {
    notFound();
  }

  const authority = tender.contracting_authority;

  // Favoritos solo con sesión (mismo criterio que Alertas en la nav).
  let favoriteUserId: string | null = null;
  let initiallyFavorited = false;
  try {
    const profile = await getOwnProfile(supabase);
    if (profile.data) {
      favoriteUserId = profile.data.id;
      const fav = await isOwnFavorite(supabase, {
        userId: profile.data.id,
        tenderId: tender.id,
      });
      initiallyFavorited = fav.data;
    }
  } catch {
    favoriteUserId = null;
  }

  return (
    <main className={PAGE_MAIN_CLASS}>
      <p className="text-sm">
        <Link href={back.href} className="font-medium text-link hover:underline">
          {back.label}
        </Link>
      </p>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight text-foreground">
          {tender.title}
        </h1>
        {favoriteUserId ? (
          <FavoriteToggle
            userId={favoriteUserId}
            tenderId={tender.id}
            initiallyFavorited={initiallyFavorited}
          />
        ) : null}
      </div>

      {tender.description ? (
        <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
          {tender.description}
        </p>
      ) : null}

      <dl className="mt-8">
        <Field label="Importe">
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
        <Field label="Estado">{formatTenderStatus(tender.status)}</Field>
        <Field label="Tipo de contrato">{formatContractType(tender.contract_type)}</Field>
        <Field label="Procedimiento">{formatProcedureType(tender.procedure_type)}</Field>
        <Field label="Publicación">{formatDate(tender.publication_date)}</Field>
        <Field label="Plazo">{formatDate(tender.deadline_at)}</Field>
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
                  · NIF <span className="font-mono">{authority.tax_id}</span>
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

      <section className="mt-10">
        <h2 className="text-base font-semibold text-foreground">
          {tender.sources.length === 1
            ? "Fuente"
            : `Fuentes (${tender.sources.length})`}
        </h2>
        <SourcesList
          sources={tender.sources}
          canonicalSourceCode={tender.canonical_source_code}
        />
      </section>
    </main>
  );
}
