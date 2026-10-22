"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeRedirectPath } from "@/lib/safe-redirect";
import {
  ChangePasswordForm,
  markPasswordOfferSeen,
  userNeedsPasswordOffer,
} from "@/app/account/change-password-form";

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden
    >
      {crossed ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.9 5.2A9.8 9.8 0 0 1 12 5c5 0 9.3 3.1 11 7.5a11.6 11.6 0 0 1-4 5.1" />
          <path d="M6.1 6.1A11.6 11.6 0 0 0 1 12.5C2.7 16.9 7 20 12 20a9.8 9.8 0 0 0 4.2-.9" />
        </>
      ) : (
        <>
          <path d="M2 12.5C3.7 8.1 7.9 5 12 5s8.3 3.1 10 7.5c-1.7 4.4-5.9 7.5-10 7.5S3.7 16.9 2 12.5z" />
          <circle cx="12" cy="12.5" r="2.5" />
        </>
      )}
    </svg>
  );
}

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotHint, setShowForgotHint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [offerPassword, setOfferPassword] = useState(false);

  function goNext() {
    router.replace(safeRedirectPath(nextPath));
    router.refresh();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setPending(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    if (userNeedsPasswordOffer(data.user)) {
      setOfferPassword(true);
      return;
    }

    goNext();
  }

  async function onSkipPassword() {
    setPending(true);
    setError(null);
    const { error: markError } = await markPasswordOfferSeen();
    setPending(false);
    if (markError) {
      setError(
        "No se pudo guardar tu preferencia. Inténtalo de nuevo o continúa desde Cuenta.",
      );
      return;
    }
    goNext();
  }

  if (offerPassword) {
    return (
      <div className="mt-8 space-y-6">
        <div>
          <h2 className="text-base font-medium text-foreground">
            ¿Quieres cambiar tu contraseña?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Es opcional. Si te la han dado temporal, puedes actualizarla ahora o
            más tarde en Cuenta.
          </p>
        </div>
        <ChangePasswordForm
          submitLabel="Guardar y continuar"
          onDone={goNext}
        />
        {error ? (
          <p
            className="rounded-lg border border-destructive/40 bg-surface px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          className="w-full"
          onClick={onSkipPassword}
        >
          {pending ? "Guardando…" : "Continuar sin cambiar"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-sm text-muted-foreground"
        >
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-sm text-muted-foreground"
        >
          Contraseña
        </label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            aria-label={
              showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
            }
            aria-pressed={showPassword}
          >
            <EyeIcon crossed={!showPassword} />
          </button>
        </div>
        <p className="mt-1.5 text-right">
          <button
            type="button"
            onClick={() => setShowForgotHint(true)}
            className="text-xs text-primary underline-offset-2 hover:text-primary-dark hover:underline"
          >
            ¿Has olvidado tu contraseña?
          </button>
        </p>
        {showForgotHint ? (
          <p
            className="mt-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
            role="status"
          >
            Contacta con el administrador para restablecerla.
          </p>
        ) : null}
      </div>
      {error ? (
        <p
          className="rounded-lg border border-destructive/40 bg-surface px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
