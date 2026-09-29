import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

async function checkLocalSupabase(): Promise<{
  ok: boolean;
  detail: string;
}> {
  try {
    const supabase = createSupabaseClient();
    const { error } = await supabase
      .from("setup_rls_smoke")
      .select("id")
      .limit(1);

    if (error) {
      if (
        error.code === "PGRST301" ||
        error.message.toLowerCase().includes("permission") ||
        error.message.toLowerCase().includes("row-level security") ||
        error.code === "42501"
      ) {
        return {
          ok: true,
          detail: `API local responde (RLS bloquea anon, esperado): ${error.message}`,
        };
      }
      return { ok: false, detail: error.message };
    }

    return {
      ok: true,
      detail: "Consulta a setup_rls_smoke OK (sin filas visibles para anon).",
    };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export default async function Home() {
  const health = await checkLocalSupabase();

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
        EfiLicit
      </h1>
      <p className="mt-3 max-w-md text-center text-zinc-600">
        Vigilancia de contratación pública — Semana 5 (búsqueda + Auth).
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/search"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Ir a búsqueda
        </Link>
        <Link
          href="/alerts"
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
        >
          Alertas
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
        >
          Login
        </Link>
        <Link
          href="/register"
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
        >
          Registro
        </Link>
        <Link
          href="/account"
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
        >
          Cuenta
        </Link>
      </div>
      <p
        className={`mt-8 max-w-lg rounded-md px-4 py-3 text-sm ${
          health.ok
            ? "bg-emerald-50 text-emerald-900"
            : "bg-red-50 text-red-900"
        }`}
      >
        {health.ok ? "Supabase local: OK. " : "Supabase local: error. "}
        {health.detail}
      </p>
    </main>
  );
}
