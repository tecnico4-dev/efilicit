"""PLACSP fetch errors (controlled, classifiable)."""

from __future__ import annotations


class PlacspFetchError(Exception):
    """Base error for PLACSP download failures."""


class ArtifactTooLargeError(PlacspFetchError):
    """Remote payload exceeds the configured size budget."""


class PlacspHttpError(PlacspFetchError):
    """Non-success HTTP response from the official syndication host."""

    def __init__(self, status_code: int, url: str) -> None:
        self.status_code = status_code
        self.url = url
        super().__init__(f"HTTP {status_code} fetching {url}")
