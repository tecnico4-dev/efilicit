"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  ChangePasswordForm,
  markPasswordOfferSeen,
  userNeedsPasswordOffer,
} from "@/app/account/change-password-form";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [offerPassword, setOfferPassword] = useState(false);

  function goNext() {
    router.replace(nextPath || "/");
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
    await markPasswordOfferSeen();
    setPending(false);
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
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          className="w-full"
          onClick={onSkipPassword}
        >
          Continuar sin cambiar
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
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
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
