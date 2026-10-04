#!/usr/bin/env python3
"""Bounded Ms Robot intake: durable receipts first; no action execution."""
import argparse
import json
import os
from urllib.parse import quote, urlparse, urlencode
from urllib.request import Request, build_opener, HTTPRedirectHandler, ProxyHandler

from ada_bridge_receipts import ReceiptError, mark_acknowledged, pending_receipt_count, pending_receipts, persist_receipt, reference, validate_event
from sqlite_migrations import ensure_analytics_schema


class BridgeError(RuntimeError):
    pass


class RejectRedirects(HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise BridgeError('bridge_redirect_rejected')


class BridgeClient:
    def __init__(self, url, token):
        parsed = urlparse(url)
        if parsed.scheme != 'http' or parsed.hostname not in {'127.0.0.1', '::1'} or parsed.username or parsed.password or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
            raise BridgeError('bridge_must_be_loopback')
        try:
            if parsed.port is not None and not 1 <= parsed.port <= 65535:
                raise ValueError()
        except ValueError:
            raise BridgeError('bridge_must_be_loopback') from None
        if not isinstance(token, str) or not token.strip() or '\n' in token or '\r' in token:
            raise BridgeError('bridge_credential_missing')
        self.url, self.token = url.rstrip('/'), token
        self.opener = build_opener(ProxyHandler({}), RejectRedirects())
    def request(self, path, body=None, *, maximum_bytes=262144):
        payload = None if body is None else json.dumps(body, separators=(',', ':')).encode()
        request = Request(self.url + path, data=payload, headers={'Authorization': 'Bearer ' + self.token,
                          'Accept': 'application/json', 'Content-Type': 'application/json'},
                          method='GET' if body is None else 'POST')
        try:
            with self.opener.open(request, timeout=10) as response:
                raw = response.read(maximum_bytes + 1)
            if len(raw) > maximum_bytes:
                raise ValueError()
            obj = json.loads(raw)
            if not isinstance(obj, dict):
                raise ValueError()
            return obj
        except Exception:
            raise BridgeError('bridge_request_failed') from None
    def list_events(self, state, limit, project_id, site_key):
        if type(limit) is not int or not 1 <= limit <= 20:
            raise BridgeError('bridge_response_invalid')
        scope={'project_key': reference(project_id,128), 'site_key': reference(site_key,160)}
        query=urlencode({'target':'ms_robot','state':state,'limit':limit,**scope})
        # 64 KiB payload plus bounded envelope metadata for every batch entry.
        obj = self.request('/v1/events?' + query, maximum_bytes=limit * (65536 + 8192) + 1024)
        if obj.get('scope') != scope:
            raise BridgeError('bridge_scoped_listing_required')
        rows = obj.get('events')
        if not isinstance(rows, list) or len(rows) > limit or any(not isinstance(row, dict) or row.get('target') != 'ms_robot' or row.get('state') != state or row.get('project_key') != project_id or row.get('site_key') != site_key for row in rows):
            raise BridgeError('bridge_response_invalid')
        return rows
    def transition(self, event_id, action, error=None):
        reference(event_id, 80)
        obj = self.request('/v1/events/' + quote(event_id, safe='') + '/' + action,
                           {'error': error} if action == 'fail' else {})
        expected = {'delivered': {'delivered'}, 'ack': {'acked'}, 'fail': {'queued', 'dead'}}[action]
        if obj.get('ok') is not True or obj.get('event_id') != event_id or obj.get('state') not in expected:
            raise BridgeError('bridge_transition_unconfirmed')
        return obj

    def get_event(self, event_id, project_id, site_key):
        reference(event_id, 80)
        scope = {'project_key': reference(project_id, 128), 'site_key': reference(site_key, 160)}
        query = urlencode({'target': 'ms_robot', **scope})
        obj = self.request('/v1/events/' + quote(event_id, safe='') + '?' + query,
                           maximum_bytes=65536 + 8192 + 1024)
        row = obj.get('event')
        if obj.get('scope') != scope or not isinstance(row, dict) or row.get('event_id') != event_id or row.get('target') != 'ms_robot' or row.get('project_key') != project_id or row.get('site_key') != site_key or row.get('state') not in {'queued', 'delivered', 'acked', 'dead'}:
            raise BridgeError('bridge_lookup_unconfirmed')
        return row


def consume_once(bridge, db_path, project_id, site_key, *, enabled=False, limit=5):
    if not enabled:
        return {'status': 'disabled'}
    reference(project_id, 128)
    reference(site_key, 160)
    if type(limit) is not int or not 1 <= limit <= 20:
        raise ReceiptError('invalid_limit')
    result = {'status': 'complete', 'recorded': 0, 'duplicates': 0, 'acknowledged': 0,
              'rejected': 0, 'skipped': 0, 'unconfirmed': 0, 'pending_receipts': 0, 'reconciled': 0}
    try:
        ensure_analytics_schema(db_path)
        pending = pending_receipts(db_path, project_id, site_key, limit)
    except Exception:
        return {**result, 'status': 'storage_unavailable'}
    try:
        # Delivered receipts must be recovered after lost ACKs or restarts.
        rows = bridge.list_events('delivered', limit, project_id, site_key) + bridge.list_events('queued', limit, project_id, site_key)
    except Exception:
        return {**result, 'status': 'unavailable'}
    processed = 0
    seen = set()
    recovered = []
    for receipt in pending:
        identity = receipt['event_id']
        try:
            raw = bridge.get_event(identity, project_id, site_key)
            event = validate_event(raw)
            if event['event_id'] != identity or event['project_key'] != project_id or event['site_key'] != site_key or event['envelope_sha256'] != receipt['envelope_sha256']:
                raise ReceiptError('event_identity_conflict')
            if raw.get('state') == 'acked':
                mark_acknowledged(db_path, event)
                result['acknowledged'] += 1
                result['reconciled'] += 1
            elif raw.get('state') in {'queued', 'delivered'}:
                recovered.append(raw)
                continue
            else:
                raise BridgeError('bridge_lookup_unconfirmed')
        except Exception:
            # Missing, changed, dead or unavailable status never grants a write.
            result['unconfirmed'] += 1
        seen.add(identity)
        processed += 1
    rows = recovered + rows
    for raw in rows:
        if not isinstance(raw, dict):
            result['rejected'] += 1
            continue
        if raw.get('project_key') != project_id or raw.get('site_key') != site_key or raw.get('target') != 'ms_robot':
            result['skipped'] += 1
            continue
        event_id = raw.get('event_id')
        if isinstance(event_id, str) and event_id in seen:
            continue
        if processed >= limit:
            break
        if isinstance(event_id, str):
            seen.add(event_id)
        processed += 1
        try:
            if raw.get('state') not in {'queued', 'delivered'}:
                raise ReceiptError('invalid_bridge_state')
            event = validate_event(raw)
            created = persist_receipt(db_path, event)
            result['recorded' if created else 'duplicates'] += 1
        except Exception as exc:
            result['rejected'] += 1
            error = str(exc) if isinstance(exc, ReceiptError) else 'receipt_persistence_failed'
            try:
                reference(raw.get('event_id'), 80)
                bridge.transition(raw['event_id'], 'fail', error)
            except Exception:
                result['unconfirmed'] += 1
            continue
        try:
            if raw['state'] == 'queued':
                bridge.transition(event['event_id'], 'delivered')
            bridge.transition(event['event_id'], 'ack')
            mark_acknowledged(db_path, event)
            result['acknowledged'] += 1
        except Exception:
            # Keep the committed receipt; verify exact bridge identity on restart.
            # A transport error must never regress a possibly accepted ACK.
            result['unconfirmed'] += 1
    try:
        result['pending_receipts'] = pending_receipt_count(db_path, project_id, site_key)
        if result['pending_receipts']:
            result['status'] = 'reconciliation_required'
    except Exception:
        result['status'] = 'storage_unavailable'
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--enabled', action='store_true', help='Explicit bounded intake authorisation')
    parser.add_argument('--project-id', default=os.getenv('MSROBOT_BRIDGE_PROJECT_ID', ''))
    parser.add_argument('--site-key', default=os.getenv('MSROBOT_BRIDGE_SITE_KEY', ''))
    parser.add_argument('--limit', type=int, default=5)
    args = parser.parse_args()
    if not args.enabled:
        print(json.dumps({'status': 'disabled'}))
        return 0
    try:
        bridge = BridgeClient(os.getenv('MSROBOT_BRIDGE_URL', 'http://127.0.0.1:9110'), os.getenv('MSROBOT_BRIDGE_TOKEN', ''))
        result = consume_once(bridge, os.getenv('ANALYTICS_GATEWAY_DB', '/var/lib/ms-robot-analytics/state.sqlite3'),
                              args.project_id, args.site_key, enabled=True, limit=args.limit)
    except Exception:
        result = {'status': 'configuration_invalid'}
    print(json.dumps(result, sort_keys=True))
    return 0 if result['status'] == 'complete' and not result['unconfirmed'] and not result['rejected'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
