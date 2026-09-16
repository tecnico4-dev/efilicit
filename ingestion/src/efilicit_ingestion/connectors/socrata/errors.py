"""Errors for the Socrata / SODA HTTP adapter."""

from __future__ import annotations


class SocrataFetchError(Exception):
    """Base error while downloading a Socrata resource."""


class SocrataHttpError(SocrataFetchError):
    def __init__(self, status_code: int, url: str) -> None:
        self.status_code = status_code
        self.url = url
        super().__init__(f"HTTP {status_code} fetching {url}")


class ArtifactTooLargeError(SocrataFetchError):
    """Downloaded body exceeds the configured size budget."""


class SocrataParseError(ValueError):
    """Invalid JSON payload for a Socrata artifact."""
