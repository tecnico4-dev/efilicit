# supabase/

Configuración local de Supabase para EfiLicit (Fase 0).

## Qué hay aquí

| Ruta | Rol |
|---|---|
| `config.toml` | Config del stack local |
| `migrations/` | Migraciones versionadas |
| `seed.sql` | Datos sintéticos locales (Paso 8) |
| `functions/` | Edge Functions (vacío por ahora) |

## Arranque local

Requisito: Docker Desktop **Running**.

```powershell
$env:Path = "C:\Users\tecnico4\scoop\shims;" + $env:Path
cd C:\Users\tecnico4\dev\efilicit
supabase start
supabase status
supabase db reset
```

URLs típicas (confirma con `supabase status`):

- API: http://127.0.0.1:54321
- Studio: http://127.0.0.1:54323

## Paso 8 — qué valida

- Bucket Storage privado `raw` (clientes no escriben RAW; la ingesta usará service role).
- Tabla smoke `setup_rls_smoke` con RLS (cada usuario solo ve lo suyo).
- Seed: `alice@example.com` / `bob@example.com` (password local: `password123`).

## Remoto (Paso 7)

Bootstrap greenfield documentado en [ADR 002](../docs/adr/002-bootstrap-supabase-remoto-greenfield.md):

- Proyecto vinculado: **EfiLicit** (`luvxqyajujlznocflymo`) — https://luvxqyajujlznocflymo.supabase.co  
- PostgreSQL major local y remoto: **17** (alineados).  
- El remoto empezó vacío; se aplicó la migración local `20260909090000_fase0_storage_raw_and_rls_smoke` con `supabase db push` (no `db reset --linked`).  
- `supabase db pull` no generó migración nueva porque no había esquema de app que capturar; el historial local/remoto ya coincide.

Identificador `SUPABASE_PROJECT_REF=luvxqyajujlznocflymo` (no es un secreto).
