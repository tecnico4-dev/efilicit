import Link from "next/link";
import { notFound } from "next/navigation";
import { FavoriteToggle } from "@/components/favorites/favorite-toggle";
import { BidCaseToggle } from "@/components/my-tenders/bid-case-toggle";
import { PAGE_MAIN_CLASS } from "@/components/shell/page-width";
import { ErrorState } from "@/components/ui/state-message";
import { getSessionProfile, getSupabaseServerClient } from "@/lib/auth/session";
import {
  getOfferCaseIdByTenderId,
  getTenderById,
  isOwnFavorite,
  listOwnTenderRatings,
  listTenderStatusHistory,
  type TenderScore,
  type TenderSourceSummary,
} from "@/lib/queries";
import { normalizeCpvCode } from "@/lib/cpv";
import { formatCpvSelection } from "@/lib/cpv-dictionary";
import { formatDateMadrid, formatDateTimeMadrid } from "@/lib/datetime";
import {
  formatContractType,
  formatProcedureType,
  formatSourceCode,
  formatTenderStatus,
} from "@/lib/tender-labels";
import { StatusHistoryPopover } from "./status-history-popover";
import { TenderDetailRating } from "./tender-detail-rating";

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

/** Orígenes donde se muestra valoración 1–5 (y sin «volver a búsqueda»). */
function showRatingFromParams(
  params: Record<string, string | string[] | undefined>,
): boolean {
  const from = first(params.from);
  return from === "notifications" || from === "alerts" || from === "email";
}

function backLinkFromParams(
  params: Record<string, string | string[] | undefined>,
): { href: string; label: string } | null {
  const from = first(params.from);
  // Buzón / alertas / correo digest: sin enlace «volver».
  if (from === "notifications" || from === "alerts" || from === "email") {
    return null;
  }
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
  if (from === "my-tenders") {
    return {
      href: "/my-tenders",
      label: "← Volver a eliminar",
    };
  }
  if (from === "mis-licitaciones") {
    return {
      href: "/mis-licitaciones",
      label: "← Volver a Mis licitaciones",
    };
  }

  if (from === "search") {
    const qs = new URLSearchParams();
    const q = first(params.q).trim();
    const cpvCodes = allParam(params.cpv);
    const cpvMatch = first(params.cpv_match).trim().toLowerCase();
    const min = first(params.min).trim();
    const max = first(params.max).trim();
    const ccaaCodes = allParam(params.ccaa);
    const municipality = first(params.municipality).trim();
    const statuses = allParam(params.status);
    const procedures = allParam(params.procedure);
    const contractTypes = allParam(params.contract_type);
    const pubFrom = first(params.pub_from).trim();
    const pubTo = first(params.pub_to).trim();
    const enPlazoRaw = first(params.en_plazo).trim();
    if (q) qs.set("q", q);
    for (const code of cpvCodes) qs.append("cpv", code);
    if (cpvCodes.length >= 2 && cpvMatch === "all") {
      qs.set("cpv_match", "all");
    }
    if (min) qs.set("min", min);
    if (max) qs.set("max", max);
    for (const c of ccaaCodes) qs.append("ccaa", c);
    if (municipality) qs.set("municipality", municipality);
    for (const s of statuses) qs.append("status", s);
    for (const p of procedures) qs.append("procedure", p);
    for (const c of contractTypes) qs.append("contract_type", c);
    if (pubFrom) qs.set("pub_from", pubFrom);
    if (pubTo) qs.set("pub_to", pubTo);
    if (enPlazoRaw === "0" || enPlazoRaw === "1") {
      qs.set("en_plazo", enPlazoRaw);
    }
    const pageRaw = Number.parseInt(first(params.page).trim(), 10);
    if (Number.isInteger(pageRaw) && pageRaw > 1) {
      qs.set("page", String(pageRaw));
    }
    const psRaw = first(params.ps).trim();
    if (psRaw === "20" || psRaw === "50" || psRaw === "100") {
      qs.set("ps", psRaw);
    }
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

/** Cambio real en canónico vs solo alta; si no hay update, fecha de enlace a la fuente. */
function sourceFreshnessLabel(
  sourceCreatedAt: string,
  tenderCreatedAt: string,
  tenderUpdatedAt: string,
): { label: "Creada" | "Actualizada"; at: string } {
  const createdMs = Date.parse(tenderCreatedAt);
  const updatedMs = Date.parse(tenderUpdatedAt);
  if (
    Number.isFinite(createdMs) &&
    Number.isFinite(updatedMs) &&
    updatedMs > createdMs + 1000
  ) {
    return { label: "Actualizada", at: tenderUpdatedAt };
  }
  return { label: "Creada", at: sourceCreatedAt || tenderCreatedAt };
}

function SourcesList({
  sources,
  canonicalSourceCode,
  tenderCreatedAt,
  tenderUpdatedAt,
}: {
  sources: TenderSourceSummary[];
  canonicalSourceCode: string;
  tenderCreatedAt: string;
  tenderUpdatedAt: string;
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
        const freshness = sourceFreshnessLabel(
          source.created_at,
          tenderCreatedAt,
          tenderUpdatedAt,
        );
        return (
          <li
            key={source.id}
            className="rounded-md border border-border bg-surface px-4 py-3 text-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">
                {formatSourceCode(source.source_code)}
              </span>
              {isCanonical ? (
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-link">
                  Canónica
                </span>
              ) : null}
            </div>
            <dl className="mt-2 space-y-1 text-muted-foreground">
              <div>
                <dt className="inline">{freshness.label}: </dt>
                <dd className="inline text-foreground">
                  {formatDateMadrid(freshness.at)}
                </dd>
              </div>
              {source.source_url ? (
                <div>
                  <dt className="inline">URL: </dt>
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
  const showRating = showRatingFromParams(query);
  const supabase = await getSupabaseServerClient();
  const { data: tender, error } = await getTenderById(supabase, id);

  if (error) {
    return (
      <main className={PAGE_MAIN_CLASS}>
        <ErrorState>
          No se pudo cargar la licitación: {error.message}
        </ErrorState>
        {back ? (
          <p className="mt-4 text-sm">
            <Link
              href={back.href}
              className="font-medium text-link hover:underline"
            >
              {back.label.replace(/^←\s*/, "")}
            </Link>
          </p>
        ) : null}
      </main>
    );
  }

  if (!tender) {
    notFound();
  }

  const authority = tender.contracting_authority;

  let statusHistory: Awaited<
    ReturnType<typeof listTenderStatusHistory>
  >["data"] = [];
  if (tender.status) {
    const history = await listTenderStatusHistory(supabase, tender.id);
    if (!history.error) statusHistory = history.data;
  }

  // Favoritos / Mis licitaciones solo con sesión; valoración solo en from rating.
  let favoriteUserId: string | null = null;
  let displayName: string | null = null;
  let initiallyFavorited = false;
  let existingBidCaseId: string | null = null;
  let initialScore: TenderScore | null = null;
  try {
    const profile = await getSessionProfile();
    if (profile.data) {
      favoriteUserId = profile.data.id;
      displayName = profile.data.display_name;
      const tasks: [
        ReturnType<typeof isOwnFavorite>,
        ReturnType<typeof getOfferCaseIdByTenderId>,
        ReturnType<typeof listOwnTenderRatings> | Promise<null>,
      ] = [
        isOwnFavorite(supabase, {
          userId: profile.data.id,
          tenderId: tender.id,
        }),
        getOfferCaseIdByTenderId(supabase, tender.id),
        showRating
          ? listOwnTenderRatings(supabase, {
              userId: profile.data.id,
              tenderIds: [tender.id],
            })
          : Promise.resolve(null),
      ];
      const [fav, bid, ratings] = await Promise.all(tasks);
      initiallyFavorited = fav.data;
      existingBidCaseId = bid.data;
      if (ratings && !ratings.error) {
        initialScore = ratings.data[tender.id] ?? null;
      }
    }
  } catch {
    favoriteUserId = null;
  }

  return (
    <main className={PAGE_MAIN_CLASS}>
      {back ? (
        <p className="text-sm">
          <Link
            href={back.href}
            className="font-medium text-link hover:underline"
          >
            {back.label}
          </Link>
        </p>
      ) : null}

      {showRating && favoriteUserId ? (
        <div className={`w-full ${back ? "mt-4" : ""}`}>
          <TenderDetailRating
            userId={favoriteUserId}
            tenderId={tender.id}
            initialScore={initialScore}
          />
        </div>
      ) : null}

      <div
        className={`flex flex-wrap items-start justify-between gap-3 ${
          back || (showRating && favoriteUserId) ? "mt-4" : ""
        }`}
      >
        <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight text-foreground">
          {tender.title}
        </h1>
        {favoriteUserId ? (
          <div className="flex flex-wrap items-center gap-2">
            <BidCaseToggle
              userId={favoriteUserId}
              displayName={displayName}
              tenderId={tender.id}
              existingCaseId={existingBidCaseId}
            />
            <FavoriteToggle
              userId={favoriteUserId}
              tenderId={tender.id}
              initiallyFavorited={initiallyFavorited}
            />
          </div>
        ) : null}
      </div>

      {tender.description ? (
        <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
          {tender.description}
        </p>
      ) : null}

      <dl className="mt-8">
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{formatTenderStatus(tender.status)}</span>
            {tender.status && statusHistory.length > 0 ? (
              <StatusHistoryPopover entries={statusHistory} />
            ) : null}
          </div>
        </Field>
        <Field label="Tipo de contrato">{formatContractType(tender.contract_type)}</Field>
        <Field label="Procedimiento">{formatProcedureType(tender.procedure_type)}</Field>
        <Field label="Publicación">{formatDateMadrid(tender.publication_date)}</Field>
        <Field label="Plazo">{formatDateTimeMadrid(tender.deadline_at)}</Field>
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
          tenderCreatedAt={tender.created_at}
          tenderUpdatedAt={tender.updated_at}
        />
      </section>
    </main>
  );
}
