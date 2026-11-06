"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_HINT,
  mapAuthPasswordError,
  passwordCharsetErrorMessage,
} from "@/lib/password-policy";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

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

/** «i» tipográfica: al click muestra la política de contraseña. */
function PasswordPolicyInfoButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={tipId}
        aria-label="Requisitos de la contraseña"
        onClick={() => setOpen((v) => !v)}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/35 bg-primary-light/70 font-serif text-[0.85rem] leading-none text-primary-dark italic hover:border-primary/55 hover:bg-primary-light"
      >
        i
      </button>
      {open ? (
        <p
          id={tipId}
          role="status"
          className="absolute right-0 top-full z-20 mt-1.5 w-max max-w-[16rem] rounded-md border border-border bg-surface px-3 py-2 text-xs text-foreground shadow-md"
        >
          {PASSWORD_POLICY_HINT}
        </p>
      ) : null}
    </div>
  );
}

/** Formulario de cambio de contraseña (Cuenta paso 2, o post-login sin pedir actual). */
export function ChangePasswordForm({
  onDone,
  onCancel,
  submitLabel = "Guardar contraseña",
  cancelLabel = "Cancelar",
  /** Si false, el tip «i» lo pone el contenedor (p. ej. modal). */
  showPolicyInfo = true,
}: {
  onDone?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  showPolicyInfo?: boolean;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Vacío / minLength: el navegador ya validó (bocadillos) antes de este evento.
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    const charsetError = passwordCharsetErrorMessage(password);
    if (charsetError) {
      setError(charsetError);
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
      setError(mapAuthPasswordError(updateError.message));
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
        <div className="mb-1 flex items-center justify-between gap-2">
          <label
            htmlFor="new_password"
            className="block text-sm text-muted-foreground"
          >
            Nueva contraseña
          </label>
          {showPolicyInfo ? <PasswordPolicyInfoButton /> : null}
        </div>
        <PasswordInput
          id="new_password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
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
        <PasswordInput
          id="confirm_password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
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

type ModalStep = "verify" | "change";

/**
 * Modal Cuenta: paso 1 verifica contraseña actual (sin cerrar sesión si falla);
 * paso 2 pide la nueva. El post-login usa solo `ChangePasswordForm`.
 */
export function ChangePasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<ModalStep>("verify");
  const [currentPassword, setCurrentPassword] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [forgotHint, setForgotHint] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setStep("verify");
    setCurrentPassword("");
    setVerifyError(null);
    setPending(false);
    setForgotHint(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function onVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifyError(null);
    setForgotHint(false);

    const supabase = createSupabaseBrowserClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const email = userData.user?.email?.trim();
    if (userError || !email) {
      setVerifyError("No se pudo comprobar la sesión. Inténtalo de nuevo.");
      return;
    }

    const { data: before } = await supabase.auth.getSession();
    const sessionBefore = before.session;

    setPending(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    setPending(false);

    if (signInError) {
      // Por si Auth limpiara la sesión ante un fallo: restaurar.
      const { data: after } = await supabase.auth.getSession();
      if (!after.session && sessionBefore) {
        await supabase.auth.setSession({
          access_token: sessionBefore.access_token,
          refresh_token: sessionBefore.refresh_token,
        });
      }
      setVerifyError("Contraseña incorrecta.");
      return;
    }

    setCurrentPassword("");
    setStep("change");
  }

  if (!open || !mounted) return null;

  const titleId = "change-password-title";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[min(90vh,36rem)] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-xl"
      >
        {step === "verify" ? (
          <>
            <h2
              id={titleId}
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              Cambiar contraseña
            </h2>
            <form onSubmit={onVerify} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="current_password"
                  className="mb-1 block text-sm text-muted-foreground"
                >
                  Introduce tu contraseña actual:
                </label>
                <PasswordInput
                  id="current_password"
                  autoComplete="current-password"
                  required
                  autoFocus
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              {verifyError ? (
                <p
                  className="rounded-lg border border-destructive/40 bg-surface px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {verifyError}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={pending}>
                  {pending ? "Comprobando…" : "Continuar"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={onClose}
                >
                  Cancelar
                </Button>
              </div>
              <div>
                <button
                  type="button"
                  className="text-sm font-medium text-link hover:underline"
                  onClick={() => setForgotHint((v) => !v)}
                >
                  ¿Has olvidado tu contraseña?
                </button>
                {forgotHint ? (
                  <p className="mt-1.5 text-sm text-muted-foreground" role="status">
                    Contacta con el administrador para restablecerla.
                  </p>
                ) : null}
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <h2
                id={titleId}
                className="text-lg font-semibold tracking-tight text-foreground"
              >
                Cambiar contraseña
              </h2>
              <PasswordPolicyInfoButton />
            </div>
            <div className="mt-4">
              <ChangePasswordForm
                onDone={onClose}
                onCancel={onClose}
                showPolicyInfo={false}
              />
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
