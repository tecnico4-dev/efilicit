#!/usr/bin/env python3
"""Seed local: histórico Eficen → tenders/tender_sources/bid_cases (import_eficen).

Lee el Excel y carpetas ADJ-* del Escritorio (fuera del repo). Idempotente por
``(import_eficen, source_tender_id)``.

Uso (desde repo root, con Supabase local en :54322)::

  cd ingestion
  uv run --with openpyxl python ../scripts/seed_import_eficen_local.py

No hace push remoto ni toca ZIPs PLACSP.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from urllib.parse import unquote

import psycopg
from openpyxl import load_workbook

SOURCE_CODE = "import_eficen"
DEFAULT_EXCEL = Path(
    r"C:\Users\tecnico4\Desktop\Investigación licitaciones\Resumen Licitaciones Eficen.xlsx"
)
DEFAULT_ADJ_ROOT = Path(r"C:\Users\tecnico4\Desktop\Investigación licitaciones")
DEFAULT_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"


@dataclass
class ImportRow:
    source_tender_id: str
    title: str
    place: str | None
    year: int | None
    estimated_value: float | None
    contract_type: str | None
    status_excel: str  # Adjudicado | No adjudicado
    source_url: str
    cpvs: list[str] = field(default_factory=list)
    gaps: list[str] = field(default_factory=list)


def stable_id(*parts: str) -> str:
    raw = "|".join(p.strip().lower() for p in parts if p and p.strip())
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
    return f"eficen-{digest}"


def normalize_cpv(raw: object) -> str | None:
    if raw is None:
        return None
    text = str(raw).strip()
    digits = re.sub(r"\D", "", text)
    if not digits:
        return None
    if len(digits) < 8:
        digits = digits.ljust(8, "0")
    return digits[:8]


def map_contract_type(raw: object) -> str | None:
    if raw is None:
        return None
    key = str(raw).strip().lower()
    if not key:
        return None
    if "suministr" in key:
        return "suministros"
    if "servic" in key:
        return "servicios"
    if "administrativ" in key:
        return "administrativo_especial"
    if "obra" in key:
        return "obras"
    return None


def map_tender_status(excel_status: str) -> str:
    if excel_status.lower().startswith("no"):
        return "resuelta"
    return "adjudicada"


def map_bid_stage(excel_status: str, *, title: str = "") -> str:
    if excel_status.lower().startswith("no"):
        return "no_adjudicada"
    # Participación en expediente ajeno (p. ej. asistencia al adjudicatario).
    if "asistir a la ejecución" in title.lower():
        return "subcontrata"
    return "adjudicada"


def cell_url(cell) -> str | None:
    if cell.hyperlink and cell.hyperlink.target:
        return str(cell.hyperlink.target).strip()
    if isinstance(cell.value, str) and cell.value.startswith("http"):
        return cell.value.strip()
    return None


def read_excel(path: Path) -> tuple[list[ImportRow], list[dict]]:
    wb = load_workbook(path, data_only=False)
    ws = wb.active
    status = "Adjudicado"
    year: int | None = None
    rows: list[ImportRow] = []
    skipped: list[dict] = []
    pending: ImportRow | None = None

    def flush() -> None:
        nonlocal pending
        if pending is None:
            return
        if not pending.source_url:
            skipped.append(
                {
                    "place": pending.place,
                    "title": pending.title[:80],
                    "reason": "sin enlace",
                }
            )
        else:
            if not pending.cpvs:
                pending.gaps.append("sin_cpv")
            if pending.estimated_value is None:
                pending.gaps.append("sin_importe")
            if pending.contract_type is None:
                pending.gaps.append("sin_tipo_contrato")
            if pending.place is None:
                pending.gaps.append("sin_lugar")
            if pending.year is None:
                pending.gaps.append("sin_anio")
            rows.append(pending)
        pending = None

    for r in range(4, ws.max_row + 1):
        c_status = ws.cell(r, 2).value
        c_year = ws.cell(r, 3).value
        c_place = ws.cell(r, 4).value
        c_val = ws.cell(r, 5).value
        c_type = ws.cell(r, 7).value
        c_cpv = ws.cell(r, 8).value
        c_text = ws.cell(r, 9).value
        url = cell_url(ws.cell(r, 10))

        if isinstance(c_status, str) and c_status.strip():
            status = c_status.strip()
        if isinstance(c_year, (int, float)):
            year = int(c_year)

        place = str(c_place).strip() if c_place else None
        title = str(c_text).strip() if c_text else None
        is_tender = bool(place or (title and (c_val is not None or url)))

        # Filas solo-CPV (continuación de la licitación anterior)
        if not is_tender and pending is not None and c_cpv is not None and not place:
            cpv = normalize_cpv(c_cpv)
            if cpv and cpv not in pending.cpvs:
                pending.cpvs.append(cpv)
            continue

        if not is_tender:
            continue

        flush()
        assert title or place
        title_full = title or f"Licitación Eficen ({place or 'sin lugar'})"
        sid = stable_id(url or "", place or "", title_full, str(year or ""))
        value = float(c_val) if isinstance(c_val, (int, float)) else None
        cpvs: list[str] = []
        cpv0 = normalize_cpv(c_cpv)
        if cpv0:
            cpvs.append(cpv0)
        pending = ImportRow(
            source_tender_id=sid,
            title=title_full,
            place=place,
            year=year,
            estimated_value=value,
            contract_type=map_contract_type(c_type),
            status_excel=status,
            source_url=url or "",
            cpvs=cpvs,
        )

    flush()
    return rows, skipped


def read_url_file(path: Path) -> str | None:
    text = path.read_text(encoding="utf-8", errors="ignore")
    for line in text.splitlines():
        if line.upper().startswith("URL="):
            return line.split("=", 1)[1].strip()
    return None


def read_adj_folders(root: Path) -> list[ImportRow]:
    out: list[ImportRow] = []
    if not root.is_dir():
        return out
    for child in sorted(root.iterdir()):
        if not child.is_dir() or not child.name.upper().startswith("ADJ"):
            continue
        url_path = child / "Enlace.url"
        url = read_url_file(url_path) if url_path.is_file() else None
        if not url:
            continue
        # ADJ-Almería2019 / ADJ_Zaragoza2024
        m = re.search(r"(20\d{2})", child.name)
        year = int(m.group(1)) if m else None
        place = re.sub(r"^ADJ[-_]?", "", child.name, flags=re.I)
        place = re.sub(r"20\d{2}$", "", place).strip("-_ ") or child.name
        title = f"Adjudicación histórica Eficen — {place}" + (f" ({year})" if year else "")
        pdfs = list(child.glob("*.pdf"))
        gaps = ["titulo_generico_adj"]
        if not pdfs:
            gaps.append("sin_pdf")
        else:
            gaps.append("revisar_titulo_desde_pdf")
        out.append(
            ImportRow(
                source_tender_id=stable_id(url, child.name),
                title=title,
                place=place,
                year=year,
                estimated_value=None,
                contract_type=None,
                status_excel="Adjudicado",
                source_url=unquote(url),
                gaps=gaps + ["sin_cpv", "sin_importe", "sin_tipo_contrato"],
            )
        )
    return out


def upsert_row(conn: psycopg.Connection, row: ImportRow) -> str:
    """Insert or skip. Returns 'inserted' | 'skipped'."""
    existing = conn.execute(
        """
        select tender_id
        from public.tender_sources
        where source_code = %s and source_tender_id = %s
        """,
        (SOURCE_CODE, row.source_tender_id),
    ).fetchone()
    if existing:
        return "skipped"

    pub = date(row.year, 1, 1) if row.year else None
    outcome = date(row.year, 12, 31) if row.year else None
    tender_status = map_tender_status(row.status_excel)
    stage = map_bid_stage(row.status_excel, title=row.title)

    tender_id = conn.execute(
        """
        insert into public.tenders (
          title, description, status, contract_type, estimated_value, currency,
          publication_date, canonical_source_code
        ) values (
          %s, %s, %s, %s, %s, 'EUR', %s, %s
        )
        returning id
        """,
        (
            row.title,
            row.title,  # misma cadena que el título; no inventar resumen
            tender_status,
            row.contract_type,
            row.estimated_value,
            pub,
            SOURCE_CODE,
        ),
    ).fetchone()
    assert tender_id is not None
    tid = tender_id[0]

    conn.execute(
        """
        insert into public.tender_sources (
          tender_id, source_code, source_tender_id, source_url,
          review_status
        ) values (%s, %s, %s, %s, 'unmatched')
        """,
        (tid, SOURCE_CODE, row.source_tender_id, row.source_url),
    )

    for cpv in row.cpvs:
        conn.execute(
            """
            insert into public.tender_cpvs (tender_id, cpv_code)
            values (%s, %s)
            on conflict do nothing
            """,
            (tid, cpv),
        )

    conn.execute(
        """
        insert into public.bid_cases (
          tender_id, stage, outcome_on, notes
        ) values (%s, %s, %s, null)
        on conflict (tender_id) do nothing
        """,
        (tid, stage, outcome),
    )
    return "inserted"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--excel", type=Path, default=DEFAULT_EXCEL)
    parser.add_argument("--adj-root", type=Path, default=DEFAULT_ADJ_ROOT)
    parser.add_argument("--db-url", default=DEFAULT_DB)
    args = parser.parse_args()

    if not args.excel.is_file():
        print(f"ERROR: Excel no encontrado: {args.excel}", file=sys.stderr)
        return 1

    excel_rows, skipped = read_excel(args.excel)
    adj_rows = read_adj_folders(args.adj_root)
    all_rows = excel_rows + adj_rows

    inserted = skipped_exist = 0
    with psycopg.connect(args.db_url) as conn:
        # Ensure bid tables exist
        n = conn.execute(
            """
            select count(*) from information_schema.tables
            where table_schema='public' and table_name='bid_cases'
            """
        ).fetchone()
        if not n or n[0] == 0:
            print("ERROR: falta public.bid_cases — restaura la migración 20261030120000", file=sys.stderr)
            return 1

        for row in all_rows:
            result = upsert_row(conn, row)
            if result == "inserted":
                inserted += 1
            else:
                skipped_exist += 1
        conn.commit()

    print("=== Import Eficen (local) ===")
    print(f"Insertadas: {inserted}  |  Ya existían: {skipped_exist}")
    print(f"Desde Excel (con link): {len(excel_rows)}  |  Desde ADJ-*: {len(adj_rows)}")
    print()
    print("--- Excluidas (sin enlace) ---")
    for s in skipped:
        print(f"  · {s['place'] or '—'}: {s['title']} [{s['reason']}]")
    if not skipped:
        print("  (ninguna)")
    print()
    print("--- Huecos a revisar ---")
    for row in all_rows:
        if row.gaps:
            print(f"  · {row.place or row.source_tender_id}: {', '.join(row.gaps)}")
            print(f"      {row.title[:90]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
