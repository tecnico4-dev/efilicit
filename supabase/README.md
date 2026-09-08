# supabase/

Configuración local de Supabase para EfiLicit (Fase 0 — Paso 5).

## Qué hay aquí

| Ruta | Rol |
|---|---|
| `config.toml` | Config del stack local (puertos, DB, Auth, Storage…) |
| `migrations/` | Migraciones versionadas (vacío hasta capturar remoto / Semana 1) |
| `seed.sql` | Seed sintético de desarrollo (Paso 8) |
| `functions/` | Edge Functions (vacío por ahora) |

## Arranque local

Requisito: Docker Desktop **Running**.

```powershell
$env:Path = "C:\Users\tecnico4\scoop\shims;" + $env:Path
cd C:\Users\tecnico4\dev\efilicit
supabase start
supabase status
```

URLs típicas (confirma con `supabase status`):

- API: http://127.0.0.1:54321
- Studio: http://127.0.0.1:54323
- DB: postgresql://postgres:postgres@127.0.0.1:54322/postgres

## Reglas

- Trabajar contra **local**, no producción.
- Nunca `supabase db reset --linked` contra el proyecto remoto.
- El link al proyecto remoto y `db pull` son el **Paso 7**.
- No guardar service role keys en Git.
