"""Persistencia Postgres de ``source_sync`` / ``source_artifacts`` (Semana 1 Paso 7).

Bitácora ETL, no el canónico de licitaciones. Conexión directa con rol
confiable (postgres / service), nunca la clave ``anon`` del navegador.

No escribe en ``public.errors``: un fallo de corrida cierra el run en
``source_sync`` (``status`` / ``error_message``). Ver ADR 003.
"""

from __future__ import annotations

import psycopg

from efilicit_ingestion.pipeline.types import StoredArtifact, SyncRun, utc_now


def persist_failed_sync_run(run: SyncRun) -> None:
    """Persiste (o reescribe) una corrida ``failed`` en transacción propia.

    Tras un rollback del upsert, la fila ``running`` desaparece: hay que
    volver a insertar por ``(source_code, run_id)`` con el estado final.
    """
    finished_at = run.finished_at or utc_now()
    with connect() as conn:
        conn.execute(
            """
            insert into public.source_sync (
              source_code, run_id, status, cursor, last_artifact, checksum,
              records_seen, records_new, records_updated, records_failed,
              error_message, started_at, finished_at
            )
            values (
              %s, %s, 'failed', %s, %s, %s,
              %s, %s, %s, %s,
              %s, %s, %s
            )
            on conflict (source_code, run_id) do update set
              status = 'failed',
              cursor = excluded.cursor,
              last_artifact = excluded.last_artifact,
              checksum = excluded.checksum,
              records_seen = excluded.records_seen,
              records_new = excluded.records_new,
              records_updated = excluded.records_updated,
              records_failed = excluded.records_failed,
              error_message = excluded.error_message,
              finished_at = excluded.finished_at
            """,
            (
                run.source_code,
                run.run_id,
                run.cursor,
                run.last_artifact,
                run.checksum,
                run.records_seen,
                run.records_new,
                run.records_updated,
                max(run.records_failed, 1),
                run.error_message,
                run.started_at,
                finished_at,
            ),
        )
        conn.commit()



class PostgresSyncRepository:
    """Implementación real de ``SyncRepository`` contra Postgres local/remoto."""

    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def start_run(self, *, source_code: str, run_id: str, cursor: str | None) -> SyncRun:
        """Inserta fila ``running``; el unique ``(source_code, run_id)`` evita choques."""
        row = self._conn.execute(
            """
            insert into public.source_sync (source_code, run_id, status, cursor)
            values (%s, %s, 'running', %s)
            returning id, started_at
            """,
            (source_code, run_id, cursor),
        ).fetchone()
        assert row is not None
        sync_id, started_at = row
        return SyncRun(
            id=str(sync_id),
            source_code=source_code,
            run_id=run_id,
            cursor=cursor,
            started_at=started_at,
        )

    def register_artifact(self, run: SyncRun, stored: StoredArtifact) -> str | None:
        """Upsert de metadatos por ``(source_code, artifact_key)``.

        Reejecutar el mismo artefacto actualiza checksum/ruta y el ``sync_id``
        de la corrida actual (evidencia ligada al último run que lo bajó).
        """
        if run.id is None:
            raise ValueError("sync run is missing database id")

        run.artifacts.append(stored)
        run.last_artifact = stored.artifact_key
        run.checksum = stored.checksum

        row = self._conn.execute(
            """
            insert into public.source_artifacts (
              source_code,
              sync_id,
              artifact_key,
              storage_path,
              checksum,
              byte_size,
              content_type,
              source_url
            )
            values (%s, %s::uuid, %s, %s, %s, %s, %s, %s)
            on conflict (source_code, artifact_key) do update set
              sync_id = excluded.sync_id,
              storage_path = excluded.storage_path,
              checksum = excluded.checksum,
              byte_size = excluded.byte_size,
              content_type = excluded.content_type,
              source_url = excluded.source_url,
              downloaded_at = now()
            returning id
            """,
            (
                run.source_code,
                run.id,
                stored.artifact_key,
                stored.storage_path,
                stored.checksum,
                stored.byte_size,
                stored.content_type,
                stored.source_url,
            ),
        ).fetchone()
        assert row is not None
        return str(row[0])

    def finish_run(
        self,
        run: SyncRun,
        *,
        status: str,
        error_message: str | None = None,
    ) -> SyncRun:
        """Persiste estado final + contadores; ``error_message`` solo si falló."""
        if run.id is None:
            raise ValueError("sync run is missing database id")

        run.status = status
        run.error_message = error_message
        run.finished_at = utc_now()

        self._conn.execute(
            """
            update public.source_sync
            set
              status = %s,
              finished_at = %s,
              cursor = %s,
              last_artifact = %s,
              checksum = %s,
              records_seen = %s,
              records_new = %s,
              records_updated = %s,
              records_failed = %s,
              error_message = %s
            where id = %s::uuid
            """,
            (
                run.status,
                run.finished_at,
                run.cursor,
                run.last_artifact,
                run.checksum,
                run.records_seen,
                run.records_new,
                run.records_updated,
                run.records_failed,
                run.error_message,
                run.id,
            ),
        )
        return run


def default_database_url() -> str:
    """URL de Postgres local de Supabase (override: ``EFILICIT_DATABASE_URL``)."""
    import os

    return os.environ.get(
        "EFILICIT_DATABASE_URL",
        "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    )


def connect(database_url: str | None = None) -> psycopg.Connection:
    """Abre conexión psycopg (caller hace commit/rollback)."""
    return psycopg.connect(database_url or default_database_url())
