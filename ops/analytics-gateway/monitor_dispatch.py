#!/usr/bin/env python3
import hashlib
import json
import os
from urllib.request import Request, urlopen

ANALYTICS_URL=os.getenv("ANALYTICS_GATEWAY_URL","http://127.0.0.1:9130").rstrip("/")
ANALYTICS_TOKEN=os.getenv("ANALYTICS_GATEWAY_TOKEN","")
BRIDGE_URL=os.getenv("MSROBOT_BRIDGE_URL","http://127.0.0.1:9110").rstrip("/")
BRIDGE_TOKEN=os.getenv("MSROBOT_BRIDGE_TOKEN","")

def request_json(url, token, method="GET", body=None):
    raw=None if body is None else json.dumps(body,separators=(",",":")).encode()
    headers={"Accept":"application/json","Authorization":"Bearer "+token}
    if raw is not None:
        headers["Content-Type"]="application/json"
    req=Request(url,data=raw,headers=headers,method=method)
    with urlopen(req,timeout=30) as response:
        return json.load(response)

def canonical_hash(value):
    raw=json.dumps(value,separators=(",",":"),sort_keys=True).encode()
    return hashlib.sha256(raw).hexdigest()
def bridge_event(signal, state):
    site=str(signal.get("site") or "")
    signal_type=str(signal.get("signalType") or "")
    evidence=signal.get("evidence") or {}
    base=hashlib.sha256(f"gsc:{site}:{signal_type}".encode()).hexdigest()
    evidence_hash=canonical_hash(evidence)
    payload={
        "provider":"gsc",
        "state":state,
        "signal_type":signal_type,
        "severity":signal.get("severity") or "medium",
        "evidence":evidence,
        "evidence_sha256":evidence_hash,
    }
    envelope={
        "schema_version":1,
        "idempotency_key":f"gsc:{base}:{state}:{evidence_hash[:24]}",
        "source":"ms_robot.analytics",
        "target":"ada",
        "event_type":"ms_robot.analytics.signal",
        "correlation_id":base,
        "site_key":site,
        "sensitivity":"internal",
        "payload":payload,
    }
    return request_json(BRIDGE_URL+"/v1/events",BRIDGE_TOKEN,"POST",envelope)
def main():
    if not ANALYTICS_TOKEN:
        raise SystemExit("ANALYTICS_GATEWAY_TOKEN is required")
    if not BRIDGE_TOKEN:
        raise SystemExit("MSROBOT_BRIDGE_TOKEN is required")

    monitor=request_json(
        ANALYTICS_URL+"/v1/monitor/gsc",
        ANALYTICS_TOKEN,
        "POST",
        {},
    )
    receipts=[]
    for signal in monitor.get("activeSignals") or []:
        receipts.append(bridge_event(signal,"open"))
    for signal in monitor.get("resolvedSignals") or []:
        receipts.append(bridge_event(signal,"resolved"))

    print(json.dumps({
        "checkedAt":monitor.get("checkedAt"),
        "sites":monitor.get("sites",0),
        "active":len(monitor.get("activeSignals") or []),
        "resolved":len(monitor.get("resolvedSignals") or []),
        "bridgeReceipts":receipts,
    },separators=(",",":")))

if __name__=="__main__":
    main()
