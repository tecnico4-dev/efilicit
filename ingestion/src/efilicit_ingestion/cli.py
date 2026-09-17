"""EfiLicit ingestion CLI."""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

from efilicit_ingestion import __version__
from efilicit_ingestion.connectors.placsp.urls import PLACSP, PLACSP_AGREGADAS, PlacspSyndication
from efilicit_ingestion.run_catalunya import CatalunyaRunConfig, run_catalunya
from efilicit_ingestion.run_euskadi import EuskadiRunConfig, run_euskadi
from efilicit_ingestion.run_placsp import PlacspRunConfig, format_result, run_placsp

_SYNDICATIONS: dict[str, PlacspSyndication] = {
    PLACSP.source_code: PLACSP,
    PLACSP_AGREGADAS.source_code: PLACSP_AGREGADAS,
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="efilicit-ingestion",
        description="EfiLicit ingestion CLI (PLACSP + Catalunya + Euskadi).",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )

    sub = parser.add_subparsers(dest="command")

    placsp = sub.add_parser(
        "run-placsp",
        help="Run PLACSP pipeline end-to-end (fixture and/or local Supabase).",
    )
    placsp.add_argument(
        "--syndication",
        choices=sorted(_SYNDICATIONS),
        default=PLACSP.source_code,
        help="PLACSP dataset (default: placsp perfiles; placsp_agregadas = Semana 3).",
    )
    placsp.add_argument(
        "--fixture",
        type=Path,
        help="Local .atom/.zip fixture (no live PLACSP network).",
    )
    placsp.add_argument(
        "--from-month",
        dest="from_year_month",
        help="Inclusive start YYYY-MM (live or fixture window).",
    )
    placsp.add_argument(
        "--to-month",
        dest="to_year_month",
        help="Inclusive end YYYY-MM.",
    )
    placsp.add_argument(
        "--as-of",
        help="Pivot date YYYY-MM-DD (default: today).",
    )
    placsp.add_argument(
        "--dry-run",
        action="store_true",
        help="In-memory only (no Postgres / Storage writes).",
    )
    placsp.add_argument(
        "--no-storage",
        action="store_true",
        help="Skip Supabase Storage; keep RAW metadata path in-memory only.",
    )
    placsp.add_argument(
        "--run-id",
        help="Optional stable run_id (default: generated UUID).",
    )

    catalunya = sub.add_parser(
        "run-catalunya",
        help="Run Catalunya Socrata pipeline end-to-end (fixture and/or local Supabase).",
    )
    catalunya.add_argument(
        "--fixture",
        type=Path,
        help="Local .json SODA page fixture (no live network).",
    )
    catalunya.add_argument(
        "--page-size",
        type=int,
        default=1000,
        help="SODA $limit per page (default: 1000).",
    )
    catalunya.add_argument(
        "--max-pages",
        type=int,
        default=1,
        help="Number of pages to discover (default: 1).",
    )
    catalunya.add_argument(
        "--start-offset",
        type=int,
        default=0,
        help="SODA $offset for the first page (default: 0).",
    )
    catalunya.add_argument(
        "--dry-run",
        action="store_true",
        help="In-memory only (no Postgres / Storage writes).",
    )
    catalunya.add_argument(
        "--no-storage",
        action="store_true",
        help="Skip Supabase Storage; keep RAW metadata path in-memory only.",
    )
    catalunya.add_argument(
        "--run-id",
        help="Optional stable run_id (default: generated UUID).",
    )

    euskadi = sub.add_parser(
        "run-euskadi",
        help="Run Euskadi KontratazioA pipeline end-to-end (fixture and/or local Supabase).",
    )
    euskadi.add_argument(
        "--fixture",
        type=Path,
        help="Local .json contracting-notices page fixture (no live network).",
    )
    euskadi.add_argument(
        "--max-pages",
        type=int,
        default=1,
        help="Number of API pages to discover (default: 1; API page size is 10).",
    )
    euskadi.add_argument(
        "--start-page",
        type=int,
        default=1,
        help="First currentPage (1-based, default: 1).",
    )
    euskadi.add_argument(
        "--dry-run",
        action="store_true",
        help="In-memory only (no Postgres / Storage writes).",
    )
    euskadi.add_argument(
        "--no-storage",
        action="store_true",
        help="Skip Supabase Storage; keep RAW metadata path in-memory only.",
    )
    euskadi.add_argument(
        "--run-id",
        help="Optional stable run_id (default: generated UUID).",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command is None:
        parser.print_help()
        return 0

    if args.command == "run-placsp":
        return _cmd_run_placsp(args)
    if args.command == "run-catalunya":
        return _cmd_run_catalunya(args)
    if args.command == "run-euskadi":
        return _cmd_run_euskadi(args)

    parser.print_help()
    return 2


def _cmd_run_placsp(args: argparse.Namespace) -> int:
    if args.fixture is None and not args.dry_run and args.from_year_month is None:
        print(
            "error: provide --fixture for local E2E, or --from-month for live discover, "
            "or --dry-run with --fixture",
            file=sys.stderr,
        )
        return 2

    as_of = None
    if args.as_of:
        as_of = date.fromisoformat(args.as_of)

    fixture = args.fixture
    if fixture is not None and not fixture.exists():
        print(f"error: fixture not found: {fixture}", file=sys.stderr)
        return 2

    config = PlacspRunConfig(
        fixture_path=fixture,
        from_year_month=args.from_year_month,
        to_year_month=args.to_year_month,
        as_of=as_of,
        dry_run=bool(args.dry_run),
        run_id=args.run_id,
        use_storage=not bool(args.no_storage),
        syndication=_SYNDICATIONS[args.syndication],
    )

    try:
        result = run_placsp(config)
    except Exception as exc:  # noqa: BLE001 — surface to CLI
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(format_result(result))
    return 0 if result.sync.status == "success" else 1


def _cmd_run_catalunya(args: argparse.Namespace) -> int:
    if args.dry_run and args.fixture is None:
        print("error: --dry-run requires --fixture", file=sys.stderr)
        return 2

    fixture = args.fixture
    if fixture is not None and not fixture.exists():
        print(f"error: fixture not found: {fixture}", file=sys.stderr)
        return 2

    if args.page_size < 1 or args.max_pages < 1 or args.start_offset < 0:
        print("error: invalid page-size / max-pages / start-offset", file=sys.stderr)
        return 2

    config = CatalunyaRunConfig(
        fixture_path=fixture,
        page_size=args.page_size,
        max_pages=args.max_pages,
        start_offset=args.start_offset,
        dry_run=bool(args.dry_run),
        run_id=args.run_id,
        use_storage=not bool(args.no_storage),
    )

    try:
        result = run_catalunya(config)
    except Exception as exc:  # noqa: BLE001 — surface to CLI
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(format_result(result))
    return 0 if result.sync.status == "success" else 1


def _cmd_run_euskadi(args: argparse.Namespace) -> int:
    if args.dry_run and args.fixture is None:
        print("error: --dry-run requires --fixture", file=sys.stderr)
        return 2

    fixture = args.fixture
    if fixture is not None and not fixture.exists():
        print(f"error: fixture not found: {fixture}", file=sys.stderr)
        return 2

    if args.max_pages < 1 or args.start_page < 1:
        print("error: invalid max-pages / start-page", file=sys.stderr)
        return 2

    config = EuskadiRunConfig(
        fixture_path=fixture,
        max_pages=args.max_pages,
        start_page=args.start_page,
        dry_run=bool(args.dry_run),
        run_id=args.run_id,
        use_storage=not bool(args.no_storage),
    )

    try:
        result = run_euskadi(config)
    except Exception as exc:  # noqa: BLE001 — surface to CLI
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(format_result(result))
    return 0 if result.sync.status == "success" else 1


if __name__ == "__main__":
    sys.exit(main())
