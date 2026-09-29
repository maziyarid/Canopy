#!/usr/bin/env python3
import os
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from sqlite_migrations import (
    AmbiguousLegacySchemaError,
    AnalyticsSchemaMigrationBusy,
    SCHEMA_VERSION,
    SCHEMA_VERSION_KEY,
    UnknownLegacySchemaError,
    WRITE_LOCK,
    ensure_analytics_schema,
    shadow_name,
)

TABLES = (
    "provider_state",
    "sync_run",
    "provider_metric",
    "provider_snapshot",
    "investigation",
)

WORKER = r"""
import os, sys, time
from pathlib import Path
db_path, role, barrier, root = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
deadline = time.time() + 15
while not Path(barrier).exists():
    if time.time() > deadline:
        raise SystemExit("barrier_timeout")
    time.sleep(0.01)
sys.path.insert(0, root)
if role == "gateway":
    os.environ["ANALYTICS_GATEWAY_DB"] = db_path
    from gateway import init_db
    init_db()
elif role == "monitor":
    from gsc_monitor import ensure_schema
    ensure_schema(db_path)
else:
    raise SystemExit("unknown_role")
"""


def connect(path):
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    return connection


def build_legacy_db(path):
    with sqlite3.connect(path) as connection:
        connection.executescript(
            """
            create table provider_state(
              provider text primary key, status text not null, auth_type text not null default '',
              capability text not null default 'read', last_success text, last_attempt text,
              last_error text, freshness text, enabled integer not null default 1, updated_at text not null);
            create table sync_run(
              id text primary key, provider text not null, site text not null, window text not null,
              status text not null, retry_count integer not null default 0, rows_written integer not null default 0,
              idempotency_key text not null unique, started_at text not null, finished_at text, error_class text);
            create table provider_metric(
              id text primary key, provider text not null, site text not null, dataset text not null,
              data_date text not null default '', dimensions text not null default '{}',
              metrics text not null default '{}', freshness text, sync_run_id text not null,
              updated_at text not null,
              unique(provider,site,dataset,data_date,dimensions));
            create index provider_metric_lookup on provider_metric(provider,site,dataset,data_date);
            create table provider_snapshot(
              provider text not null, site text not null, dataset text not null,
              payload text not null default '{}', freshness text, sync_run_id text not null,
              updated_at text not null, primary key(provider,site,dataset));
            create table investigation(
              id text primary key, fingerprint text not null unique, site text not null,
              signal_type text not null, severity text not null, status text not null default 'open',
              source text not null default 'gsc', first_seen text not null, last_seen text not null,
              evidence text not null default '{}');
            create index investigation_site_status on investigation(site,status,last_seen);
            """
        )
        connection.execute(
            "insert into provider_state(provider,status,updated_at) values(?,?,?)",
            ("gsc", "ok", "2026-09-01T00:00:00Z"),
        )
        connection.execute(
            """insert into sync_run(id,provider,site,window,status,idempotency_key,started_at)
               values(?,?,?,?,?,?,?)""",
            ("run-1", "gsc", "legacy.example", "28d", "ok", "idem-1", "2026-09-01T00:00:00Z"),
        )
        connection.execute(
            """insert into provider_metric
               (id,provider,site,dataset,data_date,dimensions,metrics,freshness,sync_run_id,updated_at)
               values(?,?,?,?,?,?,?,?,?,?)""",
            (
                "metric-1", "gsc", "legacy.example", "site_daily", "2026-09-01",
                '{"date":"2026-09-01"}', '{"clicks":1}', "2026-09-01", "run-1",
                "2026-09-01T00:00:00Z",
            ),
        )
        connection.execute(
            """insert into provider_snapshot
               (provider,site,dataset,payload,freshness,sync_run_id,updated_at)
               values(?,?,?,?,?,?,?)""",
            ("gsc", "legacy.example", "sitemaps", "{}", "2026-09-01", "run-1", "2026-09-01T00:00:00Z"),
        )
        connection.execute(
            """insert into investigation
               (id,fingerprint,site,signal_type,severity,first_seen,last_seen,evidence)
               values(?,?,?,?,?,?,?,?)""",
            (
                "inv-1", "fp-1", "legacy.example", "traffic_click_drop", "high",
                "2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z", "{}",
            ),
        )


def table_names(connection):
    return {
        row["name"]
        for row in connection.execute("select name from sqlite_master where type='table'")
    }


def assert_migrated(test, path, expected_counts=None):
    expected_counts = expected_counts or {
        "provider_state": 1,
        "sync_run": 1,
        "provider_metric": 1,
        "provider_snapshot": 1,
        "investigation": 1,
    }
    with connect(path) as connection:
        names = table_names(connection)
        for table in TABLES:
            test.assertIn(table, names)
            test.assertNotIn(shadow_name(table), names)
            columns = {row["name"] for row in connection.execute(f"pragma table_info({table})")}
            test.assertIn("project_id", columns)
            unscoped = connection.execute(
                f"select count(*) as n from {table} where project_id is null or project_id=''"
            ).fetchone()["n"]
            test.assertEqual(unscoped, 0)
            count = connection.execute(f"select count(*) as n from {table}").fetchone()["n"]
            test.assertEqual(count, expected_counts[table])
            legacy = connection.execute(
                f"select count(*) as n from {table} where project_id='legacy'"
            ).fetchone()["n"]
            test.assertEqual(legacy, expected_counts[table])
        version = connection.execute(
            "select value from analytics_schema_meta where key=?",
            (SCHEMA_VERSION_KEY,),
        ).fetchone()["value"]
        test.assertEqual(version, SCHEMA_VERSION)
        index_sql = connection.execute(
            "select sql from sqlite_master where type='index' and name='provider_metric_lookup'"
        ).fetchone()[0]
        test.assertIn("project_id", index_sql)
        metric = connection.execute(
            "select project_id,site from provider_metric where id='metric-1'"
        ).fetchone()
        test.assertEqual(dict(metric), {"project_id": "legacy", "site": "legacy.example"})


def run_pair(path, barrier_dir):
    barrier = Path(barrier_dir) / "go"
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT)
    procs = []
    for role in ("gateway", "monitor"):
        procs.append(
            subprocess.Popen(
                [sys.executable, "-c", WORKER, str(path), role, str(barrier), str(ROOT)],
                env=env,
                cwd=str(ROOT),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
        )
    time.sleep(0.15)
    barrier.write_text("go")
    results = []
    for proc in procs:
        stdout, stderr = proc.communicate(timeout=30)
        results.append((proc.returncode, stdout, stderr))
    return results


class SqliteMigrationTests(unittest.TestCase):
    def test_lock_prefers_immediate(self):
        self.assertEqual(WRITE_LOCK, "IMMEDIATE")

    def test_concurrent_gateway_and_monitor_migrate_legacy_once(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "state.sqlite3"
            build_legacy_db(db_path)
            first = run_pair(db_path, tmp)
            for code, stdout, stderr in first:
                combined = f"{stdout}\n{stderr}".lower()
                self.assertEqual(code, 0, stderr)
                self.assertNotIn("database is locked", combined)
                self.assertNotIn("locked", combined)
                self.assertNotIn("traceback", combined)
            assert_migrated(self, db_path)

            second_dir = Path(tmp) / "second"
            second_dir.mkdir()
            second = run_pair(db_path, second_dir)
            for code, stdout, stderr in second:
                combined = f"{stdout}\n{stderr}".lower()
                self.assertEqual(code, 0, stderr)
                self.assertNotIn("database is locked", combined)
                self.assertNotIn("locked", combined)
                self.assertNotIn("traceback", combined)
            assert_migrated(self, db_path)

    def test_shadow_only_metric_recovers_without_second_create(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "state.sqlite3"
            with sqlite3.connect(db_path) as connection:
                connection.executescript(
                    """
                    create table provider_metric_legacy_scope(
                      id text primary key, provider text not null, site text not null,
                      dataset text not null, data_date text not null default '',
                      dimensions text not null default '{}', metrics text not null default '{}',
                      freshness text, sync_run_id text not null, updated_at text not null);
                    """
                )
                connection.execute(
                    """insert into provider_metric_legacy_scope
                       (id,provider,site,dataset,data_date,dimensions,metrics,freshness,sync_run_id,updated_at)
                       values(?,?,?,?,?,?,?,?,?,?)""",
                    (
                        "metric-1", "gsc", "legacy.example", "site_daily", "2026-09-01",
                        "{}", '{"clicks":1}', "2026-09-01", "run-1", "2026-09-01T00:00:00Z",
                    ),
                )
            ensure_analytics_schema(str(db_path))
            with connect(db_path) as connection:
                self.assertNotIn("provider_metric_legacy_scope", table_names(connection))
                row = connection.execute(
                    "select project_id,site from provider_metric where id='metric-1'"
                ).fetchone()
                self.assertEqual(dict(row), {"project_id": "legacy", "site": "legacy.example"})
                self.assertEqual(
                    connection.execute("select count(*) from provider_metric").fetchone()[0],
                    1,
                )

    def test_ambiguous_unscoped_and_shadow_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "state.sqlite3"
            with sqlite3.connect(db_path) as connection:
                connection.executescript(
                    """
                    create table provider_metric(
                      id text primary key, provider text not null, site text not null,
                      dataset text not null, data_date text not null default '',
                      dimensions text not null default '{}', metrics text not null default '{}',
                      freshness text, sync_run_id text not null, updated_at text not null);
                    create table provider_metric_legacy_scope(
                      id text primary key, provider text not null, site text not null,
                      dataset text not null, data_date text not null default '',
                      dimensions text not null default '{}', metrics text not null default '{}',
                      freshness text, sync_run_id text not null, updated_at text not null);
                    """
                )
                connection.execute(
                    """insert into provider_metric
                       (id,provider,site,dataset,sync_run_id,updated_at)
                       values('canonical','gsc','a.example','site_daily','run','t')"""
                )
                connection.execute(
                    """insert into provider_metric_legacy_scope
                       (id,provider,site,dataset,sync_run_id,updated_at)
                       values('shadow','gsc','b.example','site_daily','run','t')"""
                )
            with self.assertRaises(AmbiguousLegacySchemaError) as raised:
                ensure_analytics_schema(str(db_path))
            self.assertEqual(str(raised.exception), "ambiguous_legacy_schema:provider_metric")
            self.assertNotIn(str(db_path), str(raised.exception))
            with connect(db_path) as connection:
                names = table_names(connection)
                self.assertIn("provider_metric", names)
                self.assertIn("provider_metric_legacy_scope", names)
                columns = {
                    row["name"] for row in connection.execute("pragma table_info(provider_metric)")
                }
                self.assertNotIn("project_id", columns)
                ids = {
                    row["id"]
                    for row in connection.execute("select id from provider_metric")
                }
                shadow_ids = {
                    row["id"]
                    for row in connection.execute("select id from provider_metric_legacy_scope")
                }
                self.assertEqual(ids, {"canonical"})
                self.assertEqual(shadow_ids, {"shadow"})

    def test_busy_deadline_is_controlled_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "state.sqlite3"
            holder = sqlite3.connect(str(db_path), timeout=1, isolation_level=None)
            try:
                holder.execute("PRAGMA busy_timeout=1")
                holder.execute("BEGIN EXCLUSIVE")
                holder.execute("create table if not exists hold(x integer)")
                with self.assertRaises(AnalyticsSchemaMigrationBusy) as raised:
                    ensure_analytics_schema(
                        str(db_path),
                        deadline_seconds=0.25,
                        busy_timeout_ms=1,
                    )
                self.assertEqual(str(raised.exception), "analytics_schema_migration_busy")
                self.assertNotIn("database is locked", str(raised.exception).lower())
                self.assertNotIn(str(db_path), str(raised.exception))
            finally:
                holder.execute("ROLLBACK")
                holder.close()

    def test_fresh_database_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "state.sqlite3"
            ensure_analytics_schema(str(db_path))
            ensure_analytics_schema(str(db_path))
            with connect(db_path) as connection:
                for table in TABLES:
                    self.assertIn(table, table_names(connection))
                    self.assertNotIn(shadow_name(table), table_names(connection))
                version = connection.execute(
                    "select value from analytics_schema_meta where key=?",
                    (SCHEMA_VERSION_KEY,),
                ).fetchone()["value"]
                self.assertEqual(version, SCHEMA_VERSION)

    def test_unknown_unscoped_shape_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "state.sqlite3"
            with sqlite3.connect(db_path) as connection:
                connection.execute(
                    "create table provider_state(provider text primary key, extra text)"
                )
                connection.execute(
                    "insert into provider_state(provider,extra) values('gsc','keep-me')"
                )
            with self.assertRaises(UnknownLegacySchemaError) as raised:
                ensure_analytics_schema(str(db_path))
            self.assertEqual(str(raised.exception), "unknown_legacy_schema:provider_state")
            self.assertNotIn(str(db_path), str(raised.exception))
            with connect(db_path) as connection:
                columns = {
                    row["name"] for row in connection.execute("pragma table_info(provider_state)")
                }
                self.assertEqual(columns, {"provider", "extra"})
                self.assertNotIn("provider_state_legacy_scope", table_names(connection))
                self.assertEqual(
                    connection.execute("select extra from provider_state").fetchone()[0],
                    "keep-me",
                )

    def test_additive_quota_state_on_already_scoped_sync_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "state.sqlite3"
            with sqlite3.connect(db_path) as connection:
                connection.executescript(
                    """
                    create table sync_run(
                      id text primary key, project_id text not null, provider text not null,
                      site text not null, window text not null, status text not null,
                      idempotency_key text not null, started_at text not null,
                      unique(project_id,idempotency_key));
                    """
                )
                connection.execute(
                    """insert into sync_run(id,project_id,provider,site,window,status,idempotency_key,started_at)
                       values(?,?,?,?,?,?,?,?)""",
                    ("run-1", "project-a", "gsc", "a.example", "7d", "ok", "idem-1", "t"),
                )
            ensure_analytics_schema(str(db_path))
            with connect(db_path) as connection:
                columns = {
                    row["name"] for row in connection.execute("pragma table_info(sync_run)")
                }
                self.assertIn("quota_state", columns)
                self.assertIn("rate_limit_state", columns)
                self.assertIn("error_message_safe", columns)
                row = connection.execute(
                    "select project_id,quota_state from sync_run where id='run-1'"
                ).fetchone()
                self.assertEqual(row["project_id"], "project-a")
                self.assertEqual(row["quota_state"], "")


if __name__ == "__main__":
    unittest.main()
