import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
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
      </div>
    </main>
  );
}
