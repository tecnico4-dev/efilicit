"""Upsert canonical tenders / authorities / events / documents (Semana 2 Paso 7)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol
from uuid import uuid4

import psycopg
from psycopg.types.json import Json

from efilicit_ingestion.models import SourceRecord


@dataclass
class UpsertStats:
    seen: int = 0
    new: int = 0
    updated: int = 0
    tender_ids: list[str] = field(default_factory=list)


class CanonicalRepository(Protocol):
    def upsert_records(
        self,
        *,
        source_code: str,
        records: list[SourceRecord],
        artifact_id: str | None = None,
    ) -> UpsertStats:
        """Persist canonical rows. Idempotent on (source_code, source_tender_id)."""
        ...


class InMemoryCanonicalRepository:
    """In-memory canonical store for unit tests (no Postgres)."""

    def __init__(self) -> None:
        self.authorities: dict[str, dict[str, Any]] = {}
        self.tenders: dict[str, dict[str, Any]] = {}
        self.tender_sources: dict[tuple[str, str], dict[str, Any]] = {}
        self.events: list[dict[str, Any]] = []
        self.documents: list[dict[str, Any]] = []

    def upsert_records(
        self,
        *,
        source_code: str,
        records: list[SourceRecord],
        artifact_id: str | None = None,
    ) -> UpsertStats:
        stats = UpsertStats()
        for record in records:
            canonical = record.payload.get("canonical") or {}
            source_tender_id = canonical.get("source_tender_id") or record.source_record_id
            stats.seen += 1
            key = (source_code, source_tender_id)
            authority_id = self._upsert_authority(canonical.get("authority") or {})

            existing = self.tender_sources.get(key)
            if existing is None:
                tender_id = str(uuid4())
                self.tenders[tender_id] = _tender_row(canonical, authority_id)
                self.tender_sources[key] = {
                    "tender_id": tender_id,
                    "source_code": source_code,
                    "source_tender_id": source_tender_id,
                    "source_url": canonical.get("source_url"),
                    "artifact_id": artifact_id,
                }
                self.events.append(
                    {
                        "tender_id": tender_id,
                        "event_type": canonical.get("status") or "ingested",
                        "source_code": source_code,
                    }
                )
                if canonical.get("source_url"):
                    self.documents.append(
                        {
                            "tender_id": tender_id,
                            "title": canonical.get("title"),
                            "document_type": "publication",
                            "url": canonical.get("source_url"),
                            "source_code": source_code,
                            "artifact_id": artifact_id,
                        }
                    )
                stats.new += 1
                stats.tender_ids.append(tender_id)
            else:
                tender_id = existing["tender_id"]
                self.tenders[tender_id] = _tender_row(canonical, authority_id)
                existing["source_url"] = canonical.get("source_url")
                existing["artifact_id"] = artifact_id
                self.events.append(
                    {
                        "tender_id": tender_id,
                        "event_type": "updated",
                        "source_code": source_code,
                    }
                )
                stats.updated += 1
                stats.tender_ids.append(tender_id)
        return stats

    def _upsert_authority(self, authority: dict[str, Any]) -> str:
        tax_id = authority.get("tax_id")
        if tax_id:
            key = f"ES:{tax_id}"
            if key in self.authorities:
                self.authorities[key].update(authority)
                return self.authorities[key]["id"]
            auth_id = str(uuid4())
            self.authorities[key] = {"id": auth_id, **authority}
            return auth_id
        auth_id = str(uuid4())
        self.authorities[auth_id] = {"id": auth_id, **authority}
        return auth_id


class PostgresCanonicalRepository:
    """Writes canonical MVP tables using a trusted DB connection."""

    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def upsert_records(
        self,
        *,
        source_code: str,
        records: list[SourceRecord],
        artifact_id: str | None = None,
    ) -> UpsertStats:
        stats = UpsertStats()
        for record in records:
            canonical = record.payload.get("canonical")
            if not canonical:
                continue
            source_tender_id = canonical.get("source_tender_id") or record.source_record_id
            stats.seen += 1

            authority_id = self._upsert_authority(canonical.get("authority") or {})
            existing = self._conn.execute(
                """
                select tender_id
                from public.tender_sources
                where source_code = %s and source_tender_id = %s
                """,
                (source_code, source_tender_id),
            ).fetchone()

            if existing is None:
                tender_id = self._insert_tender(canonical, authority_id)
                self._insert_tender_source(
                    tender_id=tender_id,
                    source_code=source_code,
                    source_tender_id=source_tender_id,
                    source_url=canonical.get("source_url"),
                    artifact_id=artifact_id,
                )
                self._insert_event(
                    tender_id=tender_id,
                    event_type=canonical.get("status") or "ingested",
                    source_code=source_code,
                    payload={"source_tender_id": source_tender_id},
                    occurred_at=record.recorded_at,
                )
                self._maybe_insert_document(
                    tender_id=tender_id,
                    canonical=canonical,
                    source_code=source_code,
                    artifact_id=artifact_id,
                )
                stats.new += 1
                stats.tender_ids.append(tender_id)
            else:
                tender_id = str(existing[0])
                self._update_tender(tender_id, canonical, authority_id)
                self._touch_tender_source(
                    source_code=source_code,
                    source_tender_id=source_tender_id,
                    source_url=canonical.get("source_url"),
                    artifact_id=artifact_id,
                )
                self._insert_event(
                    tender_id=tender_id,
                    event_type="updated",
                    source_code=source_code,
                    payload={"source_tender_id": source_tender_id},
                    occurred_at=record.recorded_at,
                )
                self._maybe_insert_document(
                    tender_id=tender_id,
                    canonical=canonical,
                    source_code=source_code,
                    artifact_id=artifact_id,
                )
                stats.updated += 1
                stats.tender_ids.append(tender_id)
        return stats

    def _upsert_authority(self, authority: dict[str, Any]) -> str | None:
        name = (authority.get("name") or "Unknown authority").strip()
        tax_id = authority.get("tax_id")
        tax_id_country = authority.get("tax_id_country") or "ES"
        name_normalized = authority.get("name_normalized")
        confidence = authority.get("identity_confidence") or "UNRESOLVED"

        if tax_id:
            row = self._conn.execute(
                """
                insert into public.contracting_authorities (
                  tax_id, tax_id_country, name, name_normalized, identity_confidence
                )
                values (%s, %s, %s, %s, %s)
                on conflict (tax_id_country, tax_id) where (tax_id is not null)
                do update set
                  name = excluded.name,
                  name_normalized = excluded.name_normalized,
                  identity_confidence = excluded.identity_confidence,
                  updated_at = now()
                returning id
                """,
                (tax_id, tax_id_country, name, name_normalized, confidence),
            ).fetchone()
            assert row is not None
            return str(row[0])

        row = self._conn.execute(
            """
            insert into public.contracting_authorities (
              tax_id, tax_id_country, name, name_normalized, identity_confidence
            )
            values (null, %s, %s, %s, %s)
            returning id
            """,
            (tax_id_country, name, name_normalized, confidence),
        ).fetchone()
        assert row is not None
        return str(row[0])

    def _insert_tender(self, canonical: dict[str, Any], authority_id: str | None) -> str:
        row = self._conn.execute(
            """
            insert into public.tenders (
              title, description, status, procedure_type, contract_type,
              estimated_value, currency, cpv_code, publication_date, deadline_at,
              contracting_authority_id
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::uuid)
            returning id
            """,
            (
                canonical.get("title") or "Untitled",
                canonical.get("description"),
                canonical.get("status"),
                canonical.get("procedure_type"),
                canonical.get("contract_type"),
                canonical.get("estimated_value"),
                canonical.get("currency") or "EUR",
                canonical.get("cpv_code"),
                canonical.get("publication_date"),
                canonical.get("deadline_at"),
                authority_id,
            ),
        ).fetchone()
        assert row is not None
        return str(row[0])

    def _update_tender(
        self,
        tender_id: str,
        canonical: dict[str, Any],
        authority_id: str | None,
    ) -> None:
        self._conn.execute(
            """
            update public.tenders set
              title = %s,
              description = %s,
              status = %s,
              procedure_type = %s,
              contract_type = %s,
              estimated_value = %s,
              currency = %s,
              cpv_code = %s,
              publication_date = %s,
              deadline_at = %s,
              contracting_authority_id = %s::uuid,
              updated_at = now()
            where id = %s::uuid
            """,
            (
                canonical.get("title") or "Untitled",
                canonical.get("description"),
                canonical.get("status"),
                canonical.get("procedure_type"),
                canonical.get("contract_type"),
                canonical.get("estimated_value"),
                canonical.get("currency") or "EUR",
                canonical.get("cpv_code"),
                canonical.get("publication_date"),
                canonical.get("deadline_at"),
                authority_id,
                tender_id,
            ),
        )

    def _insert_tender_source(
        self,
        *,
        tender_id: str,
        source_code: str,
        source_tender_id: str,
        source_url: str | None,
        artifact_id: str | None,
    ) -> None:
        self._conn.execute(
            """
            insert into public.tender_sources (
              tender_id, source_code, source_tender_id, source_url, artifact_id
            )
            values (%s::uuid, %s, %s, %s, %s::uuid)
            """,
            (tender_id, source_code, source_tender_id, source_url, artifact_id),
        )

    def _touch_tender_source(
        self,
        *,
        source_code: str,
        source_tender_id: str,
        source_url: str | None,
        artifact_id: str | None,
    ) -> None:
        self._conn.execute(
            """
            update public.tender_sources set
              source_url = coalesce(%s, source_url),
              artifact_id = coalesce(%s::uuid, artifact_id),
              last_seen_at = now()
            where source_code = %s and source_tender_id = %s
            """,
            (source_url, artifact_id, source_code, source_tender_id),
        )

    def _insert_event(
        self,
        *,
        tender_id: str,
        event_type: str,
        source_code: str,
        payload: dict[str, Any],
        occurred_at: datetime | None,
    ) -> None:
        self._conn.execute(
            """
            insert into public.tender_events (
              tender_id, event_type, occurred_at, source_code, payload
            )
            values (%s::uuid, %s, coalesce(%s, now()), %s, %s)
            """,
            (tender_id, event_type, occurred_at, source_code, Json(payload)),
        )

    def _maybe_insert_document(
        self,
        *,
        tender_id: str,
        canonical: dict[str, Any],
        source_code: str,
        artifact_id: str | None,
    ) -> None:
        url = canonical.get("source_url")
        if not url:
            return
        exists = self._conn.execute(
            """
            select 1 from public.documents
            where tender_id = %s::uuid and url = %s
            limit 1
            """,
            (tender_id, url),
        ).fetchone()
        if exists:
            return
        self._conn.execute(
            """
            insert into public.documents (
              tender_id, title, document_type, url, source_code, artifact_id
            )
            values (%s::uuid, %s, 'publication', %s, %s, %s::uuid)
            """,
            (tender_id, canonical.get("title"), url, source_code, artifact_id),
        )


def _tender_row(canonical: dict[str, Any], authority_id: str) -> dict[str, Any]:
    return {
        "title": canonical.get("title"),
        "description": canonical.get("description"),
        "status": canonical.get("status"),
        "procedure_type": canonical.get("procedure_type"),
        "contract_type": canonical.get("contract_type"),
        "estimated_value": canonical.get("estimated_value"),
        "currency": canonical.get("currency") or "EUR",
        "cpv_code": canonical.get("cpv_code"),
        "publication_date": canonical.get("publication_date"),
        "deadline_at": canonical.get("deadline_at"),
        "contracting_authority_id": authority_id,
    }
