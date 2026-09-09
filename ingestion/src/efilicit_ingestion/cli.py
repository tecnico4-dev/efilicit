"""Minimal CLI for the ingestion engine.

Fase 0 only exposes --help / version. SourceConnector lands in Semana 1; real sources in Semana 2.
"""

from __future__ import annotations

import argparse
import sys

from efilicit_ingestion import __version__


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="efilicit-ingestion",
        description="EfiLicit ingestion CLI (SourceConnector contract in Semana 1; real sources later).",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    parser.parse_args(argv)
    parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
