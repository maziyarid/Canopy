"""Run against the actual repository-owned bridge v1 in a disposable process.

Set ADA_BRIDGE_TEST_SOURCE to the bridge.py from the paired AdaAI checkout.
No production token, database, socket or queue is used.
"""
import json
import os
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_ada_bridge_consumer import event

SOURCE = os.environ.get('ADA_BRIDGE_TEST_SOURCE', '')


@unittest.skipUnless(SOURCE and Path(SOURCE).is_file(), 'paired bridge source required for isolated protocol rehearsal')
class BridgeProtocolTest(unittest.TestCase):
    def setUp(self):
        from ada_bridge_consumer import BridgeClient, consume_once
        self.consume = consume_once
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.db = str(self.root / 'analytics.sqlite3')
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            self.port = sock.getsockname()[1]
        env = {**os.environ, 'MSROBOT_BRIDGE_HOST': '127.0.0.1', 'MSROBOT_BRIDGE_PORT': str(self.port),
               'MSROBOT_BRIDGE_STATE': str(self.root / 'bridge'), 'MSROBOT_BRIDGE_TOKEN': 'isolated-fixture-credential'}
        self.process = subprocess.Popen([sys.executable, SOURCE], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.addCleanup(self.stop_process)
        self.url = f'http://127.0.0.1:{self.port}'
        self.client = BridgeClient(self.url, 'isolated-fixture-credential')
        for _ in range(80):
            try:
                urllib.request.urlopen(self.url + '/healthz', timeout=.1).close()
                break
            except (urllib.error.URLError, OSError):
                if self.process.poll() is not None:
                    self.fail('isolated bridge failed to start')
                time.sleep(.025)
        else:
            self.fail('isolated bridge startup deadline')
    def stop_process(self):
        if self.process.poll() is None:
            self.process.terminate()
            self.process.wait(timeout=5)
    def publish(self, envelope):
        raw = {key: value for key, value in envelope.items() if key not in {'state', 'created_at'}}
        return self.client.request('/v1/events', raw)
    def intake(self, client=None):
        return self.consume(client or self.client, self.db, 'project-a', 'example.com', enabled=True, limit=2)
    def bridge_rows(self):
        with sqlite3.connect(self.root / 'bridge/events.sqlite3') as db:
            return db.execute('select event_id,state,attempts from events').fetchall()
    def receipts(self):
        with sqlite3.connect(self.db) as db:
            return db.execute('select event_id,state,action_state from ada_bridge_receipt').fetchall()
    def test_real_bridge_ack_follows_committed_metadata_only_receipt(self):
        self.publish(event())
        original = self.client.transition
        def committed_transition(event_id, action, error=None):
            if action in {'delivered', 'ack'}:
                self.assertEqual(self.receipts()[0][0], 'event-1')
            return original(event_id, action, error)
        self.client.transition = committed_transition
        self.assertEqual(self.intake()['acknowledged'], 1)
        self.assertEqual(self.bridge_rows(), [('event-1', 'acked', 0)])
        self.assertEqual(self.receipts(), [('event-1', 'acknowledged', 'informational')])
        self.assertEqual(self.intake()['acknowledged'], 0)
        self.assertEqual(len(self.receipts()), 1)
        self.assertNotIn(b'transient content only', Path(self.db).read_bytes())
    def test_bridge_null_correlation_is_an_absent_optional_reference(self):
        envelope=event()
        envelope.pop('correlation_id')
        self.publish(envelope)
        self.assertEqual(self.intake()['acknowledged'], 1)
        with sqlite3.connect(self.db) as db:
            self.assertEqual(db.execute('select correlation_id from ada_bridge_receipt').fetchone()[0], '')
    def test_project_intake_is_not_starved_by_other_projects_or_sites(self):
        for number in range(6):
            self.publish(event(event_id=f'aaa-{number}', idempotency_key=f'aaa-{number}', project_key='project-b'))
        self.publish(event(event_id='aaa-site', idempotency_key='aaa-site', site_key='other.example'))
        self.publish(event(event_id='zzz-own', idempotency_key='zzz-own'))
        self.assertEqual(self.intake()['acknowledged'], 1)
        self.assertEqual(self.receipts(), [('zzz-own', 'acknowledged', 'informational')])
        self.assertTrue(all(state == 'queued' and attempts == 0 for event_id,state,attempts in self.bridge_rows() if event_id != 'zzz-own'))
    def test_default_batch_accepts_five_valid_large_payloads_without_storing_them(self):
        for number in range(5):
            self.publish(event(event_id=f'large-{number}', idempotency_key=f'large-{number}', payload={'content': 'x'*64000}))
        result=self.consume(self.client, self.db, 'project-a', 'example.com', enabled=True, limit=5)
        self.assertEqual(result['acknowledged'], 5)
        self.assertEqual(len(self.receipts()), 5)
        self.assertNotIn(b'x'*100, Path(self.db).read_bytes())
    def test_encoded_reference_ids_support_ack_and_fail_transitions(self):
        self.publish(event(event_id='event:valid/reference',idempotency_key='reference-valid'))
        self.publish(event(event_id='event:invalid/reference',idempotency_key='reference-invalid',event_type='unsupported.operation'))
        result=self.intake()
        self.assertEqual(result['acknowledged'],1)
        self.assertEqual(result['rejected'],1)
        self.assertEqual(sorted(self.bridge_rows()),[('event:invalid/reference','queued',1),('event:valid/reference','acked',0)])
    def test_bridge_without_confirmed_scope_cannot_start_intake(self):
        self.publish(event())
        request=self.client.request
        def legacy_response(*args,**kwargs):
            response=request(*args,**kwargs)
            response.pop('scope',None)
            return response
        self.client.request=legacy_response
        self.assertEqual(self.intake()['status'],'unavailable')
        self.assertEqual(self.bridge_rows(),[('event-1','queued',0)])
        self.assertEqual(self.receipts(),[])
    def test_delivered_receipt_survives_consumer_restart_before_ack(self):
        self.publish(event(event_type='ms_robot.action.proposal'))
        original = self.client.transition
        def lost(event_id, action, error=None):
            if action == 'ack':
                raise OSError('fixture connection loss')
            return original(event_id, action, error)
        self.client.transition = lost
        self.assertEqual(self.intake()['status'], 'reconciliation_required')
        self.assertEqual(self.bridge_rows(), [('event-1', 'delivered', 0)])
        from ada_bridge_consumer import BridgeClient
        fresh = BridgeClient(self.url, 'isolated-fixture-credential')
        self.assertEqual(self.intake(fresh)['duplicates'], 1)
        self.assertEqual(self.receipts(), [('event-1', 'acknowledged', 'proposal_only')])
    def test_invalid_event_uses_real_bounded_fail_dead_lifecycle(self):
        self.publish(event(event_type='unsupported.operation'))
        for _ in range(8):
            self.assertEqual(self.intake()['acknowledged'], 0)
        self.assertEqual(self.bridge_rows(), [('event-1', 'dead', 8)])
        self.assertEqual(self.receipts(), [])
    def test_wrong_bridge_credential_cannot_mutate_or_copy_events(self):
        self.publish(event())
        from ada_bridge_consumer import BridgeClient
        denied = BridgeClient(self.url, 'wrong-fixture-credential')
        self.assertEqual(self.intake(denied)['status'], 'unavailable')
        self.assertEqual(self.bridge_rows(), [('event-1', 'queued', 0)])
        self.assertEqual(self.receipts(), [])


if __name__ == '__main__':
    unittest.main()
