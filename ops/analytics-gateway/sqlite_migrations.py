#!/usr/bin/env python3
"""Shared SQLite schema coordinator for the Ms Robot analytics runtime DB.

Both the analytics gateway and GSC monitor must call ensure_analytics_schema()
before inspecting or writing tables. The coordinator serializes schema work
with BEGIN IMMEDIATE so concurrent startups cannot race legacy conversion.
"""
from __future__ import annotations

import os
import random
import sqlite3
import time

LEGACY_PROJECT_ID = "legacy"
SCHEMA_VERSION_KEY = "analytics_schema_version"
SCHEMA_VERSION = "provider-ledger-project-scope-v1"
DEFAULT_DEADLINE_SECONDS = 30
DEFAULT_BUSY_TIMEOUT_MS = 30000
WRITE_LOCK = "IMMEDIATE"
IDENT_CHARS = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_")


class AnalyticsSchemaMigrationError(RuntimeError):
    """Safe, path-free schema migration failure."""


class AnalyticsSchemaMigrationBusy(AnalyticsSchemaMigrationError):
    def __init__(self):
        super().__init__("analytics_schema_migration_busy")


class AmbiguousLegacySchemaError(AnalyticsSchemaMigrationError):
    def __init__(self, name):
        super().__init__(f"ambiguous_legacy_schema:{name}")


class UnknownLegacySchemaError(AnalyticsSchemaMigrationError):
    def __init__(self, name):
        super().__init__(f"unknown_legacy_schema:{name}")


class LegacyCopyIncompleteError(AnalyticsSchemaMigrationError):
    def __init__(self, name):
        super().__init__(f"legacy_copy_incomplete:{name}")


class CanonicalSchemaInvalidError(AnalyticsSchemaMigrationError):
    def __init__(self, name):
        super().__init__(f"canonical_schema_invalid:{name}")


def ident(name):
    if not name or any(char not in IDENT_CHARS for char in name) or name[0].isdigit():
        raise AnalyticsSchemaMigrationError("invalid_schema_identifier")
    return name


TABLE_SPECS = (
    {
        "name": "provider_state",
        "create_sql": """create table if not exists provider_state(
          project_id text not null, provider text not null, status text not null,
          auth_type text not null default '', capability text not null default 'read',
          last_success text, last_attempt text, last_error text, freshness text,
          enabled integer not null default 1, updated_at text not null,
          primary key(project_id,provider))""",
        "legacy_columns": (
            "provider", "status", "auth_type", "capability", "last_success",
            "last_attempt", "last_error", "freshness", "enabled", "updated_at",
        ),
        "required_legacy_columns": ("provider", "status", "updated_at"),
        "identity_columns": ("provider",),
        "required_columns": ("project_id", "provider", "status", "updated_at"),
        "required_unique": (("project_id", "provider"),),
    },
    {
        "name": "sync_run",
        "create_sql": """create table if not exists sync_run(
          id text primary key, project_id text not null, provider text not null,
          site text not null, window text not null, requested_start text, requested_end text,
          cursor_before text not null default '', cursor_after text not null default '',
          status text not null, retry_count integer not null default 0,
          rows_received integer not null default 0, rows_inserted integer not null default 0,
          rows_updated integer not null default 0, rows_skipped integer not null default 0,
          rows_written integer not null default 0, rate_limit_state text not null default '',
          quota_state text not null default '', error_class text, error_message_safe text,
          data_freshness text, idempotency_key text not null,
          code_version text not null default '', started_at text not null, finished_at text,
          unique(project_id,idempotency_key))""",
        "legacy_columns": (
            "id", "provider", "site", "window", "status", "retry_count",
            "rows_written", "idempotency_key", "started_at", "finished_at",
            "error_class", "requested_start", "requested_end", "cursor_before",
            "cursor_after", "rows_received", "rows_inserted", "rows_updated",
            "rows_skipped", "rate_limit_state", "quota_state", "error_message_safe",
            "data_freshness", "code_version",
        ),
        "required_legacy_columns": ("id", "provider", "site", "window", "status", "idempotency_key", "started_at"),
        "identity_columns": ("id",),
        "required_columns": (
            "id", "project_id", "provider", "site", "window", "status",
            "idempotency_key", "started_at", "quota_state", "rate_limit_state",
            "rows_received", "rows_inserted", "rows_updated", "rows_skipped",
            "requested_start", "requested_end", "cursor_before", "cursor_after",
            "error_message_safe", "data_freshness", "code_version",
        ),
        "required_unique": (("id",), ("project_id", "idempotency_key")),
    },
    {
        "name": "provider_metric",
        "create_sql": """create table if not exists provider_metric(
          id text primary key, project_id text not null, provider text not null,
          site text not null, dataset text not null, data_date text not null default '',
          dimensions text not null default '{}', metrics text not null default '{}',
          freshness text, sync_run_id text not null, updated_at text not null,
          unique(project_id,provider,site,dataset,data_date,dimensions))""",
        "legacy_columns": (
            "id", "provider", "site", "dataset", "data_date", "dimensions",
            "metrics", "freshness", "sync_run_id", "updated_at",
        ),
        "required_legacy_columns": ("id", "provider", "site", "dataset", "sync_run_id", "updated_at"),
        "identity_columns": ("id",),
        "required_columns": (
            "id", "project_id", "provider", "site", "dataset", "data_date",
            "dimensions", "metrics", "sync_run_id", "updated_at",
        ),
        "required_unique": (
            ("id",),
            ("project_id", "provider", "site", "dataset", "data_date", "dimensions"),
        ),
    },
    {
        "name": "provider_snapshot",
        "create_sql": """create table if not exists provider_snapshot(
          project_id text not null, provider text not null, site text not null,
          dataset text not null, payload text not null default '{}', freshness text,
          sync_run_id text not null, updated_at text not null,
          primary key(project_id,provider,site,dataset))""",
        "legacy_columns": (
            "provider", "site", "dataset", "payload", "freshness",
            "sync_run_id", "updated_at",
        ),
        "required_legacy_columns": ("provider", "site", "dataset", "sync_run_id", "updated_at"),
        "identity_columns": ("provider", "site", "dataset"),
        "required_columns": (
            "project_id", "provider", "site", "dataset", "payload",
            "sync_run_id", "updated_at",
        ),
        "required_unique": (("project_id", "provider", "site", "dataset"),),
    },
    {
        "name": "investigation",
        "create_sql": """create table if not exists investigation(
          id text primary key,
          project_id text not null,
          fingerprint text not null,
          site text not null,
          signal_type text not null,
          severity text not null,
          status text not null default 'open',
          source text not null default 'gsc',
          first_seen text not null,
          last_seen text not null,
          evidence text not null default '{}',
          unique(project_id,fingerprint))""",
        "legacy_columns": (
            "id", "fingerprint", "site", "signal_type", "severity", "status",
            "source", "first_seen", "last_seen", "evidence",
        ),
        "required_legacy_columns": ("id", "fingerprint", "site", "signal_type", "severity", "first_seen", "last_seen"),
        "identity_columns": ("id",),
        "required_columns": (
            "id", "project_id", "fingerprint", "site", "signal_type",
            "severity", "status", "source", "first_seen", "last_seen", "evidence",
        ),
        "required_unique": (("id",), ("project_id", "fingerprint")),
    },
)

INDEX_SQL = (
    "create index if not exists sync_run_project_started on sync_run(project_id,started_at desc)",
    "create index if not exists provider_metric_lookup on provider_metric(project_id,provider,site,dataset,data_date)",
    "create index if not exists investigation_project_site_status on investigation(project_id,site,status,last_seen)",
    "create unique index if not exists sync_run_project_idempotency on sync_run(project_id,idempotency_key)",
    "create unique index if not exists provider_metric_identity on provider_metric(project_id,provider,site,dataset,data_date,dimensions)",
    "create unique index if not exists investigation_project_fingerprint on investigation(project_id,fingerprint)",
    "create unique index if not exists provider_state_identity on provider_state(project_id,provider)",
    "create unique index if not exists provider_snapshot_identity on provider_snapshot(project_id,provider,site,dataset)",
)

ADDITIVE_SYNC_COLUMNS = {
    "requested_start": "text",
    "requested_end": "text",
    "cursor_before": "text not null default ''",
    "cursor_after": "text not null default ''",
    "rows_received": "integer not null default 0",
    "rows_inserted": "integer not null default 0",
    "rows_updated": "integer not null default 0",
    "rows_skipped": "integer not null default 0",
    "rate_limit_state": "text not null default ''",
    "quota_state": "text not null default ''",
    "error_message_safe": "text",
    "data_freshness": "text",
    "code_version": "text not null default ''",
}

REQUIRED_INDEX_NAMES = (
    "sync_run_project_started",
    "provider_metric_lookup",
    "investigation_project_site_status",
)


def shadow_name(table):
    return ident(f"{ident(table)}_legacy_scope")


def is_lock_error(exc):
    message = str(exc).lower()
    return "locked" in message or "busy" in message


def connect_for_migration(db_path, busy_timeout_ms=DEFAULT_BUSY_TIMEOUT_MS):
    connection = sqlite3.connect(db_path, timeout=max(1, busy_timeout_ms / 1000), isolation_level=None)
    connection.row_factory = sqlite3.Row
    connection.execute(f"PRAGMA busy_timeout={int(busy_timeout_ms)}")
    return connection


def begin_write_lock(connection, deadline_seconds=DEFAULT_DEADLINE_SECONDS, lock=WRITE_LOCK):
    if lock not in {"IMMEDIATE", "EXCLUSIVE"}:
        raise AnalyticsSchemaMigrationError("invalid_migration_lock")
    deadline = time.monotonic() + max(0.0, float(deadline_seconds))
    delay = 0.025
    while True:
        try:
            connection.execute(f"BEGIN {lock}")
            return
        except sqlite3.OperationalError as exc:
            if not is_lock_error(exc):
                raise
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise AnalyticsSchemaMigrationBusy() from exc
            sleep = min(delay, remaining, 0.5)
            time.sleep(sleep + random.uniform(0, sleep * 0.25))
            delay = min(delay * 2, 0.5)


def table_kind(connection, name):
    row = connection.execute(
        "select type from sqlite_master where name=?",
        (ident(name),),
    ).fetchone()
    return row["type"] if row else None


def table_columns(connection, name):
    return {
        row["name"]
        for row in connection.execute(f"pragma table_info({ident(name)})")
    }


def unique_key_sets(connection, name):
    keys = set()
    pk = []
    for row in connection.execute(f"pragma table_info({ident(name)})"):
        if row["pk"]:
            pk.append((row["pk"], row["name"]))
    if pk:
        keys.add(tuple(col for _, col in sorted(pk)))
    for index in connection.execute(f"pragma index_list({ident(name)})"):
        if not index["unique"]:
            continue
        columns = tuple(
            info["name"]
            for info in connection.execute(f"pragma index_info({ident(index['name'])})")
        )
        keys.add(columns)
    return keys


def require_table(connection, name):
    kind = table_kind(connection, name)
    if kind is None:
        return None
    if kind != "table":
        raise UnknownLegacySchemaError(name)
    return kind


def assert_legacy_shape(connection, spec, source_name):
    columns = table_columns(connection, source_name)
    missing = [column for column in spec["required_legacy_columns"] if column not in columns]
    if missing:
        raise UnknownLegacySchemaError(spec["name"])
    return columns


def copy_legacy_rows(connection, spec, source_name):
    existing = assert_legacy_shape(connection, spec, source_name)
    present = [column for column in spec["legacy_columns"] if column in existing]
    insert_columns = ["project_id", *present]
    select_sql = ", ".join(["?", *[ident(column) for column in present]])
    insert_sql = ", ".join(ident(column) for column in insert_columns)
    connection.execute(
        f"insert or ignore into {ident(spec['name'])} ({insert_sql}) "
        f"select {select_sql} from {ident(source_name)}",
        (LEGACY_PROJECT_ID,),
    )
    identity = spec["identity_columns"]
    where = " and ".join(["project_id=?", *[f"{ident(column)}=?" for column in identity]])
    for source in connection.execute(f"select * from {ident(source_name)}"):
        params = (LEGACY_PROJECT_ID, *[source[column] for column in identity])
        found = connection.execute(
            f"select 1 from {ident(spec['name'])} where {where}",
            params,
        ).fetchone()
        if found is None:
            raise LegacyCopyIncompleteError(spec["name"])


def drop_shadow(connection, name):
    connection.execute(f"drop table {shadow_name(name)}")


def reconcile_one(connection, spec):
    name = spec["name"]
    shadow = shadow_name(name)
    require_table(connection, name)
    require_table(connection, shadow)
    canonical_columns = table_columns(connection, name) if table_kind(connection, name) else set()
    shadow_exists = table_kind(connection, shadow) == "table"
    canonical_exists = bool(canonical_columns)
    scoped = "project_id" in canonical_columns

    if canonical_exists and not scoped and shadow_exists:
        raise AmbiguousLegacySchemaError(name)

    if canonical_exists and not scoped:
        assert_legacy_shape(connection, spec, name)
        connection.execute(f"alter table {ident(name)} rename to {shadow}")
        shadow_exists = True
        canonical_exists = False
        canonical_columns = set()

    if not canonical_exists:
        connection.execute(spec["create_sql"])

    if shadow_exists:
        copy_legacy_rows(connection, spec, shadow)
        drop_shadow(connection, name)


def ensure_additive_columns_and_indexes(connection):
    connection.execute(
        """create table if not exists analytics_schema_meta(
          key text primary key,
          value text not null)"""
    )
    if table_kind(connection, "sync_run") == "table":
        columns = table_columns(connection, "sync_run")
        for name, definition in ADDITIVE_SYNC_COLUMNS.items():
            if name not in columns:
                connection.execute(f"alter table sync_run add column {ident(name)} {definition}")
    for statement in INDEX_SQL:
        connection.execute(statement)


def validate_canonical_schema(connection):
    for spec in TABLE_SPECS:
        name = spec["name"]
        if table_kind(connection, name) != "table":
            raise CanonicalSchemaInvalidError(name)
        columns = table_columns(connection, name)
        if any(column not in columns for column in spec["required_columns"]):
            raise CanonicalSchemaInvalidError(name)
        if table_kind(connection, shadow_name(name)) is not None:
            raise CanonicalSchemaInvalidError(name)
        keys = unique_key_sets(connection, name)
        for required in spec["required_unique"]:
            if required not in keys:
                raise CanonicalSchemaInvalidError(name)
    index_names = {
        row["name"]
        for row in connection.execute(
            "select name from sqlite_master where type='index' and name is not null"
        )
    }
    if any(name not in index_names for name in REQUIRED_INDEX_NAMES):
        raise CanonicalSchemaInvalidError("indexes")


def write_schema_marker(connection):
    connection.execute(
        """insert into analytics_schema_meta(key,value) values(?,?)
           on conflict(key) do update set value=excluded.value""",
        (SCHEMA_VERSION_KEY, SCHEMA_VERSION),
    )


def ensure_analytics_schema(
    db_path,
    deadline_seconds=DEFAULT_DEADLINE_SECONDS,
    busy_timeout_ms=DEFAULT_BUSY_TIMEOUT_MS,
    lock=WRITE_LOCK,
):
    directory = os.path.dirname(os.path.abspath(db_path))
    if directory:
        os.makedirs(directory, exist_ok=True)
    connection = connect_for_migration(db_path, busy_timeout_ms=busy_timeout_ms)
    try:
        begin_write_lock(connection, deadline_seconds=deadline_seconds, lock=lock)
        try:
            for spec in TABLE_SPECS:
                reconcile_one(connection, spec)
            ensure_additive_columns_and_indexes(connection)
            validate_canonical_schema(connection)
            write_schema_marker(connection)
            connection.execute("COMMIT")
        except Exception:
            if connection.in_transaction:
                connection.execute("ROLLBACK")
            raise
    finally:
        connection.close()
