# Cron externo → `workflow_dispatch` (ADR 020)

GitHub Actions **ejecuta** ingestas y alertas; el **despertador** es un cron
fuera de GitHub (p. ej. [cron-job.org](https://cron-job.org)) que llama a la
API `workflow_dispatch`. No uses `on.schedule` en estos workflows (evita dobles
corridas y la cola best-effort de GitHub).

## 1. Personal Access Token (PAT)

1. GitHub → Settings → Developer settings → Personal access tokens.
2. Fine-grained (recomendado) o classic:
   - Repo: `tecnico4-dev/efilicit`
   - Permissions: **Actions: Read and write**, **Contents: Read**
3. Copia el token. **No** lo subas al repo ni a Issues.

En cron-job.org (u otro servicio) guárdalo como secreto del job / header.

## 2. Plantilla HTTP

```http
POST https://api.github.com/repos/tecnico4-dev/efilicit/actions/workflows/<FILE>/dispatches
Accept: application/vnd.github+json
Authorization: Bearer <PAT>
X-GitHub-Api-Version: 2022-11-28
Content-Type: application/json

{"ref":"main","inputs":{ ... }}
```

Respuesta esperada: **204 No Content**. Luego aparece un run en Actions
(evento `workflow_dispatch`).

Prueba local (Git Bash / WSL / macOS/Linux):

```bash
export GITHUB_TOKEN=ghp_...   # o fine-grained
./scripts/dispatch-workflow.sh ingest-catalunya.yml
```

## 3. Prueba madrugada jueves 2026-10-29 (Madrid = UTC+1)

Crear **7 jobs** (PLACSP son tres sindicaciones; un dispatch = una).

| # | Hora Madrid | UTC | Workflow file | Body `inputs` (además de `"ref":"main"`) |
|---|---|---|---|---|
| 1 | 03:00 | 02:00 | `ingest-placsp.yml` | `syndication=placsp`, `mode=live`, `upload_storage=true` |
| 2 | 03:00 | 02:00 | `ingest-placsp.yml` | `syndication=placsp_agregadas`, `mode=live`, `upload_storage=true` |
| 3 | 03:00 | 02:00 | `ingest-placsp.yml` | `syndication=placsp_menores`, `mode=live`, `upload_storage=true` |
| 4 | 05:00 | 04:00 | `ingest-catalunya.yml` | `mode=live`, `max_pages=10`, `page_size=1000`, `upload_storage=true` |
| 5 | 06:00 | 05:00 | `ingest-euskadi.yml` | `mode=live`, `max_pages=10`, `upload_storage=true` |
| 6 | 07:00 | 06:00 | `alerts-match.yml` | `mode=write` |
| 7 | 07:30 | 06:30 | `alerts-digest.yml` | `mode=write-resend` |

Booleanos en JSON de la API: usar string `"true"` / `"false"` (GitHub los
normaliza en `workflow_dispatch`).

### Ejemplos de body

PLACSP perfiles:

```json
{
  "ref": "main",
  "inputs": {
    "syndication": "placsp",
    "mode": "live",
    "upload_storage": "true"
  }
}
```

Catalunya:

```json
{
  "ref": "main",
  "inputs": {
    "mode": "live",
    "max_pages": "10",
    "page_size": "1000",
    "upload_storage": "true"
  }
}
```

Euskadi:

```json
{
  "ref": "main",
  "inputs": {
    "mode": "live",
    "max_pages": "10",
    "upload_storage": "true"
  }
}
```

Alerts match:

```json
{
  "ref": "main",
  "inputs": {
    "mode": "write"
  }
}
```

Alerts digest:

```json
{
  "ref": "main",
  "inputs": {
    "mode": "write-resend"
  }
}
```

### cron-job.org (resumen)

1. Create cronjob → URL =  
   `https://api.github.com/repos/tecnico4-dev/efilicit/actions/workflows/ingest-placsp.yml/dispatches`
2. Method **POST**, schedule en zona **Europe/Madrid** (o UTC con la tabla).
3. Headers: `Authorization: Bearer …`, `Accept: application/vnd.github+json`,
   `Content-Type: application/json`, opcional `X-GitHub-Api-Version: 2022-11-28`.
4. Body = JSON de arriba.
5. Repetir para los 7 jobs.

## 4. Cadencia estable (después de la prueba)

Ajustar los mismos 7 jobs a [ADR 020](../adr/020-alertas-match-post-ingesta-y-digest-diario.md):

| Workflow | UTC estable |
|---|---|
| PLACSP ×3 | lun 05:00 |
| Catalunya | lun 06:00 |
| Euskadi | lun 07:00 |
| Alerts match | lun 08:00 |
| Alerts digest | diario 09:00 |

## 5. Verificación

- Actions → run reciente → evento **`workflow_dispatch`** (no `schedule`).
- Secrets del repo (`EFILICIT_DATABASE_URL` session pooler, Resend, etc.) sin cambio.
- Si un job externo falla con 401/403 → PAT o permisos.
- Si 404 workflow → nombre de fichero o rama `main` desactualizada.
