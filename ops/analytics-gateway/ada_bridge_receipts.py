"""Project-scoped, metadata-only receipts for the existing Ada event bridge."""
import hashlib
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

EVENT_TYPES = {
    'ada.alert.queued', 'ada.alert.recovered', 'ada.operator.handoff',
    'ada.language_feedback.approved', 'ms_robot.inquiry.created',
    'ms_robot.inquiry.routed', 'ms_robot.analytics.signal',
    'ms_robot.medical_admin.event', 'ms_robot.action.proposal', 'ms_robot.delivery.failure',
}
ENVELOPE_FIELDS = {
    'schema_version', 'event_id', 'idempotency_key', 'source', 'target', 'event_type',
    'correlation_id', 'site_key', 'project_key', 'sensitivity', 'payload',
}
TRANSPORT_FIELDS = {'payload_sha256', 'state', 'created_at', 'updated_at', 'attempts', 'delivered_at', 'acked_at'}
SECRET_KEYS = ('token', 'password', 'secret', 'apikey', 'authorization', 'privatekey', 'otp', 'patientrecords', 'medicalrecords', 'nationalid')
SECRET_VALUE = re.compile(r'(?i)(?:bearer\s+|-----BEGIN\s|\b\d{6,12}:[A-Za-z0-9_-]{30,}|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)')
REF = re.compile(r'[A-Za-z0-9][A-Za-z0-9._:/-]*\Z')
COLUMNS = ('event_id', 'project_id', 'site_key', 'idempotency_key', 'envelope_sha256',
           'source', 'event_type', 'correlation_id', 'sensitivity', 'reported_at',
           'received_at', 'updated_at', 'state', 'action_state')
PUBLIC_COLUMNS = ('event_id', 'project_id', 'site_key', 'source', 'event_type', 'correlation_id',
                  'sensitivity', 'reported_at', 'received_at', 'updated_at', 'state', 'action_state')


class ReceiptError(ValueError):
    pass


def reference(value, maximum, *, optional=False):
    if optional and value in ('', None):
        return ''
    if not isinstance(value, str) or not 1 <= len(value) <= maximum or not REF.fullmatch(value) or SECRET_VALUE.search(value):
        raise ReceiptError('invalid_event_reference')
    return value


def _check_payload(value, depth=0):
    if depth > 16:
        raise ReceiptError('payload_too_deep')
    if isinstance(value, dict):
        for key, child in value.items():
            if not isinstance(key, str):
                raise ReceiptError('invalid_payload_key')
            normal = re.sub(r'[^a-z0-9]', '', key.lower())
            if any(marker in normal for marker in SECRET_KEYS):
                raise ReceiptError('sensitive_payload_rejected')
            _check_payload(child, depth + 1)
    elif isinstance(value, list):
        for child in value:
            _check_payload(child, depth + 1)
    elif isinstance(value, str) and SECRET_VALUE.search(value):
        raise ReceiptError('sensitive_payload_rejected')


def validate_event(event):
    if not isinstance(event, dict) or set(event) - ENVELOPE_FIELDS - TRANSPORT_FIELDS:
        raise ReceiptError('invalid_event_envelope')
    if type(event.get('schema_version')) is not int or event['schema_version'] != 1:
        raise ReceiptError('unsupported_schema_version')
    if event.get('target') != 'ms_robot' or not isinstance(event.get('event_type'), str) or event['event_type'] not in EVENT_TYPES:
        raise ReceiptError('unsupported_event')
    sensitivity = event.get('sensitivity', 'internal')
    if not isinstance(sensitivity, str) or sensitivity not in {'public', 'internal', 'confidential', 'restricted'}:
        raise ReceiptError('invalid_sensitivity')
    if not isinstance(event.get('payload'), dict):
        raise ReceiptError('invalid_payload')
    _check_payload(event['payload'])
    try:
        payload_raw = json.dumps(event['payload'], ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)
    except (TypeError, ValueError, RecursionError):
        raise ReceiptError('invalid_payload') from None
    if len(payload_raw.encode()) > 65536:
        raise ReceiptError('payload_too_large')
    payload_sha = hashlib.sha256(payload_raw.encode()).hexdigest()
    if 'payload_sha256' in event and event['payload_sha256'] != payload_sha:
        raise ReceiptError('payload_digest_mismatch')
    envelope = {
        'schema_version': 1, 'target': 'ms_robot', 'event_type': event['event_type'],
        'sensitivity': sensitivity, 'payload': event['payload'],
    }
    for key, maximum, optional in [('event_id', 80, False), ('idempotency_key', 240, False),
                                  ('source', 80, False), ('project_key', 128, False),
                                  ('site_key', 160, False), ('correlation_id', 160, True)]:
        envelope[key] = reference(event.get(key, ''), maximum, optional=optional)
    reported = event.get('created_at', '')
    if not isinstance(reported, str):
        raise ReceiptError('invalid_event_timestamp')
    if reported:
        try:
            if not isinstance(reported, str) or len(reported) > 40:
                raise ValueError()
            parsed = datetime.fromisoformat(reported.replace('Z', '+00:00'))
            if parsed.tzinfo is None:
                raise ValueError()
        except ValueError:
            raise ReceiptError('invalid_event_timestamp') from None
    raw = json.dumps(envelope, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
    return {key: value for key, value in envelope.items() if key not in {'payload', 'schema_version', 'target'}} | {
        'envelope_sha256': hashlib.sha256(raw).hexdigest(), 'reported_at': reported,
        'action_state': 'proposal_only' if envelope['event_type'] == 'ms_robot.action.proposal' else 'informational',
    }


def ensure_receipts_schema(connection):
    # Called inside the shared coordinator's BEGIN IMMEDIATE transaction.
    connection.execute('''create table if not exists ada_bridge_receipt(
        event_id text primary key, project_id text not null, site_key text not null,
        idempotency_key text not null, envelope_sha256 text not null,
        source text not null, event_type text not null, correlation_id text not null,
        sensitivity text not null, reported_at text not null, received_at text not null,
        updated_at text not null, state text not null check(state in ('recorded','acknowledged')),
        action_state text not null check(action_state in ('informational','proposal_only')),
        unique(project_id,idempotency_key))''')
    columns = {row[1] for row in connection.execute('pragma table_info(ada_bridge_receipt)')}
    unique = {tuple(row[2] for row in connection.execute('pragma index_info('+index[1]+')'))
              for index in connection.execute('pragma index_list(ada_bridge_receipt)') if index[2]}
    if not set(COLUMNS) <= columns or not {('event_id',), ('project_id', 'idempotency_key')} <= unique:
        raise ReceiptError('receipt_schema_invalid')
    connection.execute('create index if not exists ada_bridge_receipt_scope on ada_bridge_receipt(project_id,site_key,received_at)')


def persist_receipt(path, event):
    stamp = datetime.now(timezone.utc).isoformat()
    values = {**event, 'project_id': event['project_key'], 'received_at': stamp, 'updated_at': stamp, 'state': 'recorded'}
    with sqlite3.connect(path, timeout=15) as connection:
        connection.row_factory = sqlite3.Row
        connection.execute('begin immediate')
        rows = connection.execute('select * from ada_bridge_receipt where event_id=? or (project_id=? and idempotency_key=?)',
                                  (event['event_id'], event['project_key'], event['idempotency_key'])).fetchall()
        if rows:
            if len(rows) != 1 or rows[0]['envelope_sha256'] != event['envelope_sha256']:
                raise ReceiptError('event_identity_conflict')
            return False
        connection.execute('insert into ada_bridge_receipt('+','.join(COLUMNS)+') values('+','.join('?' for _ in COLUMNS)+')',
                           tuple(values[key] for key in COLUMNS))
    return True


def mark_acknowledged(path, event):
    with sqlite3.connect(path, timeout=15) as connection:
        changed = connection.execute('''update ada_bridge_receipt set state='acknowledged',updated_at=?
          where event_id=? and project_id=? and site_key=? and envelope_sha256=?''',
          (datetime.now(timezone.utc).isoformat(), event['event_id'], event['project_key'], event['site_key'], event['envelope_sha256'])).rowcount
        if changed != 1:
            raise ReceiptError('receipt_binding_missing')


def list_receipts(path, project_id, site_key, limit=50):
    reference(project_id, 128)
    reference(site_key, 160)
    if type(limit) is not int or not 1 <= limit <= 100:
        raise ReceiptError('invalid_limit')
    with sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True, timeout=15) as connection:
        connection.row_factory = sqlite3.Row
        return [dict(row) for row in connection.execute('select '+','.join(PUBLIC_COLUMNS)+
                ' from ada_bridge_receipt where project_id=? and site_key=? order by received_at desc,event_id limit ?',
                (project_id, site_key, limit))]



def pending_receipt_count(path, project_id, site_key):
    with sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True, timeout=15) as connection:
        return connection.execute("select count(*) from ada_bridge_receipt where project_id=? and site_key=? and state='recorded'",
                                  (project_id, site_key)).fetchone()[0]


def pending_receipts(path, project_id, site_key, limit):
    reference(project_id, 128)
    reference(site_key, 160)
    if type(limit) is not int or not 1 <= limit <= 20:
        raise ReceiptError('invalid_limit')
    with sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True, timeout=15) as connection:
        connection.row_factory = sqlite3.Row
        return [dict(row) for row in connection.execute('''select event_id,envelope_sha256
          from ada_bridge_receipt where project_id=? and site_key=? and state='recorded'
          order by received_at,event_id limit ?''', (project_id, site_key, limit))]
