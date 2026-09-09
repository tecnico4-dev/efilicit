# Fase 0 — checklist de cierre (docs/02-setup-entorno §14)

Estado tras Pasos 0–9 (Paso 7 remoto hecho; protection `main` aplazada a propósito).

| Ítem | Estado | Notas |
|---|---|---|
| Git | OK | |
| Docker | OK | Arrancar Desktop antes de `supabase start` |
| Node 24.x / pnpm 10.x | OK | Fijados en `package.json` |
| Python 3.12.x + uv | OK | |
| Supabase CLI | OK | |
| `supabase status` local | OK | |
| Studio local | OK | http://127.0.0.1:54323 |
| Remoto vinculado | OK | `luvxqyajujlznocflymo` |
| Migración / historial | OK | Local = remoto (`20260909090000`); remoto vacío al inicio → `db push` |
| PG major 17 local = remoto | OK | |
| `supabase db reset` local | OK | |
| `seed.sql` | OK | Alice/Bob sintéticos |
| Storage `raw` + políticas | OK | Sin grants de escritura a anon/authenticated |
| Auth / RLS smoke | OK | Tabla `setup_rls_smoke` |
| `supabase gen types --local` | OK | `packages/types/src/database.types.ts` |
| `pnpm dev` + consulta local | OK | `apps/web` + `.env.local` (no versionado) |
| CLI ingestion `--help` | OK | |
| Secretos fuera de Git | OK | `.env.local` gitignored |
| Branch protection `main` | N/A por ahora | Decisión en `.github/README.md` |

Cuando este checklist se cumpla, Semana 0 de setup está lista para empezar **Semana 1** (modelo canónico + infraestructura de ingesta).
