# GitHub — EfiLicit (Fase 0 / Paso 6)

## CI

Workflow: [`.github/workflows/ci.yml`](workflows/ci.yml)

En cada push/PR a `main` ejecuta:

1. **Web lint / typecheck / build** — pnpm 10.33.0 + Node 24
2. **Ingestion CLI smoke** — Python 3.12 + uv + `cli --help`

## Protección de `main` (hacer en GitHub)

Como ahora trabajamos a menudo con push directo a `main` en el setup, la protección recomendada **en esta fase** es:

1. Repo → **Settings** → **Branches** → **Add branch protection rule**
2. Branch name pattern: `main`
3. Marca:
   - **Require status checks to pass before merging**
   - Status checks: `Web lint / typecheck / build`, `Ingestion CLI smoke`  
     (aparecen tras el primer run de CI; si aún no salen, haz un push con el workflow y vuelve)
   - **Do not allow force pushes**
   - **Do not allow deletions**
4. Deja **sin** exigir PR reviews todavía (opcional más adelante).
5. Save.

### Opción CLI (`gh`)

Requiere permisos de admin. Tras el primer CI verde:

```powershell
gh api repos/tecnico4-dev/efilicit/branches/main/protection -X PUT -H "Accept: application/vnd.github+json" --input - @"
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Web lint / typecheck / build",
      "Ingestion CLI smoke"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
"@
```

Si falla por el plan de GitHub o el formato de API, usa la UI.

## Environments / Secrets

Crear Environments (`preview`, `production`) cuando haga falta desplegar. **No** guardar secretos en el repo.

| Secret (futuro) | Dónde |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | GitHub Actions |
| `SUPABASE_PROJECT_REF` | Variable (no secreto) / docs internas |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo jobs confiables |
| Tokens Vercel | Cuando haya deploy |
| `RESEND_API_KEY` | Cuando haya alertas |

Ahora mismo el CI **no** necesita secretos.
