"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createOwnAlert,
  ownAlertNameTaken,
  type DigestFrequency,
} from "@/lib/queries";
import type { SearchCriteria } from "@efilicit/types";

/**
 * Convierte una búsqueda guardada en alerta: pide nombre inline
 * (criterios ya vienen de la búsqueda).
 */
export function ConvertToAlertButton({
  userId,
  digestFrequency,
  defaultName,
  criteria,
}: {
  userId: string;
  digestFrequency: DigestFrequency;
  defaultName: string;
  criteria: SearchCriteria;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onCreate() {
    if (!name.trim()) {
      setError("Indica un nombre para la alerta.");
      return;
    }
    setPending(true);
    setError(null);
    const client = createSupabaseBrowserClient();
    const nameCheck = await ownAlertNameTaken(client, { name: name.trim() });
    if (nameCheck.error) {
      setPending(false);
      setError(nameCheck.error.message);
      return;
    }
    if (nameCheck.taken) {
      setPending(false);
      setError("Ya existe una alerta con este nombre.");
      return;
    }

    const { error: createError } = await createOwnAlert(client, {
      userId,
      name: name.trim(),
      criteria,
      frequency: digestFrequency,
    });
    setPending(false);
    if (createError) {
      setError(createError.message);
      return;
    }
    setDone(true);
    setOpen(false);
    router.refresh();
  }

  if (done) {
    return (
      <span className="text-sm text-muted-foreground">
        Alerta creada.{" "}
        <a href="/alerts" className="font-medium text-link hover:underline">
          Ir a Alertas
        </a>
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="text-sm font-medium text-link hover:underline"
        onClick={() => {
          setName(defaultName);
          setError(null);
          setOpen(true);
        }}
      >
        Convertir en alerta
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border bg-surface p-3">
      <label className="block text-sm font-medium text-foreground">
        Nombre de la alerta
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1"
          autoFocus
        />
      </label>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={onCreate}>
          {pending ? "Creando…" : "Crear alerta"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
