"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createOwnAlert, type DigestFrequency } from "@/lib/queries";
import type { SearchCriteria } from "@efilicit/types";
import { SEARCH_FORM_ID } from "./save-search-button";

function readField(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name);
  if (el instanceof HTMLInputElement) return el.value.trim();
  return "";
}

function buildCriteria(form: HTMLFormElement): {
  criteria: SearchCriteria;
  name: string;
} | null {
  const q = readField(form, "q");
  const cpv = readField(form, "cpv");
  const minRaw = readField(form, "min");
  const maxRaw = readField(form, "max");
  const min = minRaw === "" ? undefined : Number(minRaw);
  const max = maxRaw === "" ? undefined : Number(maxRaw);

  const keywords = q
    ? q
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const hasSomething =
    (keywords && keywords.length > 0) ||
    cpv !== "" ||
    (min != null && !Number.isNaN(min)) ||
    (max != null && !Number.isNaN(max));

  if (!hasSomething) return null;

  const criteria: SearchCriteria = {
    version: 1,
    keywords: keywords?.length ? keywords : undefined,
    cpv_codes: cpv ? [cpv] : undefined,
    estimated_value_min: min != null && !Number.isNaN(min) ? min : undefined,
    estimated_value_max: max != null && !Number.isNaN(max) ? max : undefined,
  };

  const name =
    q ||
    (cpv ? `CPV ${cpv}` : null) ||
    "Alerta";

  return { criteria, name };
}

/**
 * Crea una alerta con los criterios del formulario de búsqueda.
 * Solo con sesión (mismo patrón que Guardar búsqueda).
 */
export function CreateAlertButton({
  userId,
  digestFrequency,
}: {
  userId: string;
  digestFrequency: DigestFrequency;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function onCreate() {
    setMessage(null);
    setIsError(false);

    const form = document.getElementById(SEARCH_FORM_ID) as HTMLFormElement | null;
    if (!form) {
      setIsError(true);
      setMessage("No se encontró el formulario de búsqueda.");
      return;
    }

    const built = buildCriteria(form);
    if (!built) {
      setIsError(true);
      setMessage("Indica al menos un criterio antes de crear la alerta.");
      return;
    }

    setPending(true);
    const client = createSupabaseBrowserClient();
    const { error } = await createOwnAlert(client, {
      userId,
      name: built.name,
      criteria: built.criteria,
      frequency: digestFrequency,
    });
    setPending(false);

    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }

    setIsError(false);
    setMessage("Alerta creada.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={onCreate}
      >
        {pending ? "Creando…" : "Crear alerta"}
      </Button>
      {message ? (
        <p
          className={`text-xs ${isError ? "text-destructive" : "text-muted-foreground"}`}
          role={isError ? "alert" : "status"}
        >
          {message}
          {!isError ? (
            <>
              {" "}
              <a href="/alerts" className="font-medium text-link hover:underline">
                Ir a Alertas
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
