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
    FAIL_CLOSED,
    RETRYABLE,
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
        existing = connection.execute(
            "select stage, error_class from provider_jobs where id=?",
            (job_id,),
        ).fetchone()
        if existing is not None:
            classification = str(existing["error_class"] or "").strip()
            if existing["stage"] == "failed_closed" or classification in FAIL_CLOSED:
                raise ProviderJobRecoveryError("fail_closed_reclaim_forbidden")
        blocked = connection.execute(
            f"""
            select id from provider_jobs
            where provider=? and project_id=? and id!=?
              and (
                stage='failed_closed'
                or error_class in ({",".join("?" for _ in FAIL_CLOSED)})
              )
            limit 1
            """,
            (provider, project_id, job_id, *sorted(FAIL_CLOSED)),
        ).fetchone()
        if blocked is not None:
            raise ProviderJobRecoveryError("fail_closed_identity_reuse_forbidden")
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
            where provider_jobs.stage != 'failed_closed'
              and provider_jobs.error_class not in (
                'not_configured',
                'adapter_not_implemented',
                'site_map_missing',
                'site_map_invalid',
                'gsc_property_not_authorised',
                'ambiguous_schema',
                'unknown'
              )
            """,
            (job_id, provider, project_id, attempt, stamp, stamp),
        )
        row = connection.execute("select * from provider_jobs where id=?", (job_id,)).fetchone()
        if row is None or row["stage"] == "failed_closed" or str(row["error_class"] or "").strip() in FAIL_CLOSED:
            raise ProviderJobRecoveryError("fail_closed_reclaim_forbidden")
        connection.execute("COMMIT")
        return dict(row)
    except Exception:
        connection.execute("ROLLBACK")
        raise
    finally:
        connection.close()


def record_attempt_failure(
    path: Path,
    job_id: str,
    error_class: str,
    now: datetime | None = None,
) -> dict:
    """Persist the failed attempt class while the job is still running.

    Recovery must read this class. A later caller cannot reclassify a
    fail-closed attempt as retryable.
    """
    classification = _persistable_class(error_class)
    stamp = _stamp(now)
    connection = _connect(path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        updated = connection.execute(
            """
            update provider_jobs
            set error_class=?, updated_at=?
            where id=? and stage='running'
            """,
            (classification, stamp, job_id),
        )
        if updated.rowcount != 1:
            raise ProviderJobRecoveryError("running_job_missing")
        row = connection.execute("select * from provider_jobs where id=?", (job_id,)).fetchone()
        connection.execute("COMMIT")
        return dict(row)
    except Exception:
        connection.execute("ROLLBACK")
        raise
    finally:
        connection.close()


def heartbeat_job(path: Path, job_id: str, now: datetime | None = None) -> dict:
    """Refresh a running job only while its persisted class is not fail-closed.

    A fail-closed class must not stay alive through heartbeat. The persisted
    class is not cleared. Scheduled portfolio sync stays disabled.
    """
    if not job_id:
        raise ProviderJobRecoveryError("job_identity_required")
    stamp = _stamp(now)
    connection = _connect(path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute("select * from provider_jobs where id=?", (job_id,)).fetchone()
        if row is None:
            raise ProviderJobRecoveryError("job_missing")
        classification = str(row["error_class"] or "").strip()
        if row["stage"] == "failed_closed" or classification in FAIL_CLOSED:
            raise ProviderJobRecoveryError("fail_closed_heartbeat_forbidden")
        if row["stage"] != "running":
            raise ProviderJobRecoveryError("heartbeat_requires_running")
        updated = connection.execute(
            """
            update provider_jobs
            set heartbeat_at=?, updated_at=?
            where id=? and stage='running' and error_class not in ('not_configured', 'adapter_not_implemented', 'site_map_missing', 'site_map_invalid', 'gsc_property_not_authorised', 'ambiguous_schema', 'unknown')
            """,
            (stamp, stamp, job_id),
        )
        if updated.rowcount != 1:
            raise ProviderJobRecoveryError("fail_closed_heartbeat_forbidden")
        current = connection.execute("select * from provider_jobs where id=?", (job_id,)).fetchone()
        connection.execute("COMMIT")
        return dict(current)
    except Exception:
        connection.execute("ROLLBACK")
        raise
    finally:
        connection.close()


def recover_stale_running(
    path: Path,
    now: datetime | None = None,
    stale_seconds: int = STALE_RUNNING_SECONDS,
    error_class: str | None = None,
) -> list[dict]:
    """Move crashed running jobs to the next fail-closed checkpoint.

    The class comes from the persisted failed attempt. A caller-supplied class
    is ignored so a restart cannot reclassify a fail-closed job as retryable.
    A missing persisted class fails closed as unknown.
    """
    if error_class is not None:
        # Accepted only so older call sites keep compiling. Not used.
        _persistable_class(error_class)
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
            persisted = str(row["error_class"] or "").strip()
            classification = persisted if persisted else "unknown"
            checkpoint = next_checkpoint("running", classification, int(row["attempt"]))
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


def _persistable_class(error_class: str) -> str:
    if not error_class or not str(error_class).strip():
        raise ProviderJobRecoveryError("error_class_required")
    raw = str(error_class).strip()
    if raw in RETRYABLE or raw in FAIL_CLOSED:
        return raw
    return "unknown"
