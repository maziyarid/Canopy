"""Durable provider-job restart recovery.

Records queue stages in SQLite and repairs stale running jobs after a crash.
Scheduled portfolio ingestion stays disabled. This module does not assign sites
or contact providers.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

from provider_retry_checkpoint import (
    SCHEDULED_PORTFOLIO_SYNC_ENABLED,
    ProviderRetryError,
    next_checkpoint,
)

STALE_RUNNING_SECONDS = 60


class ProviderJobRecoveryError(ProviderRetryError):
    pass


def _connect(path: Path) -> sqlite3.Connection:
    if SCHEDULED_PORTFOLIO_SYNC_ENABLED:
        raise ProviderJobRecoveryError("scheduled_portfolio_sync_forbidden")
    connection = sqlite3.connect(path, timeout=5, isolation_level=None)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA busy_timeout=5000")
    return connection


def ensure_job_schema(path: Path) -> None:
    connection = _connect(path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        connection.execute(
            """
            create table if not exists provider_jobs (
                id text primary key,
                provider text not null,
                project_id text not null,
                stage text not null,
                error_class text not null default '',
                attempt integer not null,
                heartbeat_at text,
                updated_at text not null
            )
            """
        )
        connection.execute("COMMIT")
    except Exception:
        connection.execute("ROLLBACK")
        raise
    finally:
        connection.close()


def record_running(
    path: Path,
    job_id: str,
    provider: str,
    project_id: str,
    attempt: int = 1,
    now: datetime | None = None,
) -> dict:
    if not job_id or not provider or not project_id:
        raise ProviderJobRecoveryError("job_identity_required")
    if project_id.strip() != project_id or not project_id.strip():
        raise ProviderJobRecoveryError("invalid_project_id")
    stamp = _stamp(now)
    connection = _connect(path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        connection.execute(
            """
            create table if not exists provider_jobs (
                id text primary key,
                provider text not null,
                project_id text not null,
                stage text not null,
                error_class text not null default '',
                attempt integer not null,
                heartbeat_at text,
                updated_at text not null
            )
            """
        )
        connection.execute(
            """
            insert into provider_jobs (
                id, provider, project_id, stage, error_class, attempt, heartbeat_at, updated_at
            ) values (?, ?, ?, 'running', '', ?, ?, ?)
            on conflict(id) do update set
                provider=excluded.provider,
                project_id=excluded.project_id,
                stage='running',
                error_class='',
                attempt=excluded.attempt,
                heartbeat_at=excluded.heartbeat_at,
                updated_at=excluded.updated_at
            """,
            (job_id, provider, project_id, attempt, stamp, stamp),
        )
        row = connection.execute("select * from provider_jobs where id=?", (job_id,)).fetchone()
        connection.execute("COMMIT")
        return dict(row)
    except Exception:
        connection.execute("ROLLBACK")
        raise
    finally:
        connection.close()


def recover_stale_running(
    path: Path,
    now: datetime | None = None,
    stale_seconds: int = STALE_RUNNING_SECONDS,
    error_class: str = "provider_unavailable",
) -> list[dict]:
    """Move crashed running jobs to the next fail-closed checkpoint.

    A job still inside the heartbeat window is left running. Retryable classes
    become retry_wait until the attempt bound; fail-closed classes never retry.
    """
    if stale_seconds < 1:
        raise ProviderJobRecoveryError("stale_window_required")
    moment = now or datetime.now(timezone.utc)
    cutoff = (moment - timedelta(seconds=stale_seconds)).isoformat()
    connection = _connect(path)
    recovered: list[dict] = []
    try:
        connection.execute("BEGIN IMMEDIATE")
        rows = connection.execute(
            """
            select * from provider_jobs
            where stage='running' and heartbeat_at < ?
            order by id
            """,
            (cutoff,),
        ).fetchall()
        stamp = _stamp(moment)
        for row in rows:
            checkpoint = next_checkpoint("running", error_class, int(row["attempt"]))
            connection.execute(
                """
                update provider_jobs
                set stage=?, error_class=?, attempt=?, heartbeat_at=?, updated_at=?
                where id=? and stage='running'
                """,
                (
                    checkpoint["stage"],
                    checkpoint["errorClass"],
                    checkpoint["attempt"],
                    stamp,
                    stamp,
                    row["id"],
                ),
            )
            updated = connection.execute(
                "select * from provider_jobs where id=?",
                (row["id"],),
            ).fetchone()
            recovered.append(dict(updated))
        connection.execute("COMMIT")
        return recovered
    except Exception:
        connection.execute("ROLLBACK")
        raise
    finally:
        connection.close()


def _stamp(moment: datetime | None) -> str:
    value = moment or datetime.now(timezone.utc)
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()
