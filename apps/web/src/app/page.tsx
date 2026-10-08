import { Button } from "@/components/ui/button";
import { createSupabaseClient } from "@/lib/supabase/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Evita cachear la home: el health-check debe hablar siempre con Supabase “ahora”.
export const dynamic = "force-dynamic";

/**
 * Comprueba que la API de Supabase local responde.
 *
 * Usa `setup_rls_smoke` (tabla de prueba Fase 0) con la clave anon/publishable.
 * - Sin filas visibles o error de permiso/RLS ⇒ OK (anon no debe leer datos ajenos).
 * - Error de red / URL mal configurada ⇒ KO.
 */
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

  let isAuthenticated = false;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isAuthenticated = Boolean(user);
  } catch {
    isAuthenticated = false;
  }

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(82,185,216,0.18),transparent_45%)]" />

      <div className="relative flex max-w-lg flex-col items-center text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Vigilancia de contratación pública
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Efi<span className="text-primary-dark">Licit</span>
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          {isAuthenticated
            ? "Busca licitaciones, gestiona alertas y sigue las oportunidades que te interesan."
            : "Busca licitaciones de forma sencilla. Inicia sesión para guardar alertas y personalizar tu seguimiento."}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button href="/search">Buscar licitaciones</Button>
          {isAuthenticated ? (
            <>
              <Button href="/alerts" variant="outline">
                Mis alertas
              </Button>
              <Button href="/account" variant="ghost">
                Cuenta
              </Button>
            </>
          ) : (
            <>
              <Button href="/login" variant="outline">
                Iniciar sesión
              </Button>
              <Button href="/register" variant="ghost">
                Registrarse
              </Button>
            </>
          )}
        </div>

        <p
          className={`mt-10 max-w-lg rounded-lg border px-4 py-3 text-left text-sm ${
            health.ok
              ? "border-primary/30 bg-primary/5 text-foreground"
              : "border-destructive/40 bg-surface text-destructive"
          }`}
        >
          {health.ok ? "Supabase local: OK. " : "Supabase local: error. "}
          {health.detail}
        </p>
      </div>
    </main>
  );
}
