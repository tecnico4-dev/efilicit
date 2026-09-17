"""Errors for the Euskadi / KontratazioA REST adapter."""

from __future__ import annotations


class EuskadiFetchError(Exception):
    """Base error while downloading an Euskadi procurements resource."""


class EuskadiHttpError(EuskadiFetchError):
    def __init__(self, status_code: int, url: str) -> None:
        self.status_code = status_code
        self.url = url
        super().__init__(f"HTTP {status_code} fetching {url}")


class ArtifactTooLargeError(EuskadiFetchError):
    """Downloaded body exceeds the configured size budget."""


class EuskadiParseError(ValueError):
    """Invalid JSON payload for an Euskadi artifact."""
