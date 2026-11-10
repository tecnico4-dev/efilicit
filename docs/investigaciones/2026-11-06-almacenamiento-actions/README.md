# Base de datos, Storage y GitHub Actions: contexto y propuestas (6-nov-2026)

Esta carpeta analiza dos problemas de EfiLicit con los planes gratuitos:
- la base de datos de Supabase casi llena y el Storage por encima del límite;
- los minutos de GitHub Actions por encima de lo que incluye un repo privado.

## Qué leer y en qué orden

1. **`PROPUESTAS-mejora-almacenamiento-y-actions.md`**. Es el documento principal. Contiene el contexto, las cifras, las causas, las propuestas priorizadas (P0–P11) con su esfuerzo y criterio de "hecho", las decisiones pendientes y el orden de trabajo.
2. `INVESTIGACION-1-base-de-datos.md`. Detalle de la base de datos y de Storage: qué ocupa cada tabla, de dónde salen los huérfanos, alternativas estudiadas y las consultas de verificación (Anexo A).
3. `INVESTIGACION-2-github-actions.md`. Detalle de Actions: consumo por workflow y por día, por qué tarda tanto, reglas actuales de GitHub, riesgos de tener el repo público y alternativas.

## Otros ficheros

- `scripts/borrar_huerfanos.py`. Lista y, opcionalmente, borra los ficheros huérfanos del bucket `raw`.
  - **Por defecto solo simula.** Para borrar hace falta `--apply`.
  - Lee `EFILICIT_DATABASE_URL`, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
  - No se ha ejecutado contra producción.
  - Uso y precauciones en la cabecera del script y en la propuesta P1.
- `datos/runs.tsv` y `datos/jobs.tsv`. Historial de GitHub Actions del 1-sep al 6-nov, sacado con la API de GitHub. No tienen cabecera:
  - `runs.tsv`: id, workflow, evento, rama, estado, conclusión, creado, inicio, actualizado, intento.
  - `jobs.tsv`: id del run, workflow, job, conclusión, inicio, fin, runner.

## Vigencia de los datos

- Las cifras de producción son del **6-nov por la tarde**.
- Desde entonces las ingestas han seguido corriendo cada día con el mismo código, y hubo dos fallos más de `placsp_menores` (7 y 8-nov). Las cifras reales serán algo mayores y habrá más huérfanos.
- **Antes de actuar, repetir las consultas del Anexo A** de `INVESTIGACION-1-base-de-datos.md`.
- Hasta el 10-nov, los cambios en el repo han sido solo de la web. El código de ingesta analizado (rama `tecnico4/mis-licitaciones`) sigue igual.
