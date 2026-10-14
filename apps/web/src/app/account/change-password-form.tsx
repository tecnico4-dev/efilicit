"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const META_PASSWORD_CHANGED = "password_changed";
const META_PASSWORD_OFFER_SEEN = "password_offer_seen";

function metaFlagTrue(
  meta: Record<string, unknown>,
  key: string,
): boolean {
  const v = meta[key];
  return v === true || v === "true" || v === 1;
}

/**
 * Oferta de cambio de contraseña solo en el primer acceso:
 * desaparece si ya la cambió o si eligió «Continuar sin cambiar».
 */
export function userNeedsPasswordOffer(
  user: { user_metadata?: Record<string, unknown> } | null,
): boolean {
  if (!user) return false;
  const meta = user.user_metadata ?? {};
  if (metaFlagTrue(meta, META_PASSWORD_CHANGED)) return false;
  if (metaFlagTrue(meta, META_PASSWORD_OFFER_SEEN)) return false;
  return true;
}

/** Persiste que ya se mostró/omitió la oferta (no volver a preguntar). */
export async function markPasswordOfferSeen(): Promise<{ error: Error | null }> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.updateUser({
    data: { [META_PASSWORD_OFFER_SEEN]: true },
  });
  if (error) return { error: new Error(error.message) };
  await supabase.auth.refreshSession();
  return { error: null };
}

/** Formulario de cambio de contraseña (Cuenta, modal o post-login). */
export function ChangePasswordForm({
  onDone,
  onCancel,
  submitLabel = "Guardar contraseña",
  cancelLabel = "Cancelar",
}: {
  onDone?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
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
      {saved && !onDone ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-foreground" role="status">
          Contraseña actualizada.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : submitLabel}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/** Modal que bloquea la página hasta Guardar o Cancelar. */
export function ChangePasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl"
      >
        <h2
          id="change-password-title"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          Cambiar contraseña
        </h2>
        <div className="mt-4">
          <ChangePasswordForm onDone={onClose} onCancel={onClose} />
        </div>
      </div>
    </div>
  );
}
