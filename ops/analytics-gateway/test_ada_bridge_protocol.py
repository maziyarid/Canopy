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

    def lose_committed_ack_reply(self):
        original=self.client.transition
        def lost(event_id,action,error=None):
            answer=original(event_id,action,error)
            if action=='ack': raise OSError('lost reply after real bridge commit')
            return answer
        self.client.transition=lost
    def test_restart_reconciles_accepted_ack_with_lost_reply_without_bridge_writes(self):
        self.publish(event(event_type='ms_robot.action.proposal'))
        self.lose_committed_ack_reply()
        self.assertEqual(self.intake()['status'],'reconciliation_required')
        self.assertEqual(self.receipts(),[('event-1','recorded','proposal_only')])
        with sqlite3.connect(self.root/'bridge/events.sqlite3') as db:
            before=db.execute('select * from events').fetchall()
        from ada_bridge_consumer import BridgeClient
        result=self.intake(BridgeClient(self.url,'isolated-fixture-credential'))
        self.assertEqual(result['status'],'complete')
        self.assertEqual(result['reconciled'],1)
        self.assertEqual(result['pending_receipts'],0)
        self.assertEqual(self.receipts(),[('event-1','acknowledged','proposal_only')])
        with sqlite3.connect(self.root/'bridge/events.sqlite3') as db:
            self.assertEqual(db.execute('select * from events').fetchall(),before)
        self.assertNotIn(b'transient content only',Path(self.db).read_bytes())
    def test_reconciliation_rejects_changed_acked_identity_without_regressing_bridge(self):
        self.publish(event())
        self.lose_committed_ack_reply();self.intake()
        with sqlite3.connect(self.root/'bridge/events.sqlite3') as db:
            db.execute("update events set source='different-source'")
        from ada_bridge_consumer import BridgeClient
        result=self.intake(BridgeClient(self.url,'isolated-fixture-credential'))
        self.assertEqual(result['unconfirmed'],1)
        self.assertEqual(result['status'],'reconciliation_required')
        self.assertEqual(self.receipts(),[('event-1','recorded','informational')])
        self.assertEqual(self.bridge_rows(),[('event-1','acked',0)])
    def test_unresolved_dead_receipt_is_not_redriven(self):
        self.publish(event());self.lose_committed_ack_reply();self.intake()
        with sqlite3.connect(self.root/'bridge/events.sqlite3') as db:
            db.execute("update events set state='dead',attempts=8")
        from ada_bridge_consumer import BridgeClient
        result=self.intake(BridgeClient(self.url,'isolated-fixture-credential'))
        self.assertEqual(result['unconfirmed'],1)
        self.assertEqual(result['status'],'reconciliation_required')
        self.assertEqual(self.bridge_rows(),[('event-1','dead',8)])
        self.assertEqual(self.receipts()[0][1],'recorded')
    def test_lookup_failure_retains_receipt_and_prevents_repeat_transition(self):
        self.publish(event())
        original=self.client.transition
        def lost_before_ack(identity,action,error=None):
            if action=='ack':raise OSError('not sent')
            return original(identity,action,error)
        self.client.transition=lost_before_ack;self.intake()
        from ada_bridge_consumer import BridgeClient
        fresh=BridgeClient(self.url,'isolated-fixture-credential')
        request=fresh.request
        def unavailable_lookup(path,*args,**kwargs):
            if path.startswith('/v1/events/event-1?'):raise OSError('lookup unavailable')
            return request(path,*args,**kwargs)
        fresh.request=unavailable_lookup
        result=self.intake(fresh)
        self.assertEqual(result['status'],'reconciliation_required')
        self.assertEqual(result['unconfirmed'],1)
        self.assertEqual(result['acknowledged'],0)
        self.assertEqual(self.bridge_rows(),[('event-1','delivered',0)])
        self.assertEqual(self.receipts()[0][1],'recorded')
    def test_lookup_response_with_wrong_scope_or_identity_cannot_confirm_ack(self):
        self.publish(event());self.lose_committed_ack_reply();self.intake()
        from ada_bridge_consumer import BridgeClient
        for field in ['scope','event_id','project_key','site_key','target','payload','payload_sha256','state']:
            with self.subTest(field=field):
                fresh=BridgeClient(self.url,'isolated-fixture-credential')
                request=fresh.request
                def altered(path,*args,**kwargs):
                    answer=request(path,*args,**kwargs)
                    if path.startswith('/v1/events/event-1?'):
                        if field=='scope':answer['scope']={'project_key':'project-b','site_key':'example.com'}
                        elif field=='payload':answer['event'][field]={'message':'changed'}
                        else:answer['event'][field]='changed'
                    return answer
                fresh.request=altered
                result=self.intake(fresh)
                self.assertEqual(result['unconfirmed'],1)
                self.assertEqual(result['status'],'reconciliation_required')
                self.assertEqual(self.receipts()[0][1],'recorded')
                self.assertEqual(self.bridge_rows(),[('event-1','acked',0)])
    def test_reconciliation_and_fresh_intake_share_the_bounded_batch(self):
        for number in range(5):self.publish(event(event_id=f'event-{number}',idempotency_key=f'notice-{number}'))
        self.lose_committed_ack_reply()
        self.consume(self.client,self.db,'project-a','example.com',enabled=True,limit=5)
        self.publish(event(event_id='new-event',idempotency_key='new-event'))
        from ada_bridge_consumer import BridgeClient
        result=self.intake(BridgeClient(self.url,'isolated-fixture-credential'))
        self.assertEqual(result['reconciled'],2)
        self.assertEqual(result['acknowledged'],2)
        self.assertEqual(result['recorded'],0)
        self.assertEqual(result['pending_receipts'],3)
        self.assertIn(('new-event','queued',0),self.bridge_rows())
    def test_pending_receipts_in_another_scope_are_not_reconciled(self):
        from ada_bridge_receipts import persist_receipt,validate_event
        from sqlite_migrations import ensure_analytics_schema
        ensure_analytics_schema(self.db)
        foreign=event(event_id='foreign',idempotency_key='foreign',project_key='project-b')
        persist_receipt(self.db,validate_event(foreign));self.publish(foreign)
        self.client.transition('foreign','ack')
        self.publish(event())
        self.assertEqual(self.intake()['status'],'complete')
        self.assertEqual(sorted(self.receipts()),[('event-1','acknowledged','informational'),('foreign','recorded','informational')])
    def test_real_cli_process_confirms_lost_ack_after_restart(self):
        self.publish(event(event_id='event:restart/reference'))
        self.lose_committed_ack_reply();self.intake()
        env={**os.environ,'MSROBOT_BRIDGE_URL':self.url,'MSROBOT_BRIDGE_TOKEN':'isolated-fixture-credential','ANALYTICS_GATEWAY_DB':self.db}
        result=subprocess.run([sys.executable,str(Path(__file__).with_name('ada_bridge_consumer.py')),'--enabled','--project-id','project-a','--site-key','example.com','--limit','2'],env=env,capture_output=True,text=True,timeout=10)
        self.assertEqual(result.returncode,0,result.stderr)
        answer=json.loads(result.stdout)
        self.assertEqual(answer['reconciled'],1)
        self.assertEqual(answer['pending_receipts'],0)
        self.assertEqual(self.receipts(),[('event:restart/reference','acknowledged','informational')])
    def test_missing_bridge_record_exits_nonzero_without_false_confirmation(self):
        self.publish(event());self.lose_committed_ack_reply();self.intake()
        with sqlite3.connect(self.root/'bridge/events.sqlite3') as db:db.execute('delete from events')
        env={**os.environ,'MSROBOT_BRIDGE_URL':self.url,'MSROBOT_BRIDGE_TOKEN':'isolated-fixture-credential','ANALYTICS_GATEWAY_DB':self.db}
        result=subprocess.run([sys.executable,str(Path(__file__).with_name('ada_bridge_consumer.py')),'--enabled','--project-id','project-a','--site-key','example.com'],env=env,capture_output=True,text=True,timeout=10)
        self.assertEqual(result.returncode,1)
        self.assertEqual(json.loads(result.stdout)['status'],'reconciliation_required')
        self.assertEqual(self.receipts(),[('event-1','recorded','informational')])


if __name__ == '__main__':
    unittest.main()
