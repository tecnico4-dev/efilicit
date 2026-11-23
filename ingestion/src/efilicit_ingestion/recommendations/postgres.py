"""Carga de semillas/candidatas y escritura de recomendaciones (Postgres)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from efilicit_ingestion.recommendations.models import (
    CandidateTender,
    ProfileKind,
    Recommendation,
)
from efilicit_ingestion.recommendations.seeds import (
    FavoriteRow,
    OfferCaseRow,
    RatingRow,
)

PROFILES: tuple[ProfileKind, ...] = ("propia", "subcontrata")


def _as_decimal(raw: Any) -> Decimal | None:
    if raw is None:
        return None
    try:
        return Decimal(str(raw))
    except Exception:
        return None


def _cpvs_for_tenders(cur: Any, tender_ids: list[str]) -> dict[str, tuple[str, ...]]:
    if not tender_ids:
        return {}
    cur.execute(
        """
        select tender_id::text, array_agg(cpv_code order by cpv_code)
        from public.tender_cpvs
        where tender_id = any(%s::uuid[])
        group by tender_id
        """,
        (tender_ids,),
    )
    out: dict[str, tuple[str, ...]] = {}
    for tid, codes in cur.fetchall():
        out[str(tid)] = tuple(c for c in (codes or []) if c)
    return out


def _tender_meta(
    cur: Any, tender_ids: list[str]
) -> dict[str, dict[str, Any]]:
    if not tender_ids:
        return {}
    cur.execute(
        """
        select id::text, coalesce(title, ''), coalesce(description, ''),
               contract_type, estimated_value
        from public.tenders
        where id = any(%s::uuid[])
        """,
        (tender_ids,),
    )
    cpvs = _cpvs_for_tenders(cur, tender_ids)
    meta: dict[str, dict[str, Any]] = {}
    for tid, title, desc, ctype, value in cur.fetchall():
        meta[str(tid)] = {
            "title": title or "",
            "description": desc or "",
            "contract_type": ctype,
            "estimated_value": _as_decimal(value),
            "cpv_codes": cpvs.get(str(tid), ()),
        }
    return meta


def list_user_ids(conn: Any) -> list[str]:
    with conn.cursor() as cur:
        cur.execute("select id::text from public.users order by id")
        return [r[0] for r in cur.fetchall()]


def _public_table_exists(cur: Any, table_name: str) -> bool:
    cur.execute(
        """
        select 1
        from information_schema.tables
        where table_schema = 'public' and table_name = %s
        """,
        (table_name,),
    )
    return cur.fetchone() is not None


def _fetch_optional_rows(
    cur: Any,
    *,
    table_name: str,
    sql: str,
    params: tuple[Any, ...] = (),
) -> list[tuple[Any, ...]]:
    """Si la tabla no existe (p. ej. offer_cases aún no en remoto), devolver []."""
    if not _public_table_exists(cur, table_name):
        return []
    cur.execute(sql, params)
    return list(cur.fetchall())


def load_user_seed_inputs(conn: Any, user_id: str) -> dict[str, Any]:
    """Ratings, favoritos, común, peer shares y offer_cases enriquecidos.

    Fuentes opcionales (común / compartidas / mis licitaciones): si la tabla no
    existe o no hay filas, se omiten como semillas (listas vacías).
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            select tender_id::text, score, interest_kind
            from public.tender_ratings
            where user_id = %s::uuid
            """,
            (user_id,),
        )
        rating_rows = cur.fetchall()

        cur.execute(
            """
            select tender_id::text, kind
            from public.favorites
            where user_id = %s::uuid
            """,
            (user_id,),
        )
        fav_rows = cur.fetchall()

        common_rows = _fetch_optional_rows(
            cur,
            table_name="favorites_common",
            sql="""
            select tender_id::text, kind
            from public.favorites_common
            """,
        )

        peer_rows = _fetch_optional_rows(
            cur,
            table_name="favorites_shared",
            sql="""
            select tender_id::text, kind
            from public.favorites_shared
            where from_user_id = %s::uuid or to_user_id = %s::uuid
            """,
            params=(user_id, user_id),
        )

        offer_rows = _fetch_optional_rows(
            cur,
            table_name="offer_cases",
            sql="""
            select tender_id::text, stage, coalesce(kind, 'propia')
            from public.offer_cases
            """,
        )
    all_ids = sorted(
        {
            *[r[0] for r in rating_rows],
            *[r[0] for r in fav_rows],
            *[r[0] for r in common_rows],
            *[r[0] for r in peer_rows],
            *[r[0] for r in offer_rows],
        }
    )
    with conn.cursor() as cur:
        meta = _tender_meta(cur, all_ids)

    def enrich(tid: str) -> dict[str, Any]:
        return meta.get(
            tid,
            {
                "title": "",
                "description": "",
                "contract_type": None,
                "estimated_value": None,
                "cpv_codes": (),
            },
        )

    ratings = [
        RatingRow(
            tender_id=tid,
            score=int(score),
            interest_kind=kind,
            **{k: enrich(tid)[k] for k in (
                "title", "cpv_codes", "contract_type", "estimated_value"
            )},
        )
        for tid, score, kind in rating_rows
    ]
    own_favorites = [
        FavoriteRow(
            tender_id=tid,
            kind=kind,
            **{k: enrich(tid)[k] for k in (
                "title", "cpv_codes", "contract_type", "estimated_value"
            )},
        )
        for tid, kind in fav_rows
    ]
    common_favorites = [
        FavoriteRow(
            tender_id=tid,
            kind=kind,
            **{k: enrich(tid)[k] for k in (
                "title", "cpv_codes", "contract_type", "estimated_value"
            )},
        )
        for tid, kind in common_rows
    ]
    # peer shares: kind en favorites_shared
    peer_shares = [
        FavoriteRow(
            tender_id=tid,
            kind=kind,
            **{k: enrich(tid)[k] for k in (
                "title", "cpv_codes", "contract_type", "estimated_value"
            )},
        )
        for tid, kind in peer_rows
    ]
    offer_cases = [
        OfferCaseRow(
            tender_id=tid,
            stage=stage,
            kind="subcontrata" if kind == "subcontrata" else "propia",
            **{k: enrich(tid)[k] for k in (
                "title", "cpv_codes", "contract_type", "estimated_value"
            )},
        )
        for tid, stage, kind in offer_rows
    ]
    return {
        "ratings": ratings,
        "own_favorites": own_favorites,
        "common_favorites": common_favorites,
        "peer_shares": peer_shares,
        "offer_cases": offer_cases,
        "exclude_ids": {
            *[r.tender_id for r in ratings],
            *[f.tender_id for f in own_favorites],
        },
    }


def load_candidates(
    conn: Any,
    *,
    exclude_ids: set[str],
    seed_cpv_prefixes: list[str],
    seed_titles: list[str],
    limit: int = 800,
) -> list[CandidateTender]:
    """Candidatas en plazo: prefijo CPV o similitud de título con semillas."""
    prefixes = [p for p in seed_cpv_prefixes if p]
    titles = [t for t in seed_titles if t and t.strip()]
    with conn.cursor() as cur:
        # Base: en plazo
        cur.execute(
            """
            select t.id::text,
                   coalesce(t.title, ''),
                   coalesce(t.description, ''),
                   t.contract_type,
                   t.estimated_value
            from public.tenders t
            where t.deadline_at is not null
              and t.deadline_at > now()
            order by t.deadline_at asc
            limit %s
            """,
            (max(limit * 3, 1500),),
        )
        rows = cur.fetchall()

    ids = [r[0] for r in rows if r[0] not in exclude_ids]
    if not ids:
        return []

    with conn.cursor() as cur:
        cpvs = _cpvs_for_tenders(cur, ids)

    # Filtrar por CPV prefix o, si no hay prefijos, dejar pasar a similarity
    filtered: list[tuple] = []
    for tid, title, desc, ctype, value in rows:
        if tid in exclude_ids:
            continue
        codes = cpvs.get(tid, ())
        if prefixes:
            ok = False
            for code in codes:
                digits = "".join(ch for ch in code if ch.isdigit())
                for pref in prefixes:
                    if digits.startswith(pref[:3]):
                        ok = True
                        break
                if ok:
                    break
            # También dejar pasar si el título comparte tokens con semillas
            if not ok and titles:
                title_l = (title or "").casefold()
                ok = any(
                    any(tok and tok in title_l for tok in s.casefold().split()[:6])
                    for s in titles[:20]
                )
            if not ok:
                # Perfil empresa: telegestión / alumbrado / etc. se filtran luego por score
                blob = f"{title} {desc}".casefold()
                ok = any(
                    k in blob
                    for k in (
                        "alumbrado",
                        "telegestión",
                        "telegestion",
                        "eficiencia energética",
                        "mapa lumínico",
                        "fotovolta",
                    )
                )
            if not ok:
                continue
        filtered.append((tid, title, desc, ctype, value, codes))
        if len(filtered) >= limit:
            break

    # Similarity vs primer título semilla (aprox. en Python si no hay pg)
    out: list[CandidateTender] = []
    for tid, title, desc, ctype, value, codes in filtered:
        sim = 0.0
        if titles:
            sim = max((_simple_sim(title, s) for s in titles[:15]), default=0.0)
        out.append(
            CandidateTender(
                tender_id=tid,
                title=title or "",
                description=desc or "",
                cpv_codes=codes,
                contract_type=ctype,
                estimated_value=_as_decimal(value),
                text_rank=sim * 0.5,
                title_similarity=sim,
            )
        )
    return out


def _simple_sim(a: str, b: str) -> float:
    """Overlap de tokens (sustituto ligero de pg_trgm en el path Python)."""
    ta = {t for t in a.casefold().split() if len(t) > 2}
    tb = {t for t in b.casefold().split() if len(t) > 2}
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    return inter / max(len(ta | tb), 1)


def replace_user_recommendations(
    conn: Any,
    *,
    user_id: str,
    rows: list[Recommendation],
) -> int:
    """Sustituye todas las recomendaciones del usuario (1 fila por tender)."""
    now = datetime.now(timezone.utc)
    with conn.cursor() as cur:
        cur.execute(
            """
            delete from public.tender_recommendations
            where user_id = %s::uuid
            """,
            (user_id,),
        )
        for rec in rows:
            cur.execute(
                """
                insert into public.tender_recommendations
                  (user_id, profile_kind, tender_id, score, reason, computed_at)
                values (%s::uuid, %s, %s::uuid, %s, %s::jsonb, %s)
                """,
                (
                    user_id,
                    rec.profile_kind,
                    rec.tender_id,
                    rec.score,
                    json.dumps(rec.reason, ensure_ascii=False),
                    now,
                ),
            )
    return len(rows)


def seed_cpv_prefixes(seeds: list[Any]) -> list[str]:
    prefs: list[str] = []
    for s in seeds:
        for c in getattr(s, "cpv_codes", ()) or ():
            digits = "".join(ch for ch in c if ch.isdigit())
            if len(digits) >= 3:
                prefs.append(digits[:5])
    # únicos preservando orden
    seen: set[str] = set()
    out: list[str] = []
    for p in prefs:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out[:40]
