import { ThemeToggle } from "@/components/shell/theme-toggle";
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
  const nextPath = first(params.next) || "/";

  return (
    <>
      <FallingPapersBackground />
      <div className="fixed right-4 top-4 z-20">
        <ThemeToggle />
      </div>
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
        <div className="relative rounded-2xl border border-border/70 bg-surface/80 p-7 shadow-xl backdrop-blur-md supports-[backdrop-filter]:bg-surface/70">
          <p className="text-center text-lg font-bold tracking-tight text-foreground">
            Efi<span className="text-primary-dark">Licit</span>
          </p>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            Iniciar sesión
          </h1>
          <LoginForm nextPath={nextPath.startsWith("/") ? nextPath : "/"} />
        </div>
      </main>
    </>
  );
}
