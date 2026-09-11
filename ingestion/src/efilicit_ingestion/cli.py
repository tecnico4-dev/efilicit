"""EfiLicit ingestion CLI."""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

from efilicit_ingestion import __version__
from efilicit_ingestion.run_placsp import PlacspRunConfig, format_result, run_placsp


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="efilicit-ingestion",
        description="EfiLicit ingestion CLI (PLACSP vertical slice in Semana 2).",
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
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command is None:
        parser.print_help()
        return 0

    if args.command == "run-placsp":
        return _cmd_run_placsp(args)

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
    )

    try:
        result = run_placsp(config)
    except Exception as exc:  # noqa: BLE001 — surface to CLI
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(format_result(result))
    return 0 if result.sync.status == "success" else 1


if __name__ == "__main__":
    sys.exit(main())
