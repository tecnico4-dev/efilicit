# Investigación 2: minutos de GitHub Actions y repo público

Fecha: 6 de noviembre de 2026. Repo `tecnico4-dev/efilicit`: hoy es **público** y está en la cuenta personal de Deiane (plan Free).
Datos: las 150 ejecuciones y 187 jobs desde el 1 de septiembre, sacados con la API de GitHub (`datos/runs.tsv`, `datos/jobs.tsv`). Minutos facturables = cada job redondeado al minuto, como cuenta GitHub.

---

## Resumen

1. **Consumo real:**
   - Octubre: **2.805 min**.
   - 1–6 de noviembre: **1.422 min**. Desde el 2-nov se van **270–365 min al día**.
   - A ese ritmo salen **~8.000–11.000 min/mes**, cuatro o cinco veces los 2.000 min que GitHub Free incluye para un repo privado.
2. **Casi la mitad se ha tirado:** desde octubre hay **1.970 min (47 %) en ejecuciones canceladas** (varias cortadas a las 6 h) y 305 min en fallidas.
3. **La causa es la lentitud del código, no el volumen de datos.** PLACSP tarda **~1,7 s por licitación** porque:
   - lo hace todo fila a fila (~15 consultas SQL + 1 subida HTTP por entrada);
   - el runner de GitHub (EE. UU.) habla con una base de datos que está en **Irlanda (eu-west-1, comprobado por la IP)**.

   Con escrituras por lotes y RAW por página, cada sindicación debería bajar de 60–170 min a unos pocos minutos.
4. **Mientras el repo sea público, Actions no cuesta nada.** Pero se ven el código, los logs de todas las ejecuciones (90 días), el esquema y el *project ref* de Supabase.
5. **Sí se puede volver a privado a 0 €**, pero **solo después de optimizar**. Si se pone privado hoy, con el ritmo actual los 2.000 min se acaban en ~6 días. Sin tarjeta, GitHub **bloquea** las ejecuciones hasta el mes siguiente y la ingesta se para.

---

## 1. Consumo medido

### 1.1 Por workflow (desde el 1-sep)

| Workflow | Jobs | Min. facturados | Job más largo |
|---|---|---|---|
| Ingest PLACSP | 45 | **3.412** | 361 min (cancelado a las 6 h) |
| Ingest Catalunya | 15 | **704** | 208 min |
| CI | 76 | 76 | 1 min |
| Ingest Euskadi | 20 | 51 | 16 min |
| Alerts digest | 19 | 23 | 2 min |
| Alerts match | 12 | 16 | 3 min |

### 1.2 Por mes y por día

- Septiembre: 55 min. Octubre: 2.805 min. Noviembre (6 días): 1.422 min.
- Desde el 2-nov, por día: 276 · 187 · 364 · 325 · 270 min.
- **Cuánto tarda cada sindicación ahora (rama `mis-licitaciones`):**

| Ejecución (6-nov) | Licitaciones | Duración | s/licitación |
|---|---|---|---|
| placsp (perfiles) | 3.113 | 88 min | 1,7 |
| placsp_menores | 1.980 | 89 min | 2,7 |
| placsp_agregadas | 1.249 | 61 min | 2,9 |
| euskadi | 500 | 16 min | 1,9 |

### 1.3 Otras cosas que se ven en el historial

- **Las ejecuciones programadas corren desde ramas de trabajo, no desde `main`.** Desde octubre: 1.874 min en `semana-06`, 929 en `mis-licitaciones` y 1.424 en `main`. Hoy mismo, *Alerts match* va desde `semana-06` y el resto desde `mis-licitaciones`. Lo que está en producción depende de la rama que cada uno tenga configurada en cron-job.org.
- **Catalunya** tardaba 135–208 min al día (2 a 5-nov) para procesar 10.000 filas de las que solo 25 eran nuevas: re-escribía filas que no habían cambiado. En `mis-licitaciones` ya se saltan por checksum y el 6-nov tardó 2 min. Ese problema está resuelto.

---

## 2. Por qué tarda tanto (y por qué tiene arreglo)

- Por cada entrada nueva, `placsp_incremental.py`:
  1. consulta `source_artifacts` por checksum;
  2. sube un fichero a Storage (HTTP);
  3. inserta en `source_artifacts`;
  4. hace el *upsert* canónico fila a fila (~14 SQL por licitación, medido en local el 29-oct).
- La base de datos está en Irlanda y los runners de GitHub suelen estar en EE. UU. Cada viaje de ida y vuelta cuesta ~80–100 ms (*estimación de la ubicación del runner, no documentada por GitHub*). Con ~16 viajes por licitación salen ~1,5 s, que encaja con los **1,7–2,9 s medidos**.
- Además, cada día se descarga el ZIP del mes entero (100–300 MB) y se recalcula el hash de todas sus entradas, aunque solo se procesen las nuevas.

**Arreglo** (detallado en `PROPUESTAS-mejora-almacenamiento-y-actions.md`, P2–P4):
- RAW por página `.atom` en gzip, saltando las páginas cuyo sha256 ya se conoce.
- Commit por página, así una cancelación no tira todo el trabajo.
- Escrituras **por lotes** (`executemany` o `COPY` a una tabla temporal + `INSERT … ON CONFLICT`): pocas consultas por página en lugar de ~15 por licitación.
- Opcional: leer el **feed vivo** de PLACSP (pocas páginas de 4–15 MB al día) en lugar del ZIP mensual, y reconciliar con el ZIP una vez al mes.

**Objetivo:** <10 min por sindicación y día → **~300–600 min/mes** en total. Es una estimación y se comprueba midiendo cuando esté hecho.

---

## 3. Reglas actuales de GitHub (revisadas hoy)

- **Desde 2026, lo incluido se cuenta en dólares:** Free (personal) y Free para organizaciones = **12 $/mes**, es decir **2.000 min** de Linux a 0,006 $/min. Pro y Team = 18 $ (3.000 min). Team cuesta 4 $/usuario/mes. https://docs.github.com/en/billing/concepts/product-billing/github-actions
- **Los repos públicos siguen siendo gratis e ilimitados** con runners estándar.
- **Al agotar lo incluido:** sin método de pago, o con presupuesto en "parar", **las ejecuciones se bloquean** hasta el siguiente ciclo. No se cobra nada, pero la ingesta se para. https://docs.github.com/en/billing/how-tos/set-up-budgets
- **Runners propios (*self-hosted*):** hoy son **gratis y no gastan minutos**. GitHub anunció un cargo de 0,002 $/min para repos privados desde el 1-mar-2026, pero lo **aplazó sin fecha** (dic-2025). Es un riesgo que puede volver: 10.000 min serían ~20 $/mes. https://github.blog/changelog/2025-12-16-coming-soon-simpler-pricing-and-a-better-experience-for-github-actions/
- **Límite por job:** 6 h en los runners de GitHub, 5 días en un runner propio.
- **Coste si se pusiera privado sin optimizar:** ~6.000–9.000 min de exceso ≈ **36–54 $/mes**.

---

## 4. Riesgos de seguir con el repo público

| Riesgo | Situación real |
|---|---|
| Secretos en el historial | **Revisado: no hay.** Se buscaron JWT, `sb_secret_`, claves de Resend y URLs de Postgres en los 388 commits de todas las ramas. Solo aparece la URL local por defecto (`postgres:postgres@127.0.0.1`) y el *project ref* (`luvxqyajujlznocflymo.supabase.co`), que no es secreto: la clave anónima ya va en el navegador. |
| Logs de Actions | **Públicos durante 90 días** para cualquiera con cuenta de GitHub. Los secretos salen enmascarados, pero se ven rutas RAW, recuentos, errores y la URL de la app (`EFILICIT_APP_URL`). |
| Seguridad | Hay pendientes de seguridad conocidos que se tratan aparte, fuera de este repo público. Revisarlos antes de dar el repo público por bueno. |
| Código y esquema | Se ven la lógica de negocio, las RLS y las RPC. No es un agujero por sí solo, pero facilita buscar fallos. |
| PRs desde forks | Los secretos no llegan a workflows lanzados desde forks, y no hay `pull_request_target`. Riesgo bajo. |
| Propiedad | El repo está en la **cuenta personal de Deiane**. Es independiente de si es público o privado, pero conviene resolverlo a la vez. |

**Conclusión:** mantenerlo público **unas semanas, mientras se optimiza**, es un riesgo asumible si antes se revisan los pendientes de seguridad que se tratan aparte. **Como solución permanente no se recomienda.**

---

## 5. Alternativas estudiadas

| # | Alternativa | Coste | ¿Cubre el consumo? | Pegas |
|---|---|---|---|---|
| A | **Optimizar (§2) y volver a privado en GitHub Free** | 0 € | Sí, si queda por debajo de ~2.000 min (objetivo 300–600) | 2–4 días de desarrollo. Hay que fijar presupuesto 0 $ y vigilar el contador. |
| B | **Runner propio en un PC de la oficina siempre encendido** (Windows con WSL o Linux) | 0 € hoy | Sí, sin límite de minutos | El PC tiene que estar encendido y mantenido. Usa ancho de banda de la oficina (descarga del ZIP). **Solo con repo privado.** Expuesto al cargo aplazado de 0,002 $/min. Ventaja: desde España la latencia a Irlanda es menor, así que el código actual ya iría más rápido. |
| C | **VM Oracle Cloud Always Free** (ARM, 2 OCPU / 12 GB) como runner o con cron propio | 0 € | Sí | **Pide tarjeta.** Oracle ya redujo este límite a la mitad en 2026. Recupera las VM ociosas (uso <20 % durante 7 días). A menudo no hay capacidad libre. |
| D | **Google Cloud Run Jobs** | 0 € dentro de lo gratuito (~2.000–4.000 min/mes) | Solo si se optimiza | Pide tarjeta. Hay que montar un contenedor. La salida de datos hacia Supabase puede cobrarse. |
| E | Otras plataformas: GitLab (400 min y 3 h máx.), Bitbucket (50 min), Codeberg (2–10 min por job), Render, Railway, Fly.io (sin tramo gratis para cron), Cloudflare Workers (15 min), Supabase Edge Functions (150 s) | — | **No** | Demasiado pequeño, temporal o de pago. |
| F | **Mover el repo a una organización de Eficen** (Free) | 0 € | Igual que A (2.000 min) | No da más minutos, pero el repo pasa a ser de la empresa. Recomendado igualmente. |
| G | **Seguir público** | 0 € | Sí | Ver §4. |
| H | **Pagar exceso** (0,006 $/min), Pro personal (3.000 min) o Team | ~36–54 $/mes sin optimizar; 0 € si se optimiza | Sí | Solo tiene sentido si A no funciona. |

---

## 6. Recomendación (por orden)

**Hoy (sin código, 30 min):**
1. **No poner el repo en privado todavía:** se bloquearía la ingesta en menos de una semana.
2. Revisar los pendientes de seguridad que se tratan aparte.
3. En cron-job.org, **que todos los disparos usen `ref=main`** (hoy van a `semana-06` y `mis-licitaciones`). Para ello hay que mergear a `main` lo que esté en producción.
4. Pausar `placsp_menores` y `placsp_agregadas` hasta tener el arreglo (es lo mismo que el paso 0 de la Investigación 1).

**Siguiente sprint (2–4 días, 0 €), una sola PR que resuelve los dos problemas:**
- RAW por página gzip + commit por página + escrituras por lotes (§2), con un ADR que sustituya al 022.
- **Medir** minutos por sindicación antes y después, y apuntarlo en la PR.

**Después:**
- Si el total baja de ~1.500 min/mes: **pasar el repo a una organización de Eficen, privado (A + F)**, con presupuesto de Actions a 0 $.
- Si no baja lo suficiente: **runner propio en un PC de la oficina (B)**. Es gratis, sin límite de minutos y más cerca de la base de datos. Oracle (C) solo si no hay un PC que pueda estar siempre encendido.

## 7. ¿Se puede sin costes?

**Sí.**
- Con el código actual, solo de dos formas: dejando el repo público, o con un runner propio (PC de la oficina u Oracle con tarjeta).
- Con el código optimizado, también en privado con GitHub Free normal.
- **Con el código actual y repo privado en GitHub, no:** costaría ~36–54 $/mes o la ingesta se pararía a los ~6 días de cada mes.
