# Semana 5 — Recorrido E2E local (Paso 10)

Recorrido: **registrarse/login → buscar → crear alerta → batch → digest**.  
Email **real (Resend)** queda para cuando tengas cuenta; aquí validamos con `FakeEmailSender` (`--write` sin `--send`).

## Prerrequisitos

1. Docker Desktop **Running**.
2. Supabase local arriba:

```powershell
$env:Path = "C:\Users\tecnico4\scoop\shims;" + $env:Path
cd C:\Users\tecnico4\dev\efilicit
supabase status
```

- API: http://127.0.0.1:54321  
- Studio: http://127.0.0.1:54323  

3. `apps/web/.env.local` apunta a local (`NEXT_PUBLIC_SUPABASE_URL` + publishable/anon key de `supabase status`).
4. Seed Auth: `alice@example.com` / `password123` (también `bob@example.com`).

## Fase A — Web (tú)

```powershell
cd C:\Users\tecnico4\dev\efilicit
pnpm --filter @efilicit/web dev
```

1. Abre http://localhost:3000/login → Alice (`alice@example.com` / `password123`).
2. `/search`: busca `software` (y opcionalmente una errata tipo `softwar`). Debe haber resultados.
3. `/alerts`: crea (o confirma) una alerta con keywords `software` y CPV `72000000` (valores por defecto del formulario).
4. Comprueba que la alerta aparece en la lista (solo las tuyas).

## Fase B — Batch local (sin Resend)

En otra terminal:

```powershell
cd C:\Users\tecnico4\dev\efilicit\ingestion
uv run python -m efilicit_ingestion.cli run-alerts --write --since-days 30
```

**Esperado (ejemplo):** `mode=write+fake`, `matches≥1`, `enqueued_new≥1` o `enqueued_existing`, `drain … sent≥1`, `failed=0`.  
No llega correo a la bandeja: el Fake solo deja rastro en DB.

## Fase C — Cola en Studio

Studio → Table Editor → `notification_queue`:

- Filas con `status = sent` (o `pending` si aún no drenó).
- `payload` con `title`, `digest`, y tras Fake normalmente `provider_id` tipo `fake-…`.
- `idempotency_key` estable.

## Fase D — Idempotencia

Repite el mismo comando `--write` con el **mismo** `--digest` (o el día por defecto).

**Esperado:** `enqueued_new=0` (o solo `enqueued_existing`), `drain … sent=0` / `attempted=0` — **no** reenvía lo ya `sent`.

## Fase E (opcional, más adelante) — Resend real

Cuando tengas cuenta Resend + secretos en entorno:

```powershell
$env:RESEND_API_KEY="re_..."
$env:ALERT_FROM_EMAIL="EfiLicit <onboarding@resend.dev>"
uv run python -m efilicit_ingestion.cli run-alerts --write --send --since-days 30
```

## Criterios Paso 10

| Criterio | Cómo se ve OK |
|---|---|
| Búsqueda términos normales | `/search` con `software` muestra filas |
| Errata razonable (`pg_trgm`) | p. ej. `mntenimiento` (nota: `softwar` solo no basta con umbral 0.3 actual) |
| Alerta propia | `/alerts` crea y lista la alerta |
| Batch → digest | `--write` → cola `sent` + Fake |
| Sin reenvío | 2ª pasada no marca nuevos `sent` del mismo digest |
| Email real | Diferido hasta Resend (no bloquea Paso 10) |

## Pendiente post-Paso 10

- Mejorar erratas cortas en búsqueda (`word_similarity` / `<%` en lugar de solo `similarity` del título completo).
- Smoke Resend real cuando haya cuenta + secretos.
