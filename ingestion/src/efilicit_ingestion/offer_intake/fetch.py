"""Descarga de pliegos desde la fuente oficial (servlet ``FileSystem`` de PLACSP).

Sin evasión de controles: UA identificado, sin cookies ni reintentos agresivos.
Una respuesta HTML (página de error / WAF) cuenta como fallo, no como documento.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

import httpx

from efilicit_ingestion import __version__

DEFAULT_MAX_BYTES = 40 * 1024 * 1024
USER_AGENT = f"efilicit-ingestion/{__version__} (offer-intake)"

_EXTENSIONS = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.oasis.opendocument.text": "odt",
    "application/zip": "zip",
    "application/x-zip-compressed": "zip",
}

_FILENAME_RE = re.compile(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)"?', re.IGNORECASE)


class DocumentFetchError(Exception):
    """El documento no se pudo descargar o no es un fichero válido."""


@dataclass(frozen=True, slots=True)
class FetchedDocument:
    raw: bytes
    content_type: str
    checksum: str
    extension: str
    filename: str | None

    @property
    def byte_size(self) -> int:
        return len(self.raw)


def fetch_document(
    client: httpx.Client,
    url: str,
    *,
    max_bytes: int = DEFAULT_MAX_BYTES,
) -> FetchedDocument:
    try:
        with client.stream("GET", url, headers={"User-Agent": USER_AGENT}) as response:
            if response.status_code >= 400:
                raise DocumentFetchError(f"HTTP {response.status_code}")
            content_type = (
                response.headers.get("content-type", "application/octet-stream")
                .split(";")[0]
                .strip()
                .lower()
            )
            if content_type.startswith("text/html"):
                raise DocumentFetchError("la fuente devolvió HTML, no un documento")
            declared = response.headers.get("content-length")
            if declared and declared.isdigit() and int(declared) > max_bytes:
                raise DocumentFetchError(f"documento demasiado grande ({declared} bytes)")
            chunks: list[bytes] = []
            total = 0
            for chunk in response.iter_bytes():
                total += len(chunk)
                if total > max_bytes:
                    raise DocumentFetchError(f"documento demasiado grande (> {max_bytes} bytes)")
                chunks.append(chunk)
            filename = _filename(response.headers.get("content-disposition"))
    except httpx.TimeoutException as exc:
        raise DocumentFetchError("timeout descargando el documento") from exc
    except httpx.TransportError as exc:
        raise DocumentFetchError(f"error de red: {exc}") from exc

    raw = b"".join(chunks)
    if not raw:
        raise DocumentFetchError("documento vacío")
    extension = _extension(content_type, filename, raw)
    if extension == "pdf":
        content_type = "application/pdf"
    return FetchedDocument(
        raw=raw,
        content_type=content_type,
        checksum=hashlib.sha256(raw).hexdigest(),
        extension=extension,
        filename=filename,
    )


def _filename(disposition: str | None) -> str | None:
    if not disposition:
        return None
    match = _FILENAME_RE.search(disposition)
    return match.group(1).strip() if match else None


def _extension(content_type: str, filename: str | None, raw: bytes) -> str:
    if content_type in _EXTENSIONS:
        return _EXTENSIONS[content_type]
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[1].lower()
        if ext.isalnum() and len(ext) <= 5:
            return ext
    if raw.startswith(b"%PDF"):
        return "pdf"
    return "bin"
