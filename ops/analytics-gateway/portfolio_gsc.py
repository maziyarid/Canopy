#!/usr/bin/env python3
import json
import os
import re
from urllib.parse import urlparse

from gateway import DB, create_or_run_sync, google_request, init_db, now
from gsc_monitor import ensure_schema, run_monitor
from monitor_dispatch import bridge_event


PROJECT_ID_PATTERN=re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")


def site_key(site_url):
    raw = str(site_url or "").strip()
    if raw.startswith("sc-domain:"):
        return raw.split(":", 1)[1].lower().rstrip(".")
    if "://" in raw:
        return (urlparse(raw).hostname or raw).lower().removeprefix("www.").rstrip(".")
    return raw.lower().removeprefix("www.").strip("/").rstrip(".")


def project_site_map(env=os.environ):
    raw=env.get("MS_ROBOT_PROJECT_SITE_MAP_JSON","").strip()
    if not raw:
        raise SystemExit("MS_ROBOT_PROJECT_SITE_MAP_JSON is required")
    try:
        parsed=json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SystemExit("MS_ROBOT_PROJECT_SITE_MAP_JSON must be valid JSON") from exc
    if not isinstance(parsed,dict) or not parsed:
        raise SystemExit("MS_ROBOT_PROJECT_SITE_MAP_JSON must be a non-empty object")

    output={}
    for raw_site,raw_project in parsed.items():
        site=site_key(raw_site)
        project_id=str(raw_project or "").strip()
        if not site:
            raise SystemExit("MS_ROBOT_PROJECT_SITE_MAP_JSON contains an empty site")
        if not PROJECT_ID_PATTERN.fullmatch(project_id):
            raise SystemExit(f"invalid project id for mapped site {site}")
        if site in output and output[site]!=project_id:
            raise SystemExit(f"site {site} is mapped to more than one project")
        output[site]=project_id
    return output


def main():
    init_db()
    ensure_schema(DB)
    mapping=project_site_map()
    discovery=google_request("/v1/sites")
    authorised={
        site_key(item.get("siteUrl")): item.get("siteUrl")
        for item in discovery.get("sites", [])
        if item.get("siteUrl")
    }

    started=now()
    runs=[]
    unavailable=[]
    touched_projects=set()

    for site,project_id in sorted(mapping.items()):
        if site not in authorised:
            unavailable.append({"site":site,"projectId":project_id,"error":"gsc_property_not_authorised"})
            continue
        run,created=create_or_run_sync(project_id,"gsc",site,"27d",started)
        touched_projects.add(project_id)
        runs.append({
            "projectId":project_id,
            "site":site,
            "status":run.get("status"),
            "rowsWritten":run.get("rows_written"),
            "errorClass":run.get("error_class"),
            "newRun":created,
        })

    monitors=[]
    bridge_receipts=[]
    dispatch_error=None
    try:
        for project_id in sorted(touched_projects):
            monitor=run_monitor(DB,project_id)
            monitors.append({"projectId":project_id,**monitor})
            for signal in monitor.get("activeSignals", []):
                bridge_receipts.append(bridge_event(signal,"open"))
            for signal in monitor.get("resolvedSignals", []):
                bridge_receipts.append(bridge_event(signal,"resolved"))
    except Exception as exc:
        dispatch_error=f"{type(exc).__name__}:{str(exc)[:300]}"

    result={
        "startedAt":started,
        "mappedSites":len(mapping),
        "authorisedSites":len(authorised),
        "runs":runs,
        "unavailable":unavailable,
        "bridge":{
            "receipts":bridge_receipts,
            "error":dispatch_error,
        },
        "monitors":[
            {
                "projectId":item.get("projectId"),
                "checkedAt":item.get("checkedAt"),
                "sites":item.get("sites"),
                "created":item.get("created"),
                "updated":item.get("updated"),
                "resolved":item.get("resolved"),
                "activeSignals":[
                    {
                        "projectId":signal.get("projectId"),
                        "site":signal.get("site"),
                        "signalType":signal.get("signalType"),
                        "severity":signal.get("severity"),
                    }
                    for signal in item.get("activeSignals", [])
                ],
            }
            for item in monitors
        ],
    }
    print(json.dumps(result,separators=(",",":"),sort_keys=True))

    failed=[run for run in runs if run["status"]!="completed"]
    raise SystemExit(1 if failed or unavailable or dispatch_error else 0)


if __name__=="__main__":
    main()
