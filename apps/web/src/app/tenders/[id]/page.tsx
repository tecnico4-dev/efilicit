import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenderById } from "@/lib/queries";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

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

export default async function TenderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: tender, error } = await getTenderById(supabase, id);

  if (error) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <p className="text-sm text-destructive" role="alert">
          No se pudo cargar la licitación: {error.message}
        </p>
        <p className="mt-4 text-sm">
          <Link href="/search" className="font-medium text-link hover:underline">
            Volver a la búsqueda
          </Link>
        </p>
      </main>
    );
  }

  if (!tender) {
    notFound();
  }

  const authority = tender.contracting_authority;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
      <p className="text-sm">
        <Link href="/search" className="font-medium text-link hover:underline">
          ← Volver a la búsqueda
        </Link>
      </p>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
        {tender.title}
      </h1>

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
          <span className="font-mono">{tender.cpv_code ?? "—"}</span>
        </Field>
        <Field label="Estado">{tender.status ?? "—"}</Field>
        <Field label="Tipo de contrato">{tender.contract_type ?? "—"}</Field>
        <Field label="Procedimiento">{tender.procedure_type ?? "—"}</Field>
        <Field label="Publicación">{formatDate(tender.publication_date)}</Field>
        <Field label="Plazo">{formatDate(tender.deadline_at)}</Field>
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
        <Field label="Fuente canónica">
          <span className="font-mono">{tender.canonical_source_code}</span>
        </Field>
      </dl>
    </main>
  );
}
