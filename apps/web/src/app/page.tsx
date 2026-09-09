import { createSupabaseClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

async function checkLocalSupabase(): Promise<{
  ok: boolean;
  detail: string;
}> {
  try {
    const supabase = createSupabaseClient();
    // Anon cannot read setup_rls_smoke (RLS) — we only care that the API answers.
    const { error } = await supabase
      .from("setup_rls_smoke")
      .select("id")
      .limit(1);

    if (error) {
      // Permission / RLS errors still prove we reached local Supabase.
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
        Fase 0 — web en blanco conectada a Supabase <strong>local</strong>.
      </p>
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
