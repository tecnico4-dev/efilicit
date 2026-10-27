/**
 * Semana 6 / Paso 5 — prueba RLS Alice ≠ Bob en favorites.
 *
 * Uso (Supabase local + seed + migración favorites):
 *   cd apps/web
 *   pnpm verify:rls:favorites
 *
 * Esperado: "RLS favorites A≠B OK" y exit 0.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const ALICE = { email: "alice@example.com", password: "password123" };
const BOB = { email: "bob@example.com", password: "password123" };

function clientFor() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email, password) {
  const client = clientFor();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(`Login ${email}: ${error?.message ?? "sin user"}`);
  }
  return client;
}

async function profileId(client) {
  const { data: auth } = await client.auth.getUser();
  const { data, error } = await client
    .from("users")
    .select("id")
    .eq("auth_user_id", auth.user.id)
    .single();
  if (error || !data) throw new Error(`Perfil: ${error?.message ?? "null"}`);
  return data.id;
}

async function main() {
  const anon = clientFor();
  const { data: tenders, error: tenderError } = await anon
    .from("tenders")
    .select("id")
    .limit(1);
  if (tenderError) throw new Error(`tenders: ${tenderError.message}`);
  if (!tenders?.length) {
    throw new Error("No hay tenders en local para la prueba (ingesta primero)");
  }
  const tenderId = tenders[0].id;

  const alice = await signIn(ALICE.email, ALICE.password);
  const aliceUserId = await profileId(alice);

  await alice.from("favorites").delete().eq("user_id", aliceUserId).eq("tender_id", tenderId);

  const { data: created, error: createError } = await alice
    .from("favorites")
    .insert({ user_id: aliceUserId, tender_id: tenderId })
    .select("id, tender_id")
    .single();

  if (createError || !created) {
    throw new Error(`Alice create: ${createError?.message ?? "null"}`);
  }

  const { data: aliceList, error: aliceListError } = await alice
    .from("favorites")
    .select("id")
    .eq("id", created.id);
  if (aliceListError) throw new Error(`Alice list: ${aliceListError.message}`);
  if (!aliceList?.length) throw new Error("Alice no ve su propio favorito");

  await alice.auth.signOut();

  const bob = await signIn(BOB.email, BOB.password);
  const { data: bobById, error: bobByIdError } = await bob
    .from("favorites")
    .select("id")
    .eq("id", created.id);
  if (bobByIdError) throw new Error(`Bob by id: ${bobByIdError.message}`);
  if (bobById && bobById.length > 0) {
    throw new Error("FALLO RLS: Bob puede leer el favorito de Alice");
  }

  const { data: bobAll, error: bobAllError } = await bob.from("favorites").select("id, tender_id");
  if (bobAllError) throw new Error(`Bob list: ${bobAllError.message}`);
  if ((bobAll ?? []).some((row) => row.id === created.id)) {
    throw new Error("FALLO RLS: el favorito de Alice aparece en el listado de Bob");
  }

  // Limpieza (relogin Alice)
  const aliceCleanup = await signIn(ALICE.email, ALICE.password);
  await aliceCleanup.from("favorites").delete().eq("id", created.id);

  console.log("RLS favorites A≠B OK");
  console.log(`  Alice ve su favorito ${created.id} (tender ${tenderId})`);
  console.log("  Bob no ve ese favorito");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
