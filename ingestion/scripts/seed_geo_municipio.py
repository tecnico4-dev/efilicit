"""Carga en bloque ``geo_municipio`` desde ``ingestion/data/geo_municipio.csv``.

Uso (desde ``ingestion/``, con Postgres local o ``EFILICIT_DATABASE_URL``)::

    python scripts/seed_geo_municipio.py

Idempotente: ``ON CONFLICT (code) DO UPDATE``.
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

from efilicit_ingestion.pipeline.postgres import connect, default_database_url

CSV_PATH = Path(__file__).resolve().parents[1] / "data" / "geo_municipio.csv"


def seed(csv_path: Path = CSV_PATH) -> int:
    if not csv_path.is_file():
        raise FileNotFoundError(f"missing catalog CSV: {csv_path}")

    rows: list[tuple[str, str, str]] = []
    with csv_path.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            code = (row.get("code") or "").strip()
            name = (row.get("name") or "").strip()
            ccaa = (row.get("ccaa_code") or "").strip()
            if code and name and ccaa:
                rows.append((code, name, ccaa))

    if not rows:
        raise RuntimeError(f"no rows in {csv_path}")

    with connect() as conn:
        with conn.cursor() as cur:
            cur.executemany(
                """
                insert into public.geo_municipio (code, name, ccaa_code)
                values (%s, %s, %s)
                on conflict (code) do update
                  set name = excluded.name,
                      ccaa_code = excluded.ccaa_code
                """,
                rows,
            )
        conn.commit()
        with conn.cursor() as cur:
            cur.execute("select count(*) from public.geo_municipio")
            count = int(cur.fetchone()[0])
    return count


def main() -> int:
    print(f"database={default_database_url()}")
    print(f"csv={CSV_PATH}")
    try:
        n = seed()
    except Exception as exc:  # noqa: BLE001
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(f"geo_municipio rows={n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
