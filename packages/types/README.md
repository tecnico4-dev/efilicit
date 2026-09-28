# @efilicit/types

Tipos compartidos. Los tipos de PostgreSQL se generan con:

```powershell
supabase gen types typescript --local > packages/types/src/database.types.ts
```

(cuando Supabase local y el esquema estén disponibles).

## Criteria (Semana 5)

`SearchCriteria` / `AlertCriteria` y `CRITERIA_EXAMPLE_V1` describen el JSON de
`saved_searches.criteria` y `alerts.criteria`. Espejo Python:
`efilicit_ingestion.alerts.criteria`.
