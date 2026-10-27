-- Semana 6 / Paso 9 — comprobar que toda tabla public tiene RLS.
-- Uso: npx supabase db query --local -f scripts/verify_rls_enabled.sql
-- Esperado: 0 filas.

select c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not c.relrowsecurity
order by 1;
