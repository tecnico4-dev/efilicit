/**
 * Favoritos compartidos peer-to-peer (ADR 032).
 * N filas; UNIQUE (tender_id, from_user_id, to_user_id).
 * Quitar = hide por lado; DELETE solo si ambos ocultos.
 */
import type { Database } from "@efilicit/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { asFavoriteKind, type FavoriteKind } from "./favorite-kind";
import { SHARED_FAVORITE_NOTES_MAX } from "./shared-favorites";

export type FavoriteShareDirection = "sent" | "received";

export type FavoriteShareRow = {
  id: string;
  tenderId: string;
  fromUserId: string;
  toUserId: string;
  kind: FavoriteKind;
  notes: string | null;
  createdAt: string;
  direction: FavoriteShareDirection;
  /** Contraparte (to si enviada; from si recibida). */
  counterpartUserId: string;
  counterpartDisplayName: string | null;
  tender: {
    id: string;
    title: string;
    status: string | null;
    procedure_type: string | null;
    contract_type: string | null;
    estimated_value: number | null;
    currency: string;
    cpv_codes: string[];
    publication_date: string | null;
    deadline_at: string | null;
  } | null;
};

export type AddFavoriteSharesResult =
  | { ok: true; inserted: number; already: string[] }
  | { ok: false; error: Error };

/** Mensaje si ya existe el par tender+from+to. */
export function favoriteShareAlreadyMessage(
  counterpartDisplayName: string | null,
): string {
  const who = counterpartDisplayName?.trim() || "ese usuario";
  return `Ya has compartido esta licitación con ${who}.`;
}

export async function addFavoriteShares(
  client: SupabaseClient<Database>,
  input: {
    fromUserId: string;
    tenderId: string;
    toUserIds: string[];
    kind: FavoriteKind;
    notes?: string | null;
  },
): Promise<AddFavoriteSharesResult> {
  const uniqueTos = [
    ...new Set(input.toUserIds.filter((id) => id && id !== input.fromUserId)),
  ];
  if (uniqueTos.length === 0) {
    return { ok: false, error: new Error("Selecciona al menos una persona.") };
  }

  const notes =
    input.notes == null || input.notes.trim() === ""
      ? null
      : input.notes.trim().slice(0, SHARED_FAVORITE_NOTES_MAX);

  let inserted = 0;
  const already: string[] = [];

  for (const toUserId of uniqueTos) {
    const { error } = await client.from("favorites_shared").insert({
      tender_id: input.tenderId,
      from_user_id: input.fromUserId,
      to_user_id: toUserId,
      kind: input.kind,
      notes,
    });
    if (!error) {
      inserted += 1;
      continue;
    }
    if (error.code === "23505") {
      // Fila existente: reactivar solo si algún lado estaba oculto.
      const { data: status, error: reactivateError } = await client.rpc(
        "reactivate_favorite_share",
        {
          p_tender_id: input.tenderId,
          p_to_user_id: toUserId,
          p_kind: input.kind,
          p_notes: notes,
        },
      );
      if (reactivateError) {
        return { ok: false, error: new Error(reactivateError.message) };
      }
      if (status === "reactivated") {
        inserted += 1;
      } else {
        already.push(toUserId);
      }
      continue;
    }
    return { ok: false, error: new Error(error.message) };
  }

  return { ok: true, inserted, already };
}

/** Oculta el share para el caller; si ambos lados ocultos, borra la fila. */
export async function removeFavoriteShare(
  client: SupabaseClient<Database>,
  shareId: string,
): Promise<{ error: Error | null }> {
  const { error } = await client.rpc("hide_favorite_share", {
    p_share_id: shareId,
  });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

type ListDbRow = {
  id: string;
  tender_id: string;
  from_user_id: string;
  to_user_id: string;
  kind: string;
  notes: string | null;
  created_at: string;
  tenders: {
    id: string;
    title: string;
    status: string | null;
    procedure_type: string | null;
    contract_type: string | null;
    estimated_value: number | null;
    currency: string;
    publication_date: string | null;
    deadline_at: string | null;
    tender_cpvs?: { cpv_code: string }[] | null;
  } | null;
};

/**
 * Filas donde soy from o to. Nombres vía eficen_members (mapa aparte).
 */
export async function listOwnFavoriteShares(
  client: SupabaseClient<Database>,
  currentUserId: string,
): Promise<{ data: FavoriteShareRow[]; error: Error | null }> {
  const { data, error } = await client
    .from("favorites_shared")
    .select(
      `
      id,
      tender_id,
      from_user_id,
      to_user_id,
      kind,
      notes,
      created_at,
      tenders (
        id,
        title,
        status,
        procedure_type,
        contract_type,
        estimated_value,
        currency,
        publication_date,
        deadline_at,
        tender_cpvs ( cpv_code )
      )
    `,
    )
    .or(`from_user_id.eq.${currentUserId},to_user_id.eq.${currentUserId}`)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: new Error(error.message) };

  const rows = (data as ListDbRow[] | null) ?? [];
  const counterpartIds = [
    ...new Set(
      rows.map((r) =>
        r.from_user_id === currentUserId ? r.to_user_id : r.from_user_id,
      ),
    ),
  ];

  const nameByUser = await mapMemberNames(client, counterpartIds);

  return {
    data: rows.map((row) => {
      const sent = row.from_user_id === currentUserId;
      const counterpartUserId = sent ? row.to_user_id : row.from_user_id;
      const tender = row.tenders;
      return {
        id: row.id,
        tenderId: row.tender_id,
        fromUserId: row.from_user_id,
        toUserId: row.to_user_id,
        kind: asFavoriteKind(row.kind) ?? "propia",
        notes: row.notes,
        createdAt: row.created_at,
        direction: sent ? ("sent" as const) : ("received" as const),
        counterpartUserId,
        counterpartDisplayName: nameByUser.get(counterpartUserId) ?? null,
        tender: tender
          ? {
              id: tender.id,
              title: tender.title,
              status: tender.status,
              procedure_type: tender.procedure_type,
              contract_type: tender.contract_type,
              estimated_value: tender.estimated_value,
              currency: tender.currency,
              publication_date: tender.publication_date,
              deadline_at: tender.deadline_at,
              cpv_codes: [...(tender.tender_cpvs ?? []).map((c) => c.cpv_code)].sort(),
            }
          : null,
      };
    }),
    error: null,
  };
}

async function mapMemberNames(
  client: SupabaseClient<Database>,
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;
  const { data } = await client
    .from("eficen_members")
    .select("user_id, display_name")
    .in("user_id", userIds);
  for (const row of data ?? []) {
    if (row.user_id && row.display_name?.trim()) {
      map.set(row.user_id, row.display_name.trim());
    }
  }
  return map;
}
