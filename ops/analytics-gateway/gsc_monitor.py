#!/usr/bin/env python3
import hashlib
import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone


def now():
    return datetime.now(timezone.utc).isoformat()


def thresholds_from_env():
    return {
        "click_drop_ratio": float(os.getenv("GSC_MONITOR_CLICK_DROP_RATIO", "0.60")),
        "impression_drop_ratio": float(os.getenv("GSC_MONITOR_IMPRESSION_DROP_RATIO", "0.65")),
        "surge_ratio": float(os.getenv("GSC_MONITOR_SURGE_RATIO", "1.75")),
        "min_previous_clicks": float(os.getenv("GSC_MONITOR_MIN_PREVIOUS_CLICKS", "20")),
        "min_previous_impressions": float(os.getenv("GSC_MONITOR_MIN_PREVIOUS_IMPRESSIONS", "500")),
    }


def connect(db_path):
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection


def ensure_schema(db_path):
    with connect(db_path) as connection:
        connection.executescript("""
        create table if not exists investigation(
          id text primary key,
          fingerprint text not null unique,
          site text not null,
          signal_type text not null,
          severity text not null,
          status text not null default 'open',
          source text not null default 'gsc',
          first_seen text not null,
          last_seen text not null,
          evidence text not null default '{}'
        );
        create index if not exists investigation_site_status
          on investigation(site,status,last_seen);
        """)


def fingerprint(site, signal_type):
    raw = f"gsc:{site}:{signal_type}".encode()
    return hashlib.sha256(raw).hexdigest()


def _totals(rows):
    clicks = 0.0
    impressions = 0.0
    for row in rows:
        metrics = json.loads(row["metrics"] or "{}")
        clicks += float(metrics.get("clicks") or 0)
        impressions += float(metrics.get("impressions") or 0)
    return clicks, impressions


def site_signals(db_path, site):
    thresholds = thresholds_from_env()
    with connect(db_path) as connection:
        daily = connection.execute(
            """select data_date,metrics,freshness
               from provider_metric
               where provider='gsc' and site=? and dataset='site_daily'
               order by data_date desc limit 14""",
            (site,),
        ).fetchall()
        sitemap = connection.execute(
            """select payload,freshness
               from provider_snapshot
               where provider='gsc' and site=? and dataset='sitemaps'""",
            (site,),
        ).fetchone()

    ordered = list(reversed(daily))
    signals = []

    if len(ordered) >= 14:
        previous = ordered[:7]
        recent = ordered[-7:]
        previous_clicks, previous_impressions = _totals(previous)
        recent_clicks, recent_impressions = _totals(recent)
        evidence = {
            "previous": {
                "start": previous[0]["data_date"],
                "end": previous[-1]["data_date"],
                "clicks": previous_clicks,
                "impressions": previous_impressions,
            },
            "recent": {
                "start": recent[0]["data_date"],
                "end": recent[-1]["data_date"],
                "clicks": recent_clicks,
                "impressions": recent_impressions,
            },
            "freshness": recent[-1]["freshness"],
        }

        if (
            previous_clicks >= thresholds["min_previous_clicks"]
            and recent_clicks <= previous_clicks * thresholds["click_drop_ratio"]
        ):
            signals.append(
                (
                    "traffic_click_drop",
                    "high",
                    {**evidence, "ratio": recent_clicks / previous_clicks},
                )
            )

        if (
            previous_impressions >= thresholds["min_previous_impressions"]
            and recent_impressions
            <= previous_impressions * thresholds["impression_drop_ratio"]
        ):
            signals.append(
                (
                    "traffic_impression_drop",
                    "high",
                    {**evidence, "ratio": recent_impressions / previous_impressions},
                )
            )

        click_surge = (
            previous_clicks >= thresholds["min_previous_clicks"]
            and recent_clicks >= previous_clicks * thresholds["surge_ratio"]
        )
        impression_surge = (
            previous_impressions >= thresholds["min_previous_impressions"]
            and recent_impressions >= previous_impressions * thresholds["surge_ratio"]
        )
        if click_surge or impression_surge:
            signals.append(
                (
                    "traffic_surge",
                    "medium",
                    {
                        **evidence,
                        "clickRatio": recent_clicks / previous_clicks
                        if previous_clicks
                        else None,
                        "impressionRatio": recent_impressions / previous_impressions
                        if previous_impressions
                        else None,
                    },
                )
            )

    if sitemap:
        payload = json.loads(sitemap["payload"] or "{}")
        rows = payload.get("sitemaps") or []
        errors = sum(int(item.get("errors") or 0) for item in rows)
        warnings = sum(int(item.get("warnings") or 0) for item in rows)
        if errors or warnings:
            signals.append(
                (
                    "sitemap_errors",
                    "high" if errors else "medium",
                    {
                        "errors": errors,
                        "warnings": warnings,
                        "freshness": sitemap["freshness"],
                        "sitemaps": [
                            {
                                "path": item.get("path"),
                                "errors": int(item.get("errors") or 0),
                                "warnings": int(item.get("warnings") or 0),
                            }
                            for item in rows
                        ],
                    },
                )
            )

    return signals


def run_monitor(db_path):
    ensure_schema(db_path)
    observed = now()
    with connect(db_path) as connection:
        sites = [
            row["site"]
            for row in connection.execute(
                """select distinct site from provider_metric
                   where provider='gsc' and dataset='site_daily'
                   order by site"""
            )
        ]

    created = 0
    updated = 0
    resolved = 0
    active = []
    resolved_items = []

    for site in sites:
        signals = site_signals(db_path, site)
        current = set()

        with connect(db_path) as connection:
            for signal_type, severity, evidence in signals:
                fp = fingerprint(site, signal_type)
                current.add(fp)
                existing = connection.execute(
                    "select id from investigation where fingerprint=?",
                    (fp,),
                ).fetchone()
                payload = json.dumps(evidence, separators=(",", ":"), sort_keys=True)
                if existing:
                    connection.execute(
                        """update investigation
                           set severity=?,status='open',last_seen=?,evidence=?
                           where fingerprint=?""",
                        (severity, observed, payload, fp),
                    )
                    updated += 1
                else:
                    connection.execute(
                        """insert into investigation
                           (id,fingerprint,site,signal_type,severity,status,source,
                            first_seen,last_seen,evidence)
                           values(?,?,?,?,?,'open','gsc',?,?,?)""",
                        (
                            str(uuid.uuid4()),
                            fp,
                            site,
                            signal_type,
                            severity,
                            observed,
                            observed,
                            payload,
                        ),
                    )
                    created += 1

                active.append(
                    {
                        "site": site,
                        "signalType": signal_type,
                        "severity": severity,
                        "evidence": evidence,
                    }
                )

            open_rows = connection.execute(
                """select fingerprint,signal_type,severity,evidence from investigation
                   where source='gsc' and site=? and status='open'""",
                (site,),
            ).fetchall()
            for row in open_rows:
                if row["fingerprint"] not in current:
                    connection.execute(
                        """update investigation
                           set status='resolved',last_seen=?
                           where fingerprint=?""",
                        (observed, row["fingerprint"]),
                    )
                    resolved += 1
                    resolved_items.append({
                        "site": site,
                        "signalType": row["signal_type"],
                        "severity": row["severity"],
                        "evidence": json.loads(row["evidence"] or "{}"),
                    })

    return {
        "checkedAt": observed,
        "sites": len(sites),
        "activeSignals": active,
        "created": created,
        "updated": updated,
        "resolved": resolved,
        "resolvedSignals": resolved_items,
        "thresholds": thresholds_from_env(),
    }


def list_investigations(db_path, site="", status="", limit=100):
    ensure_schema(db_path)
    query = (
        "select id,fingerprint,site,signal_type,severity,status,source,"
        "first_seen,last_seen,evidence from investigation where 1=1"
    )
    params = []
    if site:
        query += " and site=?"
        params.append(site)
    if status:
        query += " and status=?"
        params.append(status)
    query += " order by last_seen desc limit ?"
    params.append(max(1, min(500, int(limit))))

    with connect(db_path) as connection:
        rows = connection.execute(query, params).fetchall()

    output = []
    for row in rows:
        item = dict(row)
        item["evidence"] = json.loads(item["evidence"] or "{}")
        output.append(item)
    return output
