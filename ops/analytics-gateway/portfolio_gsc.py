#!/usr/bin/env python3
import ipaddress
import json
import os
import re
import unicodedata
from urllib.parse import unquote, urlparse

from gateway import DB, create_or_run_sync, google_request, init_db, now
from provider_retry_checkpoint import checkpoint_for_sync_failure
from gsc_monitor import ensure_schema, run_monitor
from monitor_dispatch import bridge_event


PROJECT_ID_PATTERN=re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
RESERVED_PROJECT_IDS=frozenset({"legacy"})
WRITABLE_GSC_PERMISSIONS=frozenset({"siteOwner", "siteFullUser"})


def strip_port(host):
    # A mapped port is not a second site identity. Bracketed IPv6 keeps its address.
    host = str(host or "")
    if host.startswith("["):
        end = host.find("]")
        return host[1:end] if end > 1 else host
    if host.count(":") == 1:
        name, port = host.rsplit(":", 1)
        if port.isdigit():
            return name
    return host


def decode_host(host):
    # A percent-encoded label is not a second site identity. One decode only;
    # a leftover % is ambiguous and fails closed without echoing the raw key.
    decoded = unquote(str(host or ""))
    if "%" in decoded:
        raise SystemExit("invalid site host")
    return decoded


def assert_hostname(host):
    # One decode must leave a hostname, not a second identity via scheme, path,
    # backslash, whitespace, control characters, or an empty label. IPv6 keeps
    # internal colons. Do not echo the raw key.
    if not host or any(char in host for char in "/\\@ \t\r\n"):
        raise SystemExit("invalid site host")
    if any(ord(char) < 32 or ord(char) == 127 for char in host):
        raise SystemExit("invalid site host")
    if host.startswith(".") or ".." in host:
        raise SystemExit("invalid site host")
    if ":" in host and host.count(":") < 2:
        raise SystemExit("invalid site host")
    return host



def integer_ipv4(text):
    # A decimal dword or 0x hex form is the same address as dotted IPv4.
    # Short numeric labels stay hostnames. Do not echo the raw key.
    raw = str(text or "").strip()
    lower = raw.lower()
    if lower.startswith("0x"):
        digits = lower[2:]
        if not digits or any(ch not in "0123456789abcdef" for ch in digits):
            return None
        value = int(digits, 16)
    elif raw.isdigit() and len(raw) >= 4:
        value = int(raw, 10)
    else:
        return None
    if value > 0xFFFFFFFF:
        raise SystemExit("invalid site host")
    return str(ipaddress.IPv4Address(value))


def canonical_ip(host):
    # Dotted IPv4, leading-zero octets, dword/hex forms, and IPv4-mapped IPv6 are one site key.
    # Fail closed on an unparsable mapped form. Do not echo the raw key.
    text = str(host or "")
    lower = text.lower()
    aliased = integer_ipv4(text)
    if aliased:
        return aliased
    if lower.startswith("::ffff:"):
        mapped = text[7:]
        try:
            return str(ipaddress.IPv4Address(int(ipaddress.IPv4Address(mapped))))
        except (ipaddress.AddressValueError, ValueError):
            octets = mapped.split(".")
            if len(octets) == 4 and all(part.isdigit() and 0 <= int(part) <= 255 for part in octets):
                return ".".join(str(int(part)) for part in octets)
            raise SystemExit("invalid site host")
    octets = text.split(".")
    if len(octets) == 4 and all(part.isdigit() for part in octets):
        if any(int(part) > 255 for part in octets):
            raise SystemExit("invalid site host")
        return ".".join(str(int(part)) for part in octets)
    try:
        ip = ipaddress.ip_address(text)
    except ValueError:
        return text
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        return str(ip.ipv4_mapped)
    if isinstance(ip, ipaddress.IPv4Address):
        return str(ip)
    return ip.compressed


def normalise_host(host):
    host = strip_port(decode_host(host))
    # Fullwidth ASCII (U+FF0E dot, U+FF21 letters) is the same site key.
    host = unicodedata.normalize("NFKC", str(host or "")).lower().rstrip(".").removeprefix("www.").rstrip(".")
    if not host:
        return ""
    host = assert_hostname(host)
    try:
        canonical = host.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise SystemExit("invalid site host") from exc
    # IDNA can map Unicode spaces onto ASCII space. Re-check the canonical form.
    return canonical_ip(assert_hostname(canonical))


def bare_host(value):
    # Scheme-less map keys must not become a second site identity via path,
    # query, fragment, or userinfo. URL-form keys already use hostname only.
    host = str(value or "").split("?", 1)[0].split("#", 1)[0]
    host = host.split("/", 1)[0]
    return host.split("@")[-1]


def site_key(site_url):
    raw = str(site_url or "").strip()
    if raw.startswith("sc-domain:"):
        return normalise_host(bare_host(raw.split(":", 1)[1]))
    if "://" in raw:
        return normalise_host(urlparse(raw).hostname or raw)
    return normalise_host(bare_host(raw))


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
        # Do not echo the raw map key. Classification stays on the stable phrases.
        if not isinstance(raw_project, str):
            raise SystemExit("invalid project id for mapped site")
        project_id=raw_project.strip()
        if not site:
            raise SystemExit("MS_ROBOT_PROJECT_SITE_MAP_JSON contains an empty site")
        if project_id.lower() in RESERVED_PROJECT_IDS:
            raise SystemExit("invalid project id for mapped site: reserved project scope")
        if not PROJECT_ID_PATTERN.fullmatch(project_id):
            raise SystemExit("invalid project id for mapped site")
        if site in output and output[site]!=project_id:
            raise SystemExit("site is mapped to more than one project")
        output[site]=project_id
    return output


def main():
    init_db()
    ensure_schema(DB)
    try:
        mapping=project_site_map()
    except SystemExit as exc:
        checkpoint=checkpoint_for_sync_failure(str(exc), 1)
        if checkpoint["retryable"] or checkpoint["errorClass"] not in ("site_map_missing", "site_map_invalid"):
            raise
        print(json.dumps({
            "error":checkpoint["errorClass"],
            "retryCheckpoint":checkpoint,
            "detail":str(exc),
        }))
        raise SystemExit(1) from exc
    discovery=google_request("/v1/sites")
    sites=discovery.get("sites") if isinstance(discovery, dict) else None
    # A string or error object is not an empty property list. Treating it as
    # unauthorised would retry the wrong failure and might sync a character key.
    if not isinstance(sites, list) or any(not isinstance(item, dict) for item in sites):
        message="site_map_invalid: gsc discovery payload"
        checkpoint=checkpoint_for_sync_failure(message, 1)
        print(json.dumps({
            "error":checkpoint["errorClass"],
            "retryCheckpoint":checkpoint,
            "detail":message,
        }))
        raise SystemExit(1)
    authorised={}
    for item in sites:
        site_url=item.get("siteUrl")
        # siteRestrictedUser and siteUnverifiedUser are not a sync grant.
        # A missing permission is not an implicit owner. Do not echo siteUrl.
        if not site_url or item.get("permissionLevel") not in WRITABLE_GSC_PERMISSIONS:
            continue
        key=site_key(site_url)
        bucket=authorised.setdefault(key, [])
        if site_url not in bucket:
            bucket.append(site_url)
    # A domain property and a URL-prefix property are different GSC identities.
    # Last-write-wins would sync the wrong property. Fail closed, do not echo URLs.
    ambiguous=sorted(key for key, urls in authorised.items() if key in mapping and len(urls) > 1)
    if ambiguous:
        message="site_map_invalid: more than one gsc property"
        checkpoint=checkpoint_for_sync_failure(message, 1)
        print(json.dumps({
            "error":checkpoint["errorClass"],
            "retryCheckpoint":checkpoint,
            "detail":message,
        }))
        raise SystemExit(1)

    started=now()
    runs=[]
    unavailable=[]
    touched_projects=set()

    for site,project_id in sorted(mapping.items()):
        if site not in authorised:
            unavailable.append({
                "site":site,
                "projectId":project_id,
                "error":"gsc_property_not_authorised",
                "retryCheckpoint":checkpoint_for_sync_failure("gsc_property_not_authorised:"+site, 1),
            })
            continue
        property_url=authorised[site][0]
        run,created=create_or_run_sync(project_id,"gsc",property_url,"27d",started)
        touched_projects.add(project_id)
        runs.append({
            "projectId":project_id,
            "site":property_url,
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
