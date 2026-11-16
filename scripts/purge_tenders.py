# /// script
# requires-python = ">=3.11"
# dependencies = ["psycopg[binary]>=3.1", "httpx>=0.27"]
# ///
"""Purge de licitaciones canónicas con escudos de retención (ADR 031).

Por defecto solo simula (dry-run). Con ``--apply`` borra tenders no protegidos,
limpia artifacts/RAW huérfanos de ese lote y poda ``notification_emails``.

Escudos (skip total): offer_cases, favorites, shared_favorites, tender_ratings,
alerta viva (notification_queue sin dismiss permanente de papelera 30d),
abierta/en plazo (deadline NULL o > now()).

Include: deadline_at <= now() - N months; opcional source_code; opcional limit.

Variables:
  EFILICIT_DATABASE_URL      Postgres (pooler)
  SUPABASE_URL               solo con --apply si hay RAW que borrar
  SUPABASE_SERVICE_ROLE_KEY  solo con --apply si hay RAW que borrar

Uso:
  uv run --script scripts/purge_tenders.py
  uv run --script scripts/purge_tenders.py --apply --min-deadline-age-months 3
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import os
import sys
import time
from collections import Counter
from typing import Any
from uuid import UUID

import httpx
import psycopg
from psycopg.rows import dict_row

BUCKET = "raw"
TRASH_DAYS = 30

CANDIDATES_SQL = """
with base as (
  select t.id, t.title, t.status, t.deadline_at
  from public.tenders t
  where t.deadline_at is not null
    and t.deadline_at <= (now() - make_interval(months => %(months)s))
    and (
      %(source)s::text is null
      or exists (
        select 1
        from public.tender_sources ts
        where ts.tender_id = t.id
          and ts.source_code = %(source)s
      )
    )
),
shielded as (
  select
    b.id,
    b.title,
    b.status,
    b.deadline_at,
    case
      when exists (
        select 1 from public.offer_cases oc where oc.tender_id = b.id
      ) then 'offer'
      when exists (
        select 1 from public.favorites f where f.tender_id = b.id
      ) then 'favorite'
      when exists (
        select 1 from public.shared_favorites sf where sf.tender_id = b.id
      ) then 'shared_favorite'
      when exists (
        select 1 from public.tender_ratings r where r.tender_id = b.id
      ) then 'rating'
      when exists (
        select 1
        from public.notification_queue nq
        left join public.alert_related_trash art
          on art.queue_id = nq.id and art.user_id = nq.user_id
        where nq.tender_id = b.id
          and (
            art.queue_id is null
            or art.trashed_at > (now() - make_interval(days => %(trash_days)s))
          )
      ) then 'alert_related'
      when b.deadline_at is null or b.deadline_at > now() then 'open_deadline'
      else null
    end as shield
  from base b
)
select id, title, status, deadline_at, shield
from shielded
order by deadline_at asc nulls last, id
"""

ARTIFACTS_SQL = """
select distinct a.id, a.storage_path
from public.source_artifacts a
where a.id in (
  select ts.artifact_id
  from public.tender_sources ts
  where ts.tender_id = any(%(ids)s::uuid[])
    and ts.artifact_id is not null
  union
  select d.artifact_id
  from public.documents d
  where d.tender_id = any(%(ids)s::uuid[])
    and d.artifact_id is not null
)
"""

ARTIFACT_STILL_USED_SQL = """
select a.id
from unnest(%(ids)s::uuid[]) as x(id)
join public.source_artifacts a on a.id = x.id
where exists (
  select 1 from public.tender_sources ts where ts.artifact_id = a.id
)
or exists (
  select 1 from public.documents d where d.artifact_id = a.id
)
"""

EMAILS_TOUCHING_SQL = """
select id, tender_ids, tender_count
from public.notification_emails
where tender_ids && %(ids)s::uuid[]
"""


def fmt_mb(n: int) -> str:
    return f"{n / 1_048_576:,.1f} MB"


def storage_object_name(storage_path: str | None) -> str | None:
    if not storage_path:
        return None
    p = storage_path.lstrip("/")
    if p.startswith(f"{BUCKET}/"):
        return p[len(BUCKET) + 1 :]
    return p


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument(
        "--apply",
        action="store_true",
        help="borrar de verdad (por defecto: simulación)",
    )
    ap.add_argument(
        "--min-deadline-age-months",
        type=int,
        default=3,
        help="candidatas con deadline vencido hace al menos N meses (default 3)",
    )
    ap.add_argument(
        "--source-code",
        default="",
        help="filtrar por tender_sources.source_code (vacío = todas)",
    )
    ap.add_argument(
        "--limit",
        type=int,
        default=0,
        help="borrar como mucho N licitaciones tras escudos (0 = todas)",
    )
    ap.add_argument(
        "--batch",
        type=int,
        default=500,
        help="tamaño de lote DELETE tenders / Storage",
    )
    ap.add_argument(
        "--csv",
        default=f"purge_tenders_{dt.datetime.now():%Y%m%d_%H%M%S}.csv",
    )
    args = ap.parse_args()
    months = max(0, args.min_deadline_age_months)
    batch = max(1, min(args.batch, 1000))
    source = args.source_code.strip() or None

    db_url = os.environ.get("EFILICIT_DATABASE_URL")
    if not db_url:
        print("Falta EFILICIT_DATABASE_URL", file=sys.stderr)
        return 2

    deleted_tenders = 0
    storage_names: list[str] = []

    with psycopg.connect(db_url, autocommit=False, row_factory=dict_row) as conn:
        rows: list[dict[str, Any]] = conn.execute(
            CANDIDATES_SQL,
            {"months": months, "source": source, "trash_days": TRASH_DAYS},
        ).fetchall()

        shield_counts: Counter[str] = Counter()
        protected: list[dict[str, Any]] = []
        deletable: list[dict[str, Any]] = []
        for r in rows:
            if r["shield"]:
                shield_counts[str(r["shield"])] += 1
                protected.append(r)
            else:
                deletable.append(r)

        if args.limit and args.limit > 0:
            deletable = deletable[: args.limit]

        print(
            f"Candidatas (deadline ≤ now()-{months}m"
            + (f", source={source}" if source else ", todas las fuentes")
            + f"): {len(rows):,}"
        )
        print(f"  Protegidas (escudo): {len(protected):,}")
        for k, n in sorted(shield_counts.items()):
            print(f"    {k:18} {n:>8,}")
        print(f"  Borrables:           {len(deletable):,}")
        if args.limit:
            print(f"  (limit={args.limit})")

        with open(args.csv, "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(
                [
                    "tender_id",
                    "deadline_at",
                    "status",
                    "title",
                    "shield",
                    "action",
                ]
            )
            for r in protected:
                w.writerow(
                    [
                        r["id"],
                        r["deadline_at"].isoformat() if r["deadline_at"] else "",
                        r["status"] or "",
                        (r["title"] or "")[:200],
                        r["shield"],
                        "skip",
                    ]
                )
            for r in deletable:
                w.writerow(
                    [
                        r["id"],
                        r["deadline_at"].isoformat() if r["deadline_at"] else "",
                        r["status"] or "",
                        (r["title"] or "")[:200],
                        "",
                        "dry-run" if not args.apply else "delete",
                    ]
                )

        if not args.apply:
            print(f"\nSimulación: no se ha borrado nada. Lista en {args.csv}")
            conn.rollback()
            return 0

        if not deletable:
            print("\nNada que borrar.")
            conn.rollback()
            return 0

        ids = [r["id"] for r in deletable]
        artifacts = conn.execute(ARTIFACTS_SQL, {"ids": ids}).fetchall()
        artifact_meta = {
            a["id"]: storage_object_name(a["storage_path"]) for a in artifacts
        }

        for i in range(0, len(ids), batch):
            chunk = ids[i : i + batch]
            cur = conn.execute(
                "delete from public.tenders where id = any(%(ids)s::uuid[])",
                {"ids": chunk},
            )
            deleted_tenders += cur.rowcount
            conn.commit()
            print(
                f"  tenders lote {i // batch + 1}: "
                f"{cur.rowcount:,} (acumulado {deleted_tenders:,})"
            )

        art_ids = list(artifact_meta.keys())
        still_used: set[UUID] = set()
        if art_ids:
            still_used = {
                row["id"]
                for row in conn.execute(
                    ARTIFACT_STILL_USED_SQL, {"ids": art_ids}
                ).fetchall()
            }
        orphan_arts = [aid for aid in art_ids if aid not in still_used]
        storage_names = [
            name
            for aid in orphan_arts
            if (name := artifact_meta.get(aid))
        ]

        if orphan_arts:
            for i in range(0, len(orphan_arts), batch):
                chunk = orphan_arts[i : i + batch]
                conn.execute(
                    "delete from public.source_artifacts "
                    "where id = any(%(ids)s::uuid[])",
                    {"ids": chunk},
                )
                conn.commit()
            print(f"  source_artifacts borrados: {len(orphan_arts):,}")

        emails = conn.execute(EMAILS_TOUCHING_SQL, {"ids": ids}).fetchall()
        deleted_ids = set(ids)
        updated_emails = 0
        removed_emails = 0
        for em in emails:
            old: list[UUID] = list(em["tender_ids"] or [])
            new = [tid for tid in old if tid not in deleted_ids]
            if len(new) == len(old):
                continue
            if not new:
                conn.execute(
                    "delete from public.notification_emails where id = %(id)s",
                    {"id": em["id"]},
                )
                removed_emails += 1
            else:
                conn.execute(
                    "update public.notification_emails "
                    "set tender_ids = %(ids)s::uuid[], tender_count = %(n)s "
                    "where id = %(id)s",
                    {"ids": new, "n": len(new), "id": em["id"]},
                )
                updated_emails += 1
        conn.commit()
        print(
            f"  notification_emails: {updated_emails:,} actualizados, "
            f"{removed_emails:,} eliminados (lista vacía)"
        )

        cur = conn.execute(
            """
            delete from public.contracting_authorities ca
            where not exists (
              select 1 from public.tenders t
              where t.contracting_authority_id = ca.id
            )
            """
        )
        conn.commit()
        if cur.rowcount:
            print(f"  contracting_authorities huérfanos: {cur.rowcount:,}")

    # Storage fuera de la transacción Postgres (como huérfanos)
    if args.apply and storage_names:
        base = os.environ.get("SUPABASE_URL", "").rstrip("/")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not base or not key:
            print(
                "Aviso: faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY; "
                f"BD limpia pero quedan {len(storage_names):,} objetos RAW. "
                "Usa cleanup-orphans o re-ejecuta con secrets.",
                file=sys.stderr,
            )
            print(f"\nBorrados {deleted_tenders:,} tenders. Detalle en {args.csv}")
            return 0

        headers = {"Authorization": f"Bearer {key}", "apikey": key}
        deleted_files = 0
        with httpx.Client(timeout=120, headers=headers) as client:
            for i in range(0, len(storage_names), 1000):
                chunk = storage_names[i : i + 1000]
                for attempt in range(3):
                    resp = client.request(
                        "DELETE",
                        f"{base}/storage/v1/object/{BUCKET}",
                        json={"prefixes": chunk},
                    )
                    if resp.status_code < 500:
                        break
                    time.sleep(2 * (attempt + 1))
                if resp.status_code >= 300:
                    print(
                        f"Error Storage {resp.status_code}: {resp.text[:300]}",
                        file=sys.stderr,
                    )
                    return 1
                ok = {
                    o.get("name")
                    for o in resp.json()
                    if isinstance(o, dict)
                }
                deleted_files += len(ok)
                print(
                    f"  storage lote {i // 1000 + 1}: "
                    f"{len(ok):,} (acumulado {deleted_files:,})"
                )
        print(f"  objetos RAW borrados: {deleted_files:,}")

    print(f"\nBorrados {deleted_tenders:,} tenders. Detalle en {args.csv}")
    print("Siguiente: VACUUM opcional; revisar Database size / Storage.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
