"""Upsert canónico: tenders / organisms / events / documents (Semana 2 Paso 7).

Idempotencia por ``(source_code, source_tender_id)`` dentro de una fuente.
Semana 4: además respeta ``payload['match']`` del Paso 5 —

- ``auto`` → reutiliza ``tenders.id`` y enlaza la nueva fuente;
- ``pending`` / ``unmatched`` → crea tender propio (no fusiona);
- en ``pending``, guarda el candidato best en ``match_candidate_tender_id`` (ADR 010).

ADR 015 — fuente ganadora: ``tenders`` es copia de una sola dueña
(``canonical_source_code``). Ranking fijo PLACSP > CCAA; secundaria solo
enlaza; promoción reemplaza la fila entera (sin mezcla campo a campo).

Re-ingesta sin cambios de contenido: actualiza ``tender_sources.last_seen_at``
(señal operativa “sigue viva”) pero **no** escribe ``tender_events`` ni mueve
``tenders.updated_at``. ``stats.updated`` cuenta solo cambios reales.

Sigue siendo el único punto de escritura canónica del ETL.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timezone
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

# ADR 015: menor número = mayor prioridad. Fuentes desconocidas → 1000.
SOURCE_PRIORITY: dict[str, int] = {
    "placsp": 10,
    "placsp_agregadas": 20,
    "placsp_menores": 30,
    "catalunya": 40,
    "euskadi": 50,
}
_DEFAULT_SOURCE_PRIORITY = 1000


def source_priority(source_code: str) -> int:
    """Prioridad numérica de ``source_code`` (menor = gana)."""
    return SOURCE_PRIORITY.get(source_code, _DEFAULT_SOURCE_PRIORITY)


def beats_canonical_owner(challenger: str, owner: str | None) -> bool:
    """True si ``challenger`` debe promoverse sobre la dueña actual."""
    if owner is None:
        return True
    return source_priority(challenger) < source_priority(owner)


def may_write_canonical_tender(source_code: str, owner: str | None) -> bool:
    """La fuente puede reescribir ``tenders`` si es dueña o la supera en ranking."""
    return owner == source_code or beats_canonical_owner(source_code, owner)


@dataclass
class UpsertStats:
    seen: int = 0
    new: int = 0
    updated: int = 0
    tender_ids: list[str] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class _MatchLink:
    """Decisión de enlace que aplica el upsert (Paso 6), ya resuelta desde el payload.

    - ``reuse_tender_id``: solo en ``auto`` (fusionar contra ese tender).
    - ``match_candidate_tender_id``: solo en ``pending`` (pista, no fusión; ADR 010).
    """

    review_status: str
    match_method: str | None
    match_score: float | None
    reuse_tender_id: str | None
    matched_at: datetime | None
    match_candidate_tender_id: str | None = None


class CanonicalRepository(Protocol):
    def upsert_records(
        self,
        *,
        source_code: str,
        records: list[SourceRecord],
        artifact_id: str | None = None,
    ) -> UpsertStats:
        """Persiste filas canónicas. Idempotente en ``(source_code, source_tender_id)``."""
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
        """Prefiltro de candidatos de otras fuentes (entrada del scorer Semana 4)."""
        ...


class InMemoryCanonicalRepository:
    """Almacén canónico en memoria para tests (sin Postgres).

    Implementa el mismo contrato de matching/upsert que Postgres para poder
    probar auto-merge, pending y candidato best sin red ni DB.
    """

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
                # Primera vista de esta fuente: aplicar auto/pending/unmatched.
                link = _match_link_from_payload(
                    record.payload,
                    tender_exists=lambda tid: tid in self.tenders,
                )
                if link.reuse_tender_id is not None:
                    tender_id = link.reuse_tender_id
                    owner = self.tenders[tender_id].get("canonical_source_code")
                    if may_write_canonical_tender(source_code, owner):
                        if (
                            owner != source_code
                            or _tender_content_differs(
                                self.tenders[tender_id], canonical, authority_id
                            )
                        ):
                            self.tenders[tender_id] = _tender_row(
                                canonical, authority_id, source_code
                            )
                else:
                    tender_id = str(uuid4())
                    self.tenders[tender_id] = _tender_row(
                        canonical, authority_id, source_code
                    )
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
                    "match_candidate_tender_id": link.match_candidate_tender_id,
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
                existing["source_url"] = canonical.get("source_url")
                existing["artifact_id"] = artifact_id
                existing["last_seen_at"] = datetime.now().astimezone()
                _apply_match_refresh_in_memory(existing, record.payload, self.tenders)
                owner = self.tenders[tender_id].get("canonical_source_code")
                if may_write_canonical_tender(source_code, owner):
                    owner_change = owner != source_code
                    content_change = _tender_content_differs(
                        self.tenders[tender_id], canonical, authority_id
                    )
                    if owner_change or content_change:
                        self.tenders[tender_id] = _tender_row(
                            canonical, authority_id, source_code
                        )
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
        """Misma semántica que Postgres: prefiltro por NIF / expediente / CPV.

        Sin ningún filtro no devolvemos el catálogo completo (evitar O(n) ciego
        en tests grandes). Deduplica por ``tender_id`` por si una licitación
        ya tiene varios ``tender_sources``.
        """
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
                # Con filtros activos y sin coincidencia → fuera del prefiltro.
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
        platform_id = authority.get("platform_id")
        if tax_id:
            key = f"ES:tax:{tax_id}"
            if key in self.authorities:
                self.authorities[key].update(authority)
                return self.authorities[key]["id"]
            auth_id = str(uuid4())
            self.authorities[key] = {"id": auth_id, **authority}
            return auth_id
        if platform_id:
            key = f"ES:plat:{platform_id}"
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
    """Escribe tablas canónicas MVP con una conexión confiable (p. ej. service_role).

    Incluye ``find_match_candidates`` para que el pipeline pueda deduplicar
    contra datos ya persistidos de otras fuentes antes del upsert.
    """

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
        """Prefiltro SQL: otras fuentes con mismo NIF, expediente o CPV.

        Sin filtros → lista vacía (no escanear toda ``tender_sources``).
        ``distinct on (t.id)`` evita duplicar el mismo tender canónico.
        """
        clauses = ["ts.source_code <> %s"]
        params: list[Any] = [exclude_source_code]
        filters: list[str] = []
        if tax_id:
            filters.append("a.tax_id = %s")
            params.append(tax_id)
        if expediente:
            # PLACSP suele guardar ``tax:EXP``; otras fuentes pueden traer el EXP suelto.
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
                # Primera vez que vemos (source_code, source_tender_id): aplicar match.
                link = _match_link_from_payload(
                    record.payload,
                    tender_exists=self._tender_exists,
                )
                if link.reuse_tender_id is not None:
                    # auto: reutilizar tender; solo reescribir si promovemos / somos dueña.
                    tender_id = link.reuse_tender_id
                    owner = self._canonical_owner(tender_id)
                    if may_write_canonical_tender(source_code, owner):
                        if owner != source_code or self._tender_row_differs(
                            tender_id, canonical, authority_id
                        ):
                            self._update_tender(
                                tender_id,
                                canonical,
                                authority_id,
                                canonical_source_code=source_code,
                            )
                else:
                    # pending / unmatched (o auto sin destino): tender nuevo.
                    tender_id = self._insert_tender(
                        canonical, authority_id, canonical_source_code=source_code
                    )
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
                    match_candidate_tender_id=link.match_candidate_tender_id,
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
                # Siempre: last_seen_at (y metadata de fuente). Negocio solo si dueña/promoción.
                self._touch_tender_source(
                    source_code=source_code,
                    source_tender_id=source_tender_id,
                    source_url=canonical.get("source_url"),
                    artifact_id=artifact_id,
                    payload=record.payload,
                )
                owner = self._canonical_owner(tender_id)
                if may_write_canonical_tender(source_code, owner):
                    owner_change = owner != source_code
                    content_change = self._tender_row_differs(
                        tender_id, canonical, authority_id
                    )
                    if owner_change or content_change:
                        self._update_tender(
                            tender_id,
                            canonical,
                            authority_id,
                            canonical_source_code=source_code,
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

    def _tender_row_differs(
        self,
        tender_id: str,
        canonical: dict[str, Any],
        authority_id: str | None,
    ) -> bool:
        row = self._conn.execute(
            """
            select title, description, status, procedure_type, contract_type,
                   estimated_value, currency, cpv_code, publication_date,
                   deadline_at, contracting_authority_id
            from public.tenders
            where id = %s::uuid
            """,
            (tender_id,),
        ).fetchone()
        if row is None:
            return True
        current = {
            "title": row[0],
            "description": row[1],
            "status": row[2],
            "procedure_type": row[3],
            "contract_type": row[4],
            "estimated_value": row[5],
            "currency": row[6],
            "cpv_code": row[7],
            "publication_date": row[8],
            "deadline_at": row[9],
            "contracting_authority_id": str(row[10]) if row[10] is not None else None,
        }
        return _tender_content_differs(current, canonical, authority_id)

    def _tender_exists(self, tender_id: str) -> bool:
        row = self._conn.execute(
            "select 1 from public.tenders where id = %s::uuid",
            (tender_id,),
        ).fetchone()
        return row is not None

    def _canonical_owner(self, tender_id: str) -> str | None:
        row = self._conn.execute(
            """
            select canonical_source_code
            from public.tenders
            where id = %s::uuid
            """,
            (tender_id,),
        ).fetchone()
        if row is None or row[0] is None:
            return None
        return str(row[0])

    def _upsert_authority(self, authority: dict[str, Any]) -> str | None:
        name = (authority.get("name") or "Unknown authority").strip()
        tax_id = authority.get("tax_id")
        tax_id_country = authority.get("tax_id_country") or "ES"
        platform_id = authority.get("platform_id")
        name_normalized = authority.get("name_normalized")
        confidence = authority.get("identity_confidence") or "UNRESOLVED"

        if tax_id:
            row = self._conn.execute(
                """
                insert into public.contracting_authorities (
                  tax_id, tax_id_country, platform_id, name, name_normalized,
                  identity_confidence
                )
                values (%s, %s, %s, %s, %s, %s)
                on conflict (tax_id_country, tax_id) where (tax_id is not null)
                do update set
                  name = excluded.name,
                  name_normalized = excluded.name_normalized,
                  identity_confidence = excluded.identity_confidence,
                  platform_id = coalesce(
                    excluded.platform_id, public.contracting_authorities.platform_id
                  ),
                  updated_at = now()
                returning id
                """,
                (
                    tax_id,
                    tax_id_country,
                    platform_id,
                    name,
                    name_normalized,
                    confidence,
                ),
            ).fetchone()
            assert row is not None
            return str(row[0])

        if platform_id:
            row = self._conn.execute(
                """
                insert into public.contracting_authorities (
                  tax_id, tax_id_country, platform_id, name, name_normalized,
                  identity_confidence
                )
                values (null, %s, %s, %s, %s, %s)
                on conflict (tax_id_country, platform_id)
                  where (platform_id is not null and tax_id is null)
                do update set
                  name = excluded.name,
                  name_normalized = excluded.name_normalized,
                  identity_confidence = excluded.identity_confidence,
                  updated_at = now()
                returning id
                """,
                (
                    tax_id_country,
                    platform_id,
                    name,
                    name_normalized,
                    confidence,
                ),
            ).fetchone()
            assert row is not None
            return str(row[0])

        row = self._conn.execute(
            """
            insert into public.contracting_authorities (
              tax_id, tax_id_country, platform_id, name, name_normalized,
              identity_confidence
            )
            values (null, %s, null, %s, %s, %s)
            returning id
            """,
            (tax_id_country, name, name_normalized, confidence),
        ).fetchone()
        assert row is not None
        return str(row[0])

    def _insert_tender(
        self,
        canonical: dict[str, Any],
        authority_id: str | None,
        *,
        canonical_source_code: str,
    ) -> str:
        row = self._conn.execute(
            """
            insert into public.tenders (
              title, description, status, procedure_type, contract_type,
              estimated_value, currency, cpv_code, publication_date, deadline_at,
              contracting_authority_id, canonical_source_code
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::uuid, %s)
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
                canonical_source_code,
            ),
        ).fetchone()
        assert row is not None
        return str(row[0])

    def _update_tender(
        self,
        tender_id: str,
        canonical: dict[str, Any],
        authority_id: str | None,
        *,
        canonical_source_code: str,
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
              canonical_source_code = %s,
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
                canonical_source_code,
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
        match_candidate_tender_id: str | None = None,
    ) -> None:
        self._conn.execute(
            """
            insert into public.tender_sources (
              tender_id, source_code, source_tender_id, source_url, artifact_id,
              review_status, match_method, match_score, matched_at,
              match_candidate_tender_id
            )
            values (%s::uuid, %s, %s, %s, %s::uuid, %s, %s, %s, %s, %s::uuid)
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
                match_candidate_tender_id,
            ),
        )

    def _touch_tender_source(
        self,
        *,
        source_code: str,
        source_tender_id: str,
        source_url: str | None,
        artifact_id: str | None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        link = _match_link_from_payload(
            payload,
            tender_exists=self._tender_exists,
        )
        # Re-ingesta: actualizar pista pending / limpiar si ya no hay candidato.
        # No tocamos review_status=auto ya fusionado (solo last_seen abajo).
        if link.review_status == REVIEW_PENDING:
            self._conn.execute(
                """
                update public.tender_sources set
                  source_url = coalesce(%s, source_url),
                  artifact_id = coalesce(%s::uuid, artifact_id),
                  last_seen_at = now(),
                  review_status = %s,
                  match_method = %s,
                  match_score = %s,
                  matched_at = %s,
                  match_candidate_tender_id = %s::uuid
                where source_code = %s and source_tender_id = %s
                """,
                (
                    source_url,
                    artifact_id,
                    REVIEW_PENDING,
                    link.match_method,
                    link.match_score,
                    link.matched_at,
                    link.match_candidate_tender_id,
                    source_code,
                    source_tender_id,
                ),
            )
            return

        if link.review_status == REVIEW_UNMATCHED:
            # Si antes estaba pending y ahora no hay match, limpiar metadatos
            # (incluido match_candidate_tender_id) sin borrar el enlace de fuente.
            self._conn.execute(
                """
                update public.tender_sources set
                  source_url = coalesce(%s, source_url),
                  artifact_id = coalesce(%s::uuid, artifact_id),
                  last_seen_at = now(),
                  review_status = case
                    when review_status = 'pending' then 'unmatched'
                    else review_status
                  end,
                  match_method = case
                    when review_status = 'pending' then null
                    else match_method
                  end,
                  match_score = case
                    when review_status = 'pending' then null
                    else match_score
                  end,
                  matched_at = case
                    when review_status = 'pending' then null
                    else matched_at
                  end,
                  match_candidate_tender_id = case
                    when review_status = 'pending' then null
                    else match_candidate_tender_id
                  end
                where source_code = %s and source_tender_id = %s
                """,
                (source_url, artifact_id, source_code, source_tender_id),
            )
            return

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
    """Traduce ``payload['match']`` a comportamiento de upsert (Paso 6).

    Aquí se separan los dos usos de ``matched_tender_id`` del matching:

    - ``auto`` → ``reuse_tender_id`` (fusionar);
    - ``pending`` → ``match_candidate_tender_id`` (solo pista; ADR 010).

    Si el auto apunta a un tender que ya no existe, degradamos a ``unmatched``
    en lugar de inventar una fusión.
    """
    match = (payload or {}).get("match") or {}
    status = match.get("review_status") or REVIEW_UNMATCHED
    method = match.get("match_method")
    score = match.get("match_score")
    candidate = match.get("matched_tender_id")
    candidate_id = str(candidate) if candidate else None
    if candidate_id and not tender_exists(candidate_id):
        candidate_id = None

    if status == REVIEW_AUTO and candidate_id and tender_exists(candidate_id):
        return _MatchLink(
            review_status=REVIEW_AUTO,
            match_method=method,
            match_score=float(score) if score is not None else None,
            reuse_tender_id=candidate_id,
            matched_at=datetime.now().astimezone(),
            match_candidate_tender_id=None,
        )
    if status == REVIEW_AUTO:
        # Destino obsoleto / ausente → no inventar fusión.
        return _MatchLink(
            review_status=REVIEW_UNMATCHED,
            match_method=None,
            match_score=None,
            reuse_tender_id=None,
            matched_at=None,
            match_candidate_tender_id=None,
        )
    if status == REVIEW_PENDING:
        return _MatchLink(
            review_status=REVIEW_PENDING,
            match_method=method,
            match_score=float(score) if score is not None else None,
            reuse_tender_id=None,
            matched_at=datetime.now().astimezone(),
            match_candidate_tender_id=candidate_id,
        )
    return _MatchLink(
        review_status=REVIEW_UNMATCHED,
        match_method=None,
        match_score=None,
        reuse_tender_id=None,
        matched_at=None,
        match_candidate_tender_id=None,
    )


def _apply_match_refresh_in_memory(
    existing: dict[str, Any],
    payload: dict[str, Any] | None,
    tenders: dict[str, dict[str, Any]],
) -> None:
    """Espejo en memoria de ``_touch_tender_source`` para tests de re-ingesta.

    Actualiza o limpia el candidato pending; no deshace un ``auto`` ya fusionado.
    """
    link = _match_link_from_payload(
        payload,
        tender_exists=lambda tid: tid in tenders,
    )
    if link.review_status == REVIEW_PENDING:
        existing["review_status"] = REVIEW_PENDING
        existing["match_method"] = link.match_method
        existing["match_score"] = link.match_score
        existing["matched_at"] = link.matched_at
        existing["match_candidate_tender_id"] = link.match_candidate_tender_id
        return
    if link.review_status == REVIEW_UNMATCHED and existing.get("review_status") == (
        REVIEW_PENDING
    ):
        existing["review_status"] = REVIEW_UNMATCHED
        existing["match_method"] = None
        existing["match_score"] = None
        existing["matched_at"] = None
        existing["match_candidate_tender_id"] = None

def _tender_row(
    canonical: dict[str, Any],
    authority_id: str,
    canonical_source_code: str,
) -> dict[str, Any]:
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
        "canonical_source_code": canonical_source_code,
    }


def _tender_content_differs(
    current: dict[str, Any],
    canonical: dict[str, Any],
    authority_id: str | None,
) -> bool:
    """True si los campos de negocio del tender cambian respecto a ``canonical``."""
    return _tender_compare_snapshot(current) != _tender_compare_snapshot(
        {
            "title": canonical.get("title") or "Untitled",
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
    )


def _tender_compare_snapshot(row: dict[str, Any]) -> tuple[Any, ...]:
    """Normaliza campos canónicos para comparar igualdad de contenido."""
    auth = row.get("contracting_authority_id")
    return (
        (row.get("title") or "Untitled"),
        row.get("description"),
        row.get("status"),
        row.get("procedure_type"),
        row.get("contract_type"),
        _as_decimal(row.get("estimated_value")),
        (row.get("currency") or "EUR"),
        row.get("cpv_code"),
        _as_date(row.get("publication_date")),
        _as_datetime(row.get("deadline_at")),
        str(auth) if auth is not None else None,
    )


def _as_datetime(value: Any) -> datetime | None:
    """Datetime comparable (UTC naive) para no marcar cambio por solo tzinfo."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, date):
        parsed = datetime(value.year, value.month, value.day)
    else:
        text = str(value).strip().replace("Z", "+00:00")
        if not text:
            return None
        try:
            parsed = datetime.fromisoformat(text)
        except ValueError:
            try:
                parsed = datetime.fromisoformat(f"{text[:10]}T00:00:00")
            except ValueError:
                return None
    if parsed.tzinfo is not None:
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


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
