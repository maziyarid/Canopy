#!/usr/bin/env python3
import json
from urllib.parse import urlparse

from gateway import DB, connection_test_gsc, create_or_run_sync, google_request, init_db, now
from gsc_monitor import ensure_schema, run_monitor
from monitor_dispatch import bridge_event


def site_key(site_url):
    raw = str(site_url or "").strip()
    if raw.startswith("sc-domain:"):
        return raw.split(":", 1)[1].lower().rstrip(".")
    if "://" in raw:
        return (urlparse(raw).hostname or raw).lower().removeprefix("www.").rstrip(".")
    return raw.lower().removeprefix("www.").strip("/").rstrip(".")


def main():
    init_db()
    ensure_schema(DB)
    connection = connection_test_gsc()
    sites = [
        site_key(item.get("siteUrl"))
        for item in connection.get("sites", [])
        if item.get("siteUrl")
    ]
    started = now()
    runs = []
    for site in sites:
        run, created = create_or_run_sync("gsc", site, "27d", started)
        runs.append(
            {
                "site": site,
                "status": run.get("status"),
                "rowsWritten": run.get("rows_written"),
                "errorClass": run.get("error_class"),
                "newRun": created,
            }
        )

    monitor = run_monitor(DB)
    bridge_receipts = []
    dispatch_error = None
    try:
        for signal in monitor.get("activeSignals", []):
            bridge_receipts.append(bridge_event(signal, "open"))
        for signal in monitor.get("resolvedSignals", []):
            bridge_receipts.append(bridge_event(signal, "resolved"))
    except Exception as exc:
        dispatch_error = f"{type(exc).__name__}:{str(exc)[:300]}"

    result = {
        "startedAt": started,
        "sites": sites,
        "runs": runs,
        "bridge": {
            "receipts": bridge_receipts,
            "error": dispatch_error,
        },
        "monitor": {
            "checkedAt": monitor.get("checkedAt"),
            "sites": monitor.get("sites"),
            "created": monitor.get("created"),
            "updated": monitor.get("updated"),
            "resolved": monitor.get("resolved"),
            "activeSignals": [
                {
                    "site": item.get("site"),
                    "signalType": item.get("signalType"),
                    "severity": item.get("severity"),
                }
                for item in monitor.get("activeSignals", [])
            ],
        },
    }
    print(json.dumps(result, separators=(",", ":"), sort_keys=True))

    failed = [run for run in runs if run["status"] not in ("completed",)]
    raise SystemExit(1 if failed or dispatch_error else 0)


if __name__ == "__main__":
    main()
