"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  asFavoriteKind,
  createOwnAlert,
  ownAlertNameTaken,
  type DigestFrequency,
  type FavoriteKind,
} from "@/lib/queries";
import type { SearchCriteria } from "@efilicit/types";
import { cn } from "@/lib/cn";

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
  const [kind, setKind] = useState<FavoriteKind | "">("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onCreate() {
    if (!name.trim()) {
      setError("Indica un nombre para la alerta.");
      return;
    }
    const alertKind = asFavoriteKind(kind);
    if (!alertKind) {
      setError("Indica el tipo de alerta.");
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
      kind: alertKind,
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
          setKind("");
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <label className="block min-w-0 flex-1 text-sm font-medium text-primary">
          Nombre de la alerta*
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 border-primary/25 bg-primary-light/45"
            autoFocus
          />
        </label>
        <label className="block shrink-0 text-sm font-medium text-primary">
          Clasificación*
          <select
            value={kind}
            onChange={(e) =>
              setKind((e.target.value as FavoriteKind | "") || "")
            }
            className={cn(
              "mt-1 w-[9.75rem] rounded-lg border border-primary/25 bg-primary-light/45 px-3 py-2.5 text-sm text-foreground shadow-sm outline-none transition-colors",
              "focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
              kind === "" && "text-muted-foreground",
            )}
          >
            <option value="" />
            <option value="propia">Eficen</option>
            <option value="subcontrata">Subcontrata</option>
          </select>
        </label>
      </div>
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
