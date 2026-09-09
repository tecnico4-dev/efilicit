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

## Reglas

- Trabajar contra **local**, no producción.
- Nunca `supabase db reset --linked`.
- El link al proyecto remoto (`db pull`) es el **Paso 7** (aplazado si aún no existe el proyecto EfiLicit en Supabase).
- No guardar service role keys en Git.
