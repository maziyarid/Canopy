import importlib
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))


def event(**changes):
    value = {
        'schema_version': 1, 'event_id': 'event-1', 'idempotency_key': 'notice-1',
        'source': 'ada', 'target': 'ms_robot', 'event_type': 'ada.alert.queued',
        'project_key': 'project-a', 'site_key': 'example.com',
        'correlation_id': 'incident-1', 'sensitivity': 'internal',
        'payload': {'incident_ref': 'incident-1', 'message': 'transient content only'},
        'state': 'queued', 'created_at': '2026-10-03T10:00:00+00:00',
    }
    value.update(changes)
    return value


class Bridge:
    def __init__(self, path, rows=None):
        self.path = path
        self.rows = [event()] if rows is None else rows
        self.calls = []
        self.lose_ack = False
    def list_events(self, state, limit, project_id, site_key):
        self.calls.append(('read', state))
        return [dict(row) for row in self.rows if row['state'] == state][:limit]
    def transition(self, event_id, action, error=None):
        if action in ('delivered', 'ack'):
            # Separate connection proves the receipt committed before either write.
            with sqlite3.connect(self.path) as db:
                self.assert_receipt = db.execute('select count(*) from ada_bridge_receipt where event_id=?', (event_id,)).fetchone()[0]
            if self.assert_receipt != 1:
                raise AssertionError('bridge changed before durable receipt')
        self.calls.append((action, event_id, error))
        row = next(row for row in self.rows if row['event_id'] == event_id)
        if action == 'ack' and self.lose_ack:
            self.lose_ack = False
            raise OSError('sensitive transport detail must not be logged')
        if action == 'fail':
            row['attempts'] = row.get('attempts', 0) + 1
            row['state'] = 'dead' if row['attempts'] >= 2 else 'queued'
        else:
            row['state'] = 'acked' if action == 'ack' else 'delivered'
        return {'ok': True, 'event_id': event_id, 'state': row['state']}


class ConsumerTest(unittest.TestCase):
    def setUp(self):
        self.assertTrue((ROOT / 'ada_bridge_consumer.py').is_file(), 'planned bridge consumer is missing')
        self.consumer = importlib.import_module('ada_bridge_consumer')
        self.receipts = importlib.import_module('ada_bridge_receipts')
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = str(Path(self.tmp.name) / 'analytics.sqlite3')
    def run_once(self, bridge, enabled=True):
        return self.consumer.consume_once(bridge, self.path, 'project-a', 'example.com', enabled=enabled, limit=5)
    def rows(self):
        with sqlite3.connect(self.path) as db:
            db.row_factory = sqlite3.Row
            return [dict(row) for row in db.execute('select * from ada_bridge_receipt')]
    def test_disabled_does_no_network_or_database_work(self):
        bridge = Bridge(self.path)
        self.assertEqual(self.run_once(bridge, False)['status'], 'disabled')
        self.assertEqual(bridge.calls, [])
        self.assertFalse(Path(self.path).exists())
    def test_receipt_commits_before_delivery_and_ack_without_payload_storage(self):
        bridge = Bridge(self.path)
        result = self.run_once(bridge)
        self.assertEqual(result['acknowledged'], 1)
        rows = self.rows()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['state'], 'acknowledged')
        self.assertEqual(rows[0]['action_state'], 'informational')
        self.assertNotIn('transient content only', json.dumps(rows))
        self.assertNotIn('payload', rows[0])
        self.assertEqual([x[0] for x in bridge.calls if x[0] != 'read'], ['delivered', 'ack'])
    def test_restart_after_lost_ack_reuses_committed_receipt(self):
        bridge = Bridge(self.path)
        bridge.lose_ack = True
        first = self.run_once(bridge)
        self.assertEqual(first['acknowledged'], 0)
        self.assertEqual(self.rows()[0]['state'], 'recorded')
        self.assertEqual(first['status'], 'reconciliation_required')
        self.assertEqual(first['pending_receipts'], 1)
        self.assertEqual(bridge.rows[0]['state'], 'delivered')
        second = self.run_once(bridge)
        self.assertEqual(second['acknowledged'], 1)
        self.assertEqual(second['duplicates'], 1)
        self.assertEqual(len(self.rows()), 1)
        self.assertNotIn('sensitive transport detail', json.dumps(first))
    def test_changed_envelope_cannot_reuse_idempotency_key(self):
        bridge = Bridge(self.path)
        self.run_once(bridge)
        bridge.rows = [event(event_id='event-2', payload={'incident_ref': 'changed'})]
        result = self.run_once(bridge)
        self.assertEqual(result['rejected'], 1)
        self.assertEqual(len(self.rows()), 1)
        self.assertEqual(bridge.rows[0]['state'], 'queued')
        self.assertEqual(bridge.rows[0]['attempts'], 1)
        self.assertFalse(any(x[0] == 'ack' and x[1] == 'event-2' for x in bridge.calls))
    def test_malformed_identity_does_not_abort_a_healthy_event(self):
        bridge = Bridge(self.path, [event(event_id=[]), event(event_id='healthy', idempotency_key='healthy')])
        result = self.run_once(bridge)
        self.assertEqual(result['rejected'], 1)
        self.assertEqual(result['acknowledged'], 1)
        self.assertEqual(self.rows()[0]['event_id'], 'healthy')
    def test_ack_committed_with_lost_response_remains_explicitly_unconfirmed(self):
        class LostReply(Bridge):
            def transition(self, event_id, action, error=None):
                answer = super().transition(event_id, action, error)
                if action == 'ack':
                    raise OSError('lost response after commit')
                return answer
        bridge = LostReply(self.path)
        first = self.run_once(bridge)
        self.assertEqual(first['status'], 'reconciliation_required')
        self.assertEqual(bridge.rows[0]['state'], 'acked')
        second = self.run_once(bridge)
        self.assertEqual(second['status'], 'reconciliation_required')
        self.assertEqual(second['pending_receipts'], 1)
        self.assertEqual(len(self.rows()), 1)
        self.assertEqual(self.rows()[0]['state'], 'recorded')
    def test_wrong_project_or_site_is_left_untouched(self):
        bridge = Bridge(self.path, [event(project_key='project-b'), event(event_id='event-2', site_key='other.example')])
        result = self.run_once(bridge)
        self.assertEqual(result['acknowledged'], 0)
        self.assertEqual(self.rows(), [])
        self.assertEqual([x[0] for x in bridge.calls], ['read', 'read'])
    def test_proposal_receipt_never_grants_action_authority(self):
        bridge = Bridge(self.path, [event(event_type='ms_robot.action.proposal', payload={'action_ref': 'proposal-1'})])
        self.run_once(bridge)
        self.assertEqual(self.rows()[0]['action_state'], 'proposal_only')
        self.assertEqual([x[0] for x in bridge.calls if x[0] != 'read'], ['delivered', 'ack'])
    def test_invalid_events_fail_through_bridge_lifecycle_without_receipts(self):
        cases = [
            {'schema_version': True}, {'schema_version': 2}, {'event_type': 'shell.execute'},
            {'target': 'ada'}, {'sensitivity': 'invalid'}, {'payload': []},
            {'payload': {'authToken': 'sensitive'}}, {'payload': {'patient_records': []}},
            {'payload': {'x': float('nan')}}, {'correlation_id': 'Bearer private-credential'},
            {'unexpected': 'unknown field'},
            {'created_at': None}, {'created_at': False},
        ]
        for changes in cases:
            with self.subTest(changes=changes):
                bridge = Bridge(self.path, [event(**changes)])
                result = self.run_once(bridge)
                self.assertEqual(result['acknowledged'], 0)
                self.assertEqual(self.rows(), [])
                self.assertFalse(any(x[0] in ('ack', 'delivered') for x in bridge.calls))
    def test_failed_validation_can_reach_existing_dead_state(self):
        bridge = Bridge(self.path, [event(schema_version=2)])
        self.run_once(bridge)
        self.run_once(bridge)
        self.assertEqual(bridge.rows[0]['state'], 'dead')
        self.assertEqual(self.rows(), [])
    def test_gateway_outage_preserves_committed_receipts(self):
        bridge = Bridge(self.path)
        self.run_once(bridge)
        before = self.rows()
        class Unavailable:
            def list_events(self, *args):
                raise OSError('provider secret')
        result = self.run_once(Unavailable())
        self.assertEqual(result['status'], 'unavailable')
        self.assertEqual(self.rows(), before)
        self.assertNotIn('provider secret', json.dumps(result))
    def test_persistence_failure_never_delivers_or_acks(self):
        Path(self.path).mkdir()
        bridge = Bridge(self.path)
        result = self.run_once(bridge)
        self.assertEqual(result['status'], 'storage_unavailable')
        self.assertFalse(any(x[0] in ('ack', 'delivered') for x in bridge.calls))
    def test_read_projection_scopes_project_and_site_and_omits_digest(self):
        self.run_once(Bridge(self.path))
        rows = self.receipts.list_receipts(self.path, 'project-a', 'example.com', 50)
        self.assertEqual(rows[0]['event_id'], 'event-1')
        self.assertNotIn('envelope_sha256', rows[0])
        self.assertNotIn('idempotency_key', rows[0])
        self.assertEqual(self.receipts.list_receipts(self.path, 'project-b', 'example.com', 50), [])
        self.assertEqual(self.receipts.list_receipts(self.path, 'project-a', 'other.example', 50), [])


if __name__ == '__main__':
    unittest.main()
