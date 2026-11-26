#!/usr/bin/env python3
"""One-shot local: rellena contracting_authority_id en import_eficen.

Organismos tomados de fichas PLACE/Navarra (scrape Mis Licitaciones).
No toca title/description/estimated_value. Murillo II se deja como está.
Marca Gemelo Digital como stage=subcontrata.
Normaliza source_url PLACE !ut/p → deeplink idEvl (Navarra se deja).

Uso::

  cd ingestion
  uv run python ../scripts/enrich_import_eficen_authorities.py
"""

from __future__ import annotations

import re
import unicodedata

import psycopg

DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
SOURCE = "import_eficen"
DEEPLINK_BASE = (
    "https://contrataciondelestado.es/wps/poc"
    "?uri=deeplink:detalle_licitacion&idEvl="
)

# estimated_value → idEvl (solo filas que venían como !ut/p en el Excel)
DEEPLINK_BY_VALUE: dict[str, str] = {
    "13340.00": "BEVXDkVYR8WcCF8sV%2BqtYA%3D%3D",  # Ezcaray
    "25439.00": "ogJyFL0ZB8CKeVWTb9Scog%3D%3D",  # Murillo TICs
    "43707.00": "EjNgr5fnT7qExvMJXBMHHQ%3D%3D",  # Palma
    "52219.00": "TFaMmHdJjrdLAIVZdUs8KA%3D%3D",  # Borja
    "58450.00": "k2zCrEKTtNJrSd8H4b2soA%3D%3D",  # Ciempozuelos
    "82467.00": "WG0Yp6nrnDGP%2Bo96UAV7cQ%3D%3D",  # Barakaldo
    "190400.00": "opKNmewE8Dpq1DdmE7eaXg%3D%3D",  # Mairena
    "216240.00": "6BIMMNqFEtI4NavIWzMcHA%3D%3D",  # Alberite
}

# Match por estimated_value Excel (clave estable en este seed) → (name, platform_id|None, confidence)
BY_VALUE: dict[str, tuple[str, str | None, str]] = {
    "190400.00": (
        "Alcaldía del Ayuntamiento de Mairena del Aljarafe",
        "31028130146573",
        "MEDIUM",
    ),
    "82467.00": (
        "Ayuntamiento de Barakaldo-Alcalde",
        "17645_17646_17648",
        "MEDIUM",
    ),
    "13340.00": (
        "Alcaldía del Ayuntamiento de Ezcaray",
        "31075100151270",
        "MEDIUM",
    ),
    "25439.00": (
        "Pleno del Ayuntamiento de Murillo de Río Leza",
        "31065450150305",
        "MEDIUM",
    ),
    # PLACE: Palma (el Excel marcaba otro «lugar»; organismo = ficha)
    "43707.00": (
        "Junta de Gobierno del Ayuntamiento de Palma de Mallorca",
        "30867220130482",
        "MEDIUM",
    ),
    "58450.00": (
        "Alcaldía del Ayuntamiento de Ciempozuelos",
        "31060490149809",
        "MEDIUM",
    ),
    "2546.00": (
        "Pleno del Ayuntamiento de Murillo de Río Leza",
        "31065450150305",
        "MEDIUM",
    ),
    "216240.00": (
        "Alcaldía del Ayuntamiento de Alberite",
        "31431940186954",
        "MEDIUM",
    ),
    "52219.00": (
        "Alcalde del Ayuntamiento de Borja",
        "31031780146938",
        "MEDIUM",
    ),
    "213155.00": (
        "Junta de Gobierno del Ayuntamiento de Logroño",
        "30689620112722",
        "MEDIUM",
    ),
    "59950.00": (
        "Junta de Gobierno del Ayuntamiento de Logroño",
        "30689620112722",
        "MEDIUM",
    ),
    "47432.00": (
        "Junta de Gobierno Local del Ayuntamiento de Caspe",
        "31043650148125",
        "MEDIUM",
    ),
    "24906.73": (
        "Junta de Gobierno del Ayuntamiento de Almería",
        "30794610123221",
        "MEDIUM",
    ),
    "123500.00": (
        "Concejalía Delegada de Infraestructuras y Ciclo Integral del Agua del Ayuntamiento de Zaragoza",
        "31604110204171",
        "MEDIUM",
    ),
    "327828.00": (
        "Departamento de Industria y de Transición Ecológica y Digital Empresarial",
        None,
        "LOW",
    ),
}


def normalize_name(name: str) -> str:
    text = unicodedata.normalize("NFKD", name.strip().lower())
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def upsert_authority(
    conn: psycopg.Connection,
    *,
    name: str,
    platform_id: str | None,
    confidence: str,
) -> str:
    name_n = normalize_name(name)
    if platform_id:
        existing = conn.execute(
            """
            select id::text from public.contracting_authorities
            where tax_id is null and platform_id = %s and tax_id_country = 'ES'
            limit 1
            """,
            (platform_id,),
        ).fetchone()
        if existing:
            conn.execute(
                """
                update public.contracting_authorities
                set name = %s,
                    name_normalized = %s,
                    identity_confidence = %s,
                    updated_at = now()
                where id = %s::uuid
                """,
                (name, name_n, confidence, existing[0]),
            )
            return existing[0]
        row = conn.execute(
            """
            insert into public.contracting_authorities (
              tax_id, tax_id_country, platform_id, name, name_normalized,
              identity_confidence
            ) values (
              null, 'ES', %s, %s, %s, %s
            )
            returning id::text
            """,
            (platform_id, name, name_n, confidence),
        ).fetchone()
        assert row is not None
        return row[0]

    existing = conn.execute(
        """
        select id::text from public.contracting_authorities
        where tax_id is null and platform_id is null
          and name_normalized = %s
        limit 1
        """,
        (name_n,),
    ).fetchone()
    if existing:
        return existing[0]
    row = conn.execute(
        """
        insert into public.contracting_authorities (
          tax_id, tax_id_country, platform_id, name, name_normalized,
          identity_confidence
        ) values (
          null, 'ES', null, %s, %s, %s
        )
        returning id::text
        """,
        (name, name_n, confidence),
    ).fetchone()
    assert row is not None
    return row[0]


def main() -> int:
    with psycopg.connect(DB) as conn:
        rows = conn.execute(
            """
            select t.id::text, t.title, t.estimated_value::text
            from tenders t
            join tender_sources ts on ts.tender_id = t.id
            where ts.source_code = %s
            order by t.title
            """,
            (SOURCE,),
        ).fetchall()

        linked = 0
        for tid, title, value in rows:
            meta = BY_VALUE.get(value or "")
            if not meta:
                print(f"SKIP sin mapping valor={value}: {title[:60]}")
                continue
            name, plat, conf = meta
            auth_id = upsert_authority(
                conn, name=name, platform_id=plat, confidence=conf
            )
            conn.execute(
                """
                update public.tenders
                set contracting_authority_id = %s::uuid,
                    updated_at = now()
                where id = %s::uuid
                """,
                (auth_id, tid),
            )
            linked += 1
            print(
                f"OK plat={plat or '-':20s} conf={conf:6s} | {name[:48]:48s} | {title[:36]}"
            )

        n = conn.execute(
            """
            update public.offer_cases oc
            set stage = 'subcontrata', updated_at = now()
            from public.tenders t
            join public.tender_sources ts on ts.tender_id = t.id
            where oc.tender_id = t.id
              and ts.source_code = %s
              and t.title ilike %s
            """,
            (SOURCE, "%Gemelo Digital%"),
        ).rowcount
        print(f"Gemelo -> subcontrata: {n} fila(s)")

        url_n = 0
        for tid, title, value in rows:
            idevl = DEEPLINK_BY_VALUE.get(value or "")
            if not idevl:
                continue
            url = DEEPLINK_BASE + idevl
            r = conn.execute(
                """
                update public.tender_sources
                set source_url = %s
                where tender_id = %s::uuid
                  and source_code = %s
                  and (
                    position('!ut/p' in coalesce(source_url, '')) > 0
                    or coalesce(source_url, '') <> %s
                  )
                """,
                (url, tid, SOURCE, url),
            )
            if r.rowcount:
                url_n += r.rowcount
                print(f"URL deeplink | {title[:40]}")
        print(f"URLs normalizadas a deeplink: {url_n}")

        conn.commit()
        print(f"=== linked authorities: {linked}/{len(rows)} ===")

        verify = conn.execute(
            """
            select left(t.title, 42), left(ca.name, 42), ca.platform_id, oc.stage
            from tenders t
            join tender_sources ts on ts.tender_id = t.id
            left join contracting_authorities ca on ca.id = t.contracting_authority_id
            left join offer_cases oc on oc.tender_id = t.id
            where ts.source_code = %s
            order by t.title
            """,
            (SOURCE,),
        ).fetchall()
        print("--- verify ---")
        for r in verify:
            print(f"{(r[3] or '-'):14s} | {(r[1] or '-')[:40]:40s} | {r[0]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
