/**
 * Semana 5 / Paso 6 — prueba explícita RLS Alice ≠ Bob.
 *
 * Uso (Supabase local + seed):
 *   cd apps/web
 *   node --env-file=.env.local scripts/verify-rls-alerts.mjs
 *
 * Esperado: sale "RLS A≠B OK" y exit 0.
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
  const alice = await signIn(ALICE.email, ALICE.password);
  const aliceUserId = await profileId(alice);

  const marker = `rls-alice-${Date.now()}`;
  const { data: created, error: createError } = await alice
    .from("alerts")
    .insert({
      user_id: aliceUserId,
      name: marker,
      criteria: { version: 1, keywords: ["rls-test"] },
      frequency: "daily",
      is_active: true,
    })
    .select("id, name")
    .single();

  if (createError || !created) {
    throw new Error(`Alice create: ${createError?.message ?? "null"}`);
  }

  const { data: aliceList, error: aliceListError } = await alice
    .from("alerts")
    .select("id, name")
    .eq("id", created.id);

  if (aliceListError) throw new Error(`Alice list: ${aliceListError.message}`);
  if (!aliceList?.length) throw new Error("Alice no ve su propia alerta");

  await alice.auth.signOut();

  const bob = await signIn(BOB.email, BOB.password);
  const { data: bobById, error: bobByIdError } = await bob
    .from("alerts")
    .select("id, name")
    .eq("id", created.id);

  if (bobByIdError) throw new Error(`Bob by id: ${bobByIdError.message}`);
  if (bobById && bobById.length > 0) {
    throw new Error("FALLO RLS: Bob puede leer la alerta de Alice");
  }

  const { data: bobAll, error: bobAllError } = await bob.from("alerts").select("id, name");
  if (bobAllError) throw new Error(`Bob list: ${bobAllError.message}`);
  if ((bobAll ?? []).some((row) => row.id === created.id || row.name === marker)) {
    throw new Error("FALLO RLS: la alerta de Alice aparece en el listado de Bob");
  }

  console.log("RLS A≠B OK");
  console.log(`  Alice ve su alerta ${created.id}`);
  console.log("  Bob no ve esa alerta (select por id vacío + listado sin ella)");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
