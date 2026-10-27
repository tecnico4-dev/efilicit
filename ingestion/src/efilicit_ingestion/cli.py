"""CLI de ingestion EfiLicit (PLACSP, Catalunya, Euskadi, alertas)."""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

from efilicit_ingestion import __version__
from efilicit_ingestion.connectors.placsp.urls import (
    PLACSP,
    PLACSP_AGREGADAS,
    PLACSP_MENORES,
    PlacspSyndication,
)
from efilicit_ingestion.run_alerts import AlertsRunConfig, format_result as format_alerts_result, run_alerts
from efilicit_ingestion.run_catalunya import CatalunyaRunConfig, run_catalunya
from efilicit_ingestion.run_euskadi import EuskadiRunConfig, run_euskadi
from efilicit_ingestion.run_placsp import PlacspRunConfig, format_result, run_placsp

_SYNDICATIONS: dict[str, PlacspSyndication] = {
    PLACSP.source_code: PLACSP,
    PLACSP_AGREGADAS.source_code: PLACSP_AGREGADAS,
    PLACSP_MENORES.source_code: PLACSP_MENORES,
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="efilicit-ingestion",
        description="CLI de ingestion EfiLicit (PLACSP + Catalunya + Euskadi + alertas).",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )

    sub = parser.add_subparsers(dest="command")

    placsp = sub.add_parser(
        "run-placsp",
        help="Pipeline PLACSP E2E (fixture y/o Supabase local).",
    )
    placsp.add_argument(
        "--syndication",
        choices=sorted(_SYNDICATIONS),
        default=PLACSP.source_code,
        help=(
            "Dataset PLACSP: placsp (perfiles), placsp_agregadas, "
            "placsp_menores (Semana 4)."
        ),
    )
    placsp.add_argument(
        "--fixture",
        type=Path,
        help="Fixture local .atom/.zip (sin red PLACSP).",
    )
    placsp.add_argument(
        "--from-month",
        dest="from_year_month",
        help="Inicio inclusivo YYYY-MM (ventana live o fixture).",
    )
    placsp.add_argument(
        "--to-month",
        dest="to_year_month",
        help="Fin inclusivo YYYY-MM.",
    )
    placsp.add_argument(
        "--as-of",
        help="Fecha pivote YYYY-MM-DD (default: hoy).",
    )
    placsp.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo memoria (sin writes a Postgres / Storage).",
    )
    placsp.add_argument(
        "--no-storage",
        action="store_true",
        help="Omitir Supabase Storage; metadatos RAW solo en memoria.",
    )
    placsp.add_argument(
        "--run-id",
        help="run_id estable opcional (default: UUID generado).",
    )

    catalunya = sub.add_parser(
        "run-catalunya",
        help="Pipeline Catalunya Socrata E2E (fixture y/o Supabase local).",
    )
    catalunya.add_argument(
        "--fixture",
        type=Path,
        help="Fixture local .json de página SODA (sin red).",
    )
    catalunya.add_argument(
        "--page-size",
        type=int,
        default=1000,
        help="SODA $limit por página (default: 1000).",
    )
    catalunya.add_argument(
        "--max-pages",
        type=int,
        default=1,
        help="Número de páginas a descubrir (default: 1).",
    )
    catalunya.add_argument(
        "--start-offset",
        type=int,
        default=0,
        help="SODA $offset de la primera página (default: 0).",
    )
    catalunya.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo memoria (sin writes a Postgres / Storage).",
    )
    catalunya.add_argument(
        "--no-storage",
        action="store_true",
        help="Omitir Supabase Storage; metadatos RAW solo en memoria.",
    )
    catalunya.add_argument(
        "--run-id",
        help="run_id estable opcional (default: UUID generado).",
    )

    euskadi = sub.add_parser(
        "run-euskadi",
        help="Pipeline Euskadi KontratazioA E2E (fixture y/o Supabase local).",
    )
    euskadi.add_argument(
        "--fixture",
        type=Path,
        help="Fixture local .json de página contracting-notices (sin red).",
    )
    euskadi.add_argument(
        "--max-pages",
        type=int,
        default=1,
        help="Número de páginas API a descubrir (default: 1; tamaño de página = 10).",
    )
    euskadi.add_argument(
        "--start-page",
        type=int,
        default=1,
        help="Primera currentPage (base 1, default: 1).",
    )
    euskadi.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo memoria (sin writes a Postgres / Storage).",
    )
    euskadi.add_argument(
        "--no-storage",
        action="store_true",
        help="Omitir Supabase Storage; metadatos RAW solo en memoria.",
    )
    euskadi.add_argument(
        "--run-id",
        help="run_id estable opcional (default: UUID generado).",
    )

    alerts = sub.add_parser(
        "run-alerts",
        help=(
            "Alertas: match→cola y/o digest email (ADR 020). "
            "Por defecto: dry-run en memoria con FakeEmailSender (sin DB / sin Resend)."
        ),
    )
    alerts.set_defaults(dry_run=True)
    alerts.add_argument(
        "--dry-run",
        action="store_true",
        dest="dry_run",
        help="Fixtures en memoria + FakeEmailSender (default seguro).",
    )
    alerts.add_argument(
        "--write",
        action="store_false",
        dest="dry_run",
        help=(
            "Postgres real (EFILICIT_DATABASE_URL). "
            "Match usa ventana de source_sync del --sync-date (no since_days)."
        ),
    )
    alerts.add_argument(
        "--send",
        action="store_true",
        help=(
            "Con --write y phase send|all: envía vía Resend "
            "(RESEND_API_KEY + ALERT_FROM_EMAIL). Si no, Fake."
        ),
    )
    alerts.add_argument(
        "--phase",
        choices=("all", "match", "send"),
        default="all",
        help=(
            "all=match+drain (default manual); "
            "match=solo encolar (cron post-ingesta); "
            "send=solo drenar cola (cron diario)."
        ),
    )
    alerts.add_argument(
        "--digest",
        help="Día ancla del digest YYYY-MM-DD (default: hoy UTC).",
    )
    alerts.add_argument(
        "--sync-date",
        help=(
            "Día UTC de syncs success/partial para la ventana de match "
            "(default: mismo que --digest / hoy). Solo aplica a phase match|all."
        ),
    )

    health = sub.add_parser(
        "source-health",
        help=(
            "Healthcheck mínimo por fuente (última fila source_sync). "
            "Necesita EFILICIT_DATABASE_URL."
        ),
    )
    health.add_argument(
        "--max-age-hours",
        type=int,
        default=48,
        help="Un success más antiguo que esto cuenta como stale (default: 48).",
    )
    health.add_argument(
        "--fail-on-stale",
        action="store_true",
        help="Exit 1 si alguna fuente está stale (además de failed).",
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
    if args.command == "run-alerts":
        return _cmd_run_alerts(args)
    if args.command == "source-health":
        return _cmd_source_health(args)

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
    except Exception as exc:  # noqa: BLE001 — superficie al CLI
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
    except Exception as exc:  # noqa: BLE001 — superficie al CLI
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
    except Exception as exc:  # noqa: BLE001 — superficie al CLI
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(format_result(result))
    return 0 if result.sync.status == "success" else 1


def _cmd_run_alerts(args: argparse.Namespace) -> int:
    digest = None
    if args.digest:
        try:
            digest = date.fromisoformat(args.digest)
        except ValueError:
            print("error: --digest must be YYYY-MM-DD", file=sys.stderr)
            return 2

    sync_date = None
    if getattr(args, "sync_date", None):
        try:
            sync_date = date.fromisoformat(args.sync_date)
        except ValueError:
            print("error: --sync-date must be YYYY-MM-DD", file=sys.stderr)
            return 2

    if args.send and args.dry_run:
        print(
            "error: --send requires --write (dry-run never calls Resend)",
            file=sys.stderr,
        )
        return 2

    if args.send and args.phase == "match":
        print(
            "error: --send no aplica a --phase match (solo encola; usa send|all)",
            file=sys.stderr,
        )
        return 2

    config = AlertsRunConfig(
        dry_run=bool(args.dry_run),
        send=bool(args.send),
        digest=digest,
        sync_date=sync_date,
        phase=args.phase,
    )

    try:
        result = run_alerts(config)
    except Exception as exc:  # noqa: BLE001 — superficie al CLI
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(format_alerts_result(result))
    if result.drain.digests_failed and not result.dry_run:
        return 1
    return 0


def _cmd_source_health(args: argparse.Namespace) -> int:
    from datetime import timedelta

    from efilicit_ingestion.ops.source_health import (
        exit_code_for,
        fetch_latest_syncs,
        format_health_report,
        mark_stale,
    )
    from efilicit_ingestion.pipeline.postgres import connect

    if args.max_age_hours < 1:
        print("error: --max-age-hours must be >= 1", file=sys.stderr)
        return 2

    try:
        with connect() as conn:
            rows = fetch_latest_syncs(conn)
            rows = mark_stale(
                rows,
                max_age=timedelta(hours=int(args.max_age_hours)),
            )
    except Exception as exc:  # noqa: BLE001
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(format_health_report(rows))
    return exit_code_for(rows, fail_on_stale=bool(args.fail_on_stale))


if __name__ == "__main__":
    raise SystemExit(main())
