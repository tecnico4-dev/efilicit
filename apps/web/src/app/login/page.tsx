import { ThemeToggle } from "@/components/shell/theme-toggle";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { FallingPapersBackground } from "./falling-papers-background";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const nextPath = safeRedirectPath(first(params.next));

  return (
    <>
      <FallingPapersBackground />
      <div className="fixed right-4 top-4 z-20">
        <ThemeToggle />
      </div>
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
        <div
          className={[
            "login-card relative rounded-2xl border border-border/70 bg-surface/80 p-7 backdrop-blur-md",
            "supports-[backdrop-filter]:bg-surface/70",
            /* Claro: sombra marcada; oscuro: halo cian suave + profundidad */
            "shadow-[0_22px_50px_-14px_rgba(15,45,70,0.38),0_8px_16px_-8px_rgba(15,45,70,0.2)]",
            "dark:border-border/50 dark:shadow-[0_0_48px_-10px_rgba(82,185,216,0.35),0_24px_48px_-20px_rgba(0,0,0,0.65)]",
          ].join(" ")}
        >
          <p className="text-center text-3xl font-bold tracking-tight text-foreground">
            Efi<span className="text-primary-dark">Licit</span>
          </p>
          <p className="mt-1.5 text-center text-xs text-muted-foreground">
            Vigilancia de contratación pública
          </p>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
            Iniciar sesión
          </h1>
          <LoginForm nextPath={nextPath} />
        </div>
      </main>
    </>
  );
}
