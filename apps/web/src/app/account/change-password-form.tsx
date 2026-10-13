"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const META_PASSWORD_CHANGED = "password_changed";
const META_PASSWORD_OFFER_SEEN = "password_offer_seen";

/** Ofrecer cambio opcional solo la primera vez (hasta cambiar o omitir). */
export function userNeedsPasswordOffer(
  user: { user_metadata?: Record<string, unknown> } | null,
): boolean {
  if (!user) return false;
  const meta = user.user_metadata ?? {};
  if (meta[META_PASSWORD_CHANGED] === true) return false;
  if (meta[META_PASSWORD_OFFER_SEEN] === true) return false;
  return true;
}

export async function markPasswordOfferSeen() {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.updateUser({
    data: { [META_PASSWORD_OFFER_SEEN]: true },
  });
}

/** Formulario de cambio de contraseña (Cuenta o post-login opcional). */
export function ChangePasswordForm({
  onDone,
  submitLabel = "Guardar contraseña",
}: {
  onDone?: () => void;
  submitLabel?: string;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setPending(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { [META_PASSWORD_CHANGED]: true },
    });
    setPending(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setPassword("");
    setConfirm("");
    setSaved(true);
    onDone?.();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="new_password"
          className="mb-1 block text-sm text-muted-foreground"
        >
          Nueva contraseña
        </label>
        <Input
          id="new_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div>
        <label
          htmlFor="confirm_password"
          className="mb-1 block text-sm text-muted-foreground"
        >
          Confirmar contraseña
        </label>
        <Input
          id="confirm_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
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
      {saved ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-foreground" role="status">
          Contraseña actualizada.
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : submitLabel}
      </Button>
    </form>
  );
}
