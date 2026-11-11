# /// script
# requires-python = ">=3.11"
# dependencies = ["psycopg[binary]>=3.1", "httpx>=0.27"]
# ///
"""Lista y (opcionalmente) borra los ficheros huérfanos del bucket ``raw``.

Huérfano = objeto de ``storage.objects`` (bucket ``raw``) sin ninguna fila en
``public.source_artifacts`` con ``storage_path = 'raw/' || name``. Nadie los usa:
la web no lee el bucket ``raw`` y ``documents``/``tender_sources`` apuntan a
``source_artifacts``, no a Storage.

Seguridad:
- Por defecto es **simulación** (no borra nada). Solo borra con ``--apply``.
- Ignora los objetos creados en las últimas ``--min-age-hours`` (24 por defecto):
  una ingesta en curso sube ficheros cuya fila de ``source_artifacts`` aún no
  está confirmada y parecerían huérfanos. **No lo ejecutes mientras corre una
  ingesta.**
- Antes de borrar cada lote vuelve a comprobar en la BD que siguen sin fila.
- Borra por la API de Storage (``DELETE /storage/v1/object/raw``, 1000 por
  llamada). Supabase no permite borrar ficheros con DELETE sobre storage.objects.
- Escribe un CSV con todo lo listado/borrado.

Variables de entorno (las mismas que usa la ingesta):
  EFILICIT_DATABASE_URL      conexión Postgres (pooler) del proyecto
  SUPABASE_URL               https://<ref>.supabase.co   (solo con --apply)
  SUPABASE_SERVICE_ROLE_KEY  clave service_role          (solo con --apply)

Uso:
  uv run borrar_huerfanos.py                 # simulación: resumen + CSV
  uv run borrar_huerfanos.py --apply         # borra de verdad
  (sin uv: pip install "psycopg[binary]" httpx  y  python borrar_huerfanos.py)
"""

from __future__ import annotations

import argparse
import collections
import csv
import datetime as dt
import os
import sys
import time

import httpx
import psycopg

BUCKET = "raw"

LIST_SQL = """
select o.name, (o.metadata->>'size')::bigint as size, o.created_at
from storage.objects o
left join public.source_artifacts a on a.storage_path = %(prefix)s || o.name
where o.bucket_id = %(bucket)s
  and a.id is null
  and o.created_at < now() - make_interval(hours => %(min_age)s)
order by o.name
"""

RECHECK_SQL = """
select o.name
from unnest(%(names)s::text[]) as o(name)
left join public.source_artifacts a on a.storage_path = %(prefix)s || o.name
where a.id is null
"""


def fmt_mb(n: int) -> str:
    return f"{n / 1_048_576:,.1f} MB"


def group_key(name: str) -> str:
    # placsp_menores/2026/11/04/entries/<sha>.atom.xml -> placsp_menores/2026/11/04
    parts = name.split("/")
    return "/".join(parts[:4]) if len(parts) >= 4 else parts[0]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true", help="borrar de verdad (por defecto: simulación)")
    ap.add_argument("--min-age-hours", type=int, default=24)
    ap.add_argument("--batch", type=int, default=1000, help="objetos por llamada (máx. 1000)")
    ap.add_argument("--limit", type=int, default=0, help="borrar como mucho N (0 = todos)")
    ap.add_argument("--csv", default=f"huerfanos_{dt.datetime.now():%Y%m%d_%H%M%S}.csv")
    args = ap.parse_args()
    batch = max(1, min(args.batch, 1000))

    db_url = os.environ.get("EFILICIT_DATABASE_URL")
    if not db_url:
        print("Falta EFILICIT_DATABASE_URL", file=sys.stderr)
        return 2

    prefix = f"{BUCKET}/"
    with psycopg.connect(db_url, autocommit=True) as conn:
        rows = conn.execute(
            LIST_SQL, {"prefix": prefix, "bucket": BUCKET, "min_age": args.min_age_hours}
        ).fetchall()

        total = sum(r[1] or 0 for r in rows)
        print(f"Huérfanos (> {args.min_age_hours} h): {len(rows):,} ficheros, {fmt_mb(total)}")
        groups: dict[str, list[int]] = collections.defaultdict(lambda: [0, 0])
        for name, size, _ in rows:
            g = groups[group_key(name)]
            g[0] += 1
            g[1] += size or 0
        print("\nPor fuente/día:")
        for k in sorted(groups):
            print(f"  {k:40} {groups[k][0]:>8,}  {fmt_mb(groups[k][1]):>12}")

        with open(args.csv, "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["name", "size", "created_at", "deleted"])
            if not args.apply:
                for name, size, created in rows:
                    w.writerow([name, size, created.isoformat(), "dry-run"])
                print(f"\nSimulación: no se ha borrado nada. Lista en {args.csv}")
                return 0

            base = os.environ.get("SUPABASE_URL", "").rstrip("/")
            key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            if not base or not key:
                print("Con --apply hacen falta SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
                return 2

            names = [r[0] for r in rows]
            sizes = {r[0]: r[1] for r in rows}
            created_at = {r[0]: r[2] for r in rows}
            if args.limit:
                names = names[: args.limit]

            deleted = 0
            freed = 0
            headers = {"Authorization": f"Bearer {key}", "apikey": key}
            with httpx.Client(timeout=120, headers=headers) as client:
                for i in range(0, len(names), batch):
                    chunk = names[i : i + batch]
                    still = [
                        r[0]
                        for r in conn.execute(RECHECK_SQL, {"names": chunk, "prefix": prefix}).fetchall()
                    ]
                    skipped = set(chunk) - set(still)
                    for n in skipped:
                        w.writerow([n, sizes[n], created_at[n].isoformat(), "skipped-now-referenced"])
                    if not still:
                        continue
                    for attempt in range(3):
                        resp = client.request(
                            "DELETE",
                            f"{base}/storage/v1/object/{BUCKET}",
                            json={"prefixes": still},
                        )
                        if resp.status_code < 500:
                            break
                        time.sleep(2 * (attempt + 1))
                    if resp.status_code >= 300:
                        print(f"\nError {resp.status_code} en lote {i // batch}: {resp.text[:300]}", file=sys.stderr)
                        return 1
                    ok = {o.get("name") for o in resp.json() if isinstance(o, dict)}
                    for n in still:
                        w.writerow([n, sizes[n], created_at[n].isoformat(), "yes" if n in ok else "not-returned"])
                    deleted += len(ok)
                    freed += sum(sizes[n] or 0 for n in ok)
                    fh.flush()
                    print(f"  lote {i // batch + 1}: {len(ok):,} borrados (acumulado {deleted:,}, {fmt_mb(freed)})")

            print(f"\nBorrados {deleted:,} ficheros, {fmt_mb(freed)}. Detalle en {args.csv}")
            print("Siguiente paso: VACUUM (ANALYZE) storage.objects; y revisar 'Database size' mañana.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
