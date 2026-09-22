#!/usr/bin/env python3
import hashlib
import json
import os
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BRIDGE_URL=os.getenv("MSROBOT_BRIDGE_URL","http://127.0.0.1:9110").rstrip("/")
BRIDGE_TOKEN=os.getenv("MSROBOT_BRIDGE_TOKEN","")
CONTROL_URL=os.getenv("CONTROL_CORE_URL","http://127.0.0.1:8770").rstrip("/")
CONTROL_TOKEN=os.getenv("CONTROL_API_TOKEN","")
AGIFLOW_TASK_ID=os.getenv("MSROBOT_GSC_AGIFLOW_TASK_ID","01M31WS9MWB3EN2PM7HKA7Q11J")
MAX_EVENTS=max(1,min(100,int(os.getenv("MSROBOT_EVENT_BATCH","20"))))

def request_json(url, token, method="GET", body=None):
    raw=None if body is None else json.dumps(body,separators=(",",":")).encode()
    headers={"Accept":"application/json","Authorization":"Bearer "+token}
    if raw is not None: headers["Content-Type"]="application/json"
    req=Request(url,data=raw,headers=headers,method=method)
    with urlopen(req,timeout=30) as response:
        return json.load(response)
def bridge_events():
    q=urlencode({"target":"ada","state":"queued","limit":MAX_EVENTS})
    body=request_json(BRIDGE_URL+"/v1/events?"+q,BRIDGE_TOKEN)
    return [
        event for event in body.get("events",[])
        if event.get("event_type")=="ms_robot.analytics.signal"
    ]

def marker_for(event):
    return "msrobot-analytics:"+str(event.get("event_id") or "")

def external_payload(event):
    payload=event.get("payload") or {}
    marker=marker_for(event)
    site=str(event.get("site_key") or "unknown")
    state=str(payload.get("state") or "open")
    signal=str(payload.get("signal_type") or "unknown")
    severity=str(payload.get("severity") or "medium")
    freshness=str((payload.get("evidence") or {}).get("freshness") or "unknown")
    content=(
        f"MS ROBOT ANALYTICS SIGNAL — {site}\n\n"
        f"state={state}\nsignal={signal}\nseverity={severity}\nfreshness={freshness}\n"
        f"bridge_event={event.get('event_id')}\ncorrelation={event.get('correlation_id')}\n\n"
        f"[sync:{marker}]"
    )
    return {
        "target_service":"agiflow",
        "entity_type":"task_comment",
        "entity_id":AGIFLOW_TASK_ID,
        "operation":"create_task_comment",
        "idempotency_key":marker,
        "stable_id":"agiflow:"+marker,
        "max_attempts":5,
        "payload":{
            "task_ref":AGIFLOW_TASK_ID,
            "content":content,
            "idempotency_key":marker,
        },
    }
def acknowledge(event_id):
    return request_json(
        BRIDGE_URL+f"/v1/events/{event_id}/ack",
        BRIDGE_TOKEN,
        "POST",
        {},
    )

def main():
    if not BRIDGE_TOKEN: raise SystemExit("MSROBOT_BRIDGE_TOKEN is required")
    if not CONTROL_TOKEN: raise SystemExit("CONTROL_API_TOKEN is required")
    queued=0; acked=0; results=[]
    for event in bridge_events():
        item=request_json(CONTROL_URL+"/external-sync",CONTROL_TOKEN,"POST",external_payload(event))
        queued+=1
        ack=acknowledge(str(event["event_id"]))
        acked+=1
        results.append({
            "eventId":event["event_id"],
            "externalStableId":item.get("stable_id"),
            "externalStatus":item.get("status"),
            "bridgeState":ack.get("state"),
        })
    print(json.dumps({"queued":queued,"acked":acked,"results":results},separators=(",",":")))

if __name__=="__main__":
    main()
