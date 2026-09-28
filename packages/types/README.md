# @efilicit/types

Tipos compartidos. Los tipos de PostgreSQL se generan con:

```powershell
# En PowerShell, `>` escribe UTF-16 y rompe tsc. Preferir:
supabase gen types typescript --local 1> $env:TEMP\efilicit-db-types.ts
$text = [System.IO.File]::ReadAllText("$env:TEMP\efilicit-db-types.ts")
[System.IO.File]::WriteAllText(
  "$PWD\packages\types\src\database.types.ts",
  $text,
  [System.Text.UTF8Encoding]::new($false)
)
```

(cuando Supabase local y el esquema estén disponibles).

## Criteria (Semana 5)

`SearchCriteria` / `AlertCriteria` y `CRITERIA_EXAMPLE_V1` describen el JSON de
`saved_searches.criteria` y `alerts.criteria`. Espejo Python:
`efilicit_ingestion.alerts.criteria`.
