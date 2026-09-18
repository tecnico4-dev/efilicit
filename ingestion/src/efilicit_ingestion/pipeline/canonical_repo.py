"""Upsert canonical tenders / authorities / events / documents (Semana 2 Paso 7)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Callable, Protocol
from uuid import uuid4

import psycopg
from psycopg.types.json import Json

from efilicit_ingestion.models import SourceRecord
from efilicit_ingestion.pipeline.matching import (
    REVIEW_AUTO,
    REVIEW_PENDING,
    REVIEW_UNMATCHED,
    MatchCandidate,
    expediente_from_source_tender_id,
)


@dataclass
class UpsertStats:
    seen: int = 0
    new: int = 0
    updated: int = 0
    tender_ids: list[str] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class _MatchLink:
    """How upsert should link this source row to a canonical tender (Paso 6)."""

    review_status: str
    match_method: str | None
    match_score: float | None
    reuse_tender_id: str | None
    matched_at: datetime | None


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

    def find_match_candidates(
        self,
        *,
        exclude_source_code: str,
        tax_id: str | None = None,
        expediente: str | None = None,
        cpv_code: str | None = None,
        limit: int = 50,
    ) -> list[MatchCandidate]:
        """Candidates from other sources for cross-source matching (Semana 4)."""
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
                link = _match_link_from_payload(
                    record.payload,
                    tender_exists=lambda tid: tid in self.tenders,
                )
                if link.reuse_tender_id is not None:
                    tender_id = link.reuse_tender_id
                    self.tenders[tender_id] = _tender_row(canonical, authority_id)
                else:
                    tender_id = str(uuid4())
                    self.tenders[tender_id] = _tender_row(canonical, authority_id)
                self.tender_sources[key] = {
                    "tender_id": tender_id,
                    "source_code": source_code,
                    "source_tender_id": source_tender_id,
                    "source_url": canonical.get("source_url"),
                    "artifact_id": artifact_id,
                    "review_status": link.review_status,
                    "match_method": link.match_method,
                    "match_score": link.match_score,
                    "matched_at": link.matched_at,
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

    def find_match_candidates(
        self,
        *,
        exclude_source_code: str,
        tax_id: str | None = None,
        expediente: str | None = None,
        cpv_code: str | None = None,
        limit: int = 50,
    ) -> list[MatchCandidate]:
        out: list[MatchCandidate] = []
        seen_tenders: set[str] = set()
        for (src, source_tender_id), link in self.tender_sources.items():
            if src == exclude_source_code:
                continue
            tender_id = link["tender_id"]
            if tender_id in seen_tenders:
                continue
            tender = self.tenders.get(tender_id) or {}
            authority = self._authority_by_id(tender.get("contracting_authority_id"))
            cand_tax = authority.get("tax_id") if authority else None
            cand_exp = expediente_from_source_tender_id(source_tender_id)
            cand_cpv = tender.get("cpv_code")

            if tax_id and cand_tax == tax_id:
                pass
            elif expediente and cand_exp == expediente:
                pass
            elif cpv_code and cand_cpv == cpv_code:
                pass
            else:
                # Still include when no filters (broad scan) — but we always pass
                # at least one filter from match_records. Skip if none match.
                if tax_id or expediente or cpv_code:
                    continue

            out.append(
                MatchCandidate(
                    tender_id=tender_id,
                    source_code=src,
                    source_tender_id=source_tender_id,
                    title=tender.get("title"),
                    tax_id=cand_tax,
                    expediente=cand_exp,
                    cpv_code=cand_cpv,
                    estimated_value=_as_decimal(tender.get("estimated_value")),
                    publication_date=_as_date(tender.get("publication_date")),
                )
            )
            seen_tenders.add(tender_id)
            if len(out) >= limit:
                break
        return out

    def _authority_by_id(self, authority_id: str | None) -> dict[str, Any] | None:
        if not authority_id:
            return None
        for auth in self.authorities.values():
            if auth.get("id") == authority_id:
                return auth
        return None

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

    def find_match_candidates(
        self,
        *,
        exclude_source_code: str,
        tax_id: str | None = None,
        expediente: str | None = None,
        cpv_code: str | None = None,
        limit: int = 50,
    ) -> list[MatchCandidate]:
        clauses = ["ts.source_code <> %s"]
        params: list[Any] = [exclude_source_code]
        filters: list[str] = []
        if tax_id:
            filters.append("a.tax_id = %s")
            params.append(tax_id)
        if expediente:
            # source_tender_id may be ``tax:EXP`` or a bare expediente.
            filters.append(
                "(ts.source_tender_id = %s OR ts.source_tender_id LIKE %s)"
            )
            params.append(expediente)
            params.append(f"%:{expediente}")
        if cpv_code:
            filters.append("t.cpv_code = %s")
            params.append(cpv_code)
        if not filters:
            return []
        clauses.append("(" + " OR ".join(filters) + ")")
        params.append(limit)
        sql = f"""
            select distinct on (t.id)
              t.id::text,
              ts.source_code,
              ts.source_tender_id,
              t.title,
              a.tax_id,
              t.cpv_code,
              t.estimated_value,
              t.publication_date
            from public.tender_sources ts
            join public.tenders t on t.id = ts.tender_id
            left join public.contracting_authorities a
              on a.id = t.contracting_authority_id
            where {" AND ".join(clauses)}
            order by t.id, ts.last_seen_at desc
            limit %s
        """
        rows = self._conn.execute(sql, params).fetchall()
        out: list[MatchCandidate] = []
        for row in rows:
            source_tender_id = str(row[2])
            out.append(
                MatchCandidate(
                    tender_id=str(row[0]),
                    source_code=str(row[1]),
                    source_tender_id=source_tender_id,
                    title=row[3],
                    tax_id=row[4],
                    expediente=expediente_from_source_tender_id(source_tender_id)
                    or (
                        source_tender_id
                        if expediente and source_tender_id == expediente
                        else None
                    ),
                    cpv_code=row[5],
                    estimated_value=_as_decimal(row[6]),
                    publication_date=_as_date(row[7]),
                )
            )
        return out

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
                link = _match_link_from_payload(
                    record.payload,
                    tender_exists=self._tender_exists,
                )
                if link.reuse_tender_id is not None:
                    tender_id = link.reuse_tender_id
                    self._update_tender(tender_id, canonical, authority_id)
                else:
                    tender_id = self._insert_tender(canonical, authority_id)
                self._insert_tender_source(
                    tender_id=tender_id,
                    source_code=source_code,
                    source_tender_id=source_tender_id,
                    source_url=canonical.get("source_url"),
                    artifact_id=artifact_id,
                    review_status=link.review_status,
                    match_method=link.match_method,
                    match_score=link.match_score,
                    matched_at=link.matched_at,
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

    def _tender_exists(self, tender_id: str) -> bool:
        row = self._conn.execute(
            "select 1 from public.tenders where id = %s::uuid",
            (tender_id,),
        ).fetchone()
        return row is not None

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
        review_status: str = REVIEW_UNMATCHED,
        match_method: str | None = None,
        match_score: float | None = None,
        matched_at: datetime | None = None,
    ) -> None:
        self._conn.execute(
            """
            insert into public.tender_sources (
              tender_id, source_code, source_tender_id, source_url, artifact_id,
              review_status, match_method, match_score, matched_at
            )
            values (%s::uuid, %s, %s, %s, %s::uuid, %s, %s, %s, %s)
            """,
            (
                tender_id,
                source_code,
                source_tender_id,
                source_url,
                artifact_id,
                review_status,
                match_method,
                match_score,
                matched_at,
            ),
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


def _match_link_from_payload(
    payload: dict[str, Any] | None,
    *,
    tender_exists: Callable[[str], bool],
) -> _MatchLink:
    """Map ``payload['match']`` to upsert link behaviour (Semana 4 Paso 6)."""
    match = (payload or {}).get("match") or {}
    status = match.get("review_status") or REVIEW_UNMATCHED
    method = match.get("match_method")
    score = match.get("match_score")
    candidate = match.get("matched_tender_id")
    candidate_id = str(candidate) if candidate else None

    if status == REVIEW_AUTO and candidate_id and tender_exists(candidate_id):
        return _MatchLink(
            review_status=REVIEW_AUTO,
            match_method=method,
            match_score=float(score) if score is not None else None,
            reuse_tender_id=candidate_id,
            matched_at=datetime.now().astimezone(),
        )
    if status == REVIEW_AUTO:
        # Stale / missing target → do not invent a merge.
        return _MatchLink(
            review_status=REVIEW_UNMATCHED,
            match_method=None,
            match_score=None,
            reuse_tender_id=None,
            matched_at=None,
        )
    if status == REVIEW_PENDING:
        return _MatchLink(
            review_status=REVIEW_PENDING,
            match_method=method,
            match_score=float(score) if score is not None else None,
            reuse_tender_id=None,
            matched_at=datetime.now().astimezone(),
        )
    return _MatchLink(
        review_status=REVIEW_UNMATCHED,
        match_method=None,
        match_score=None,
        reuse_tender_id=None,
        matched_at=None,
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


def _as_decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except Exception:  # noqa: BLE001
        return None


def _as_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None
