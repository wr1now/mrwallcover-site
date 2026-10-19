"""Offline only: no provider calls, customer addresses, credentials or deployment."""
import unittest
import uuid
from notifications import ProviderFailure, checked_payload, environment, process_delivery_check, process_send, run_once

ID = '10000000-0000-4000-8000-000000000001'
TOKEN = '20000000-0000-4000-8000-000000000002'
ENV = {'DESIGNER_PORTAL_NOTIFICATIONS_ENABLED':'true', 'DESIGNER_PORTAL_NOTIFICATION_PROVIDER':'resend',
       'DESIGNER_PORTAL_NOTIFICATION_FROM':'sender@example.test', 'DESIGNER_PORTAL_NOTIFICATION_SITE_URL':'https://workspace.example.test/designer-portal/', 'RESEND_API_KEY':'synthetic-not-a-key'}


def job():
    return {'id':ID, 'lease_token':TOKEN, 'provider':'resend', 'recipient_email':'verified@example.test',
            'idempotency_key':'designer-workspace/'+ID, 'provider_payload':{'from':ENV['DESIGNER_PORTAL_NOTIFICATION_FROM'], 'to':['verified@example.test'],
            'subject':'Your Mr Wallcover workspace has an update', 'text':'An update is available in your Mr Wallcover workspace. Sign in to review it: '+ENV['DESIGNER_PORTAL_NOTIFICATION_SITE_URL']}}


class Notifications(unittest.TestCase):
    def test_disabled_default_does_not_call_database_or_provider(self):
        def forbidden(*args, **kwargs): raise AssertionError('No call permitted')
        self.assertFalse(run_once(env={}, rpc_call=forbidden, service_call=forbidden, transport=forbidden)['enabled'])
        self.assertIsNone(environment({**ENV, 'DESIGNER_PORTAL_NOTIFICATIONS_ENABLED':'false'}))
        self.assertIsNone(environment({**ENV, 'RESEND_API_KEY':''}))

    def test_database_gate_must_match_sender_and_workspace(self):
        def forbidden(*args, **kwargs): raise AssertionError('No mutation or send permitted')
        status = run_once(env=ENV, service_call=lambda path:[{'notifications_enabled':False}], rpc_call=forbidden, transport=forbidden)
        self.assertFalse(status['enabled'])

    def test_payload_is_exactly_generic_and_rejects_extra_recipients_or_attachments(self):
        config = environment(ENV)
        self.assertEqual(checked_payload(job(), config)['to'], ['verified@example.test'])
        for change in ({'to':['other@example.test']}, {'attachments':[]}, {'subject':'Private project'}, {'text':'Private address'}):
            altered = job(); altered['provider_payload'].update(change)
            with self.assertRaises(ValueError): checked_payload(altered, config)
        altered = job(); altered['idempotency_key']='different-key'
        with self.assertRaises(ValueError): checked_payload(altered, config)

    def test_authorization_is_rechecked_and_acceptance_is_not_delivery(self):
        calls, requests = [], []
        def rpc(name, payload):
            calls.append((name,payload))
            return True if name=='designer_notification_send_authorized' else {'state':'provider_accepted'}
        def transport(method, path, payload, headers):
            requests.append((method,path,payload,headers)); return {'id':'synthetic-provider-id'}
        self.assertEqual(process_send(job(), environment(ENV), rpc_call=rpc, transport=transport)['state'], 'provider_accepted')
        self.assertEqual(calls[0][0], 'designer_notification_send_authorized')
        self.assertEqual(calls[-1][1]['p_outcome'], 'accepted')
        self.assertNotIn('delivered', calls[-1][1])
        self.assertEqual(requests[0][3]['Idempotency-Key'], job()['idempotency_key'])
        def forbidden(*args): raise AssertionError('Provider call prohibited after lost permission')
        self.assertEqual(process_send(job(), environment(ENV), rpc_call=lambda *args:False, transport=forbidden)['state'], 'not_authorized')

    def test_ambiguous_retry_preserves_payload_and_key(self):
        requests, completions = [], []
        def rpc(name, payload):
            if name=='designer_notification_send_authorized': return True
            completions.append(payload); return {'state':'queued'}
        def timeout(method, path, payload, headers):
            requests.append((payload,headers['Idempotency-Key'])); raise ProviderFailure()
        for _ in range(2): process_send(job(), environment(ENV), rpc_call=rpc, transport=timeout)
        self.assertEqual(requests[0],requests[1]); self.assertTrue(all(c['p_outcome']=='retry' for c in completions))

    def test_payload_conflict_is_uncertain_and_provider_rejection_is_failed(self):
        for failure, outcome in ((ProviderFailure(409,'invalid_idempotent_request'),'uncertain'), (ProviderFailure(400,'validation_error'),'failed'), (ProviderFailure(429,'rate_limit_exceeded'),'retry')):
            calls=[]
            def rpc(name, payload):
                if name=='designer_notification_send_authorized': return True
                calls.append(payload); return {'state':payload['p_outcome']}
            def error(*args): raise failure
            process_send(job(), environment(ENV), rpc_call=rpc, transport=error)
            self.assertEqual(calls[-1]['p_outcome'], outcome)

    def test_ambiguous_database_finish_does_not_initiate_second_send_or_change_key(self):
        calls=[]
        def rpc(name, payload):
            calls.append(name)
            if name=='designer_notification_send_authorized': return True
            raise TimeoutError('Synthetic database timeout')
        result=process_send(job(), environment(ENV), rpc_call=rpc, transport=lambda *args:{'id':'synthetic-provider-id'})
        self.assertEqual(result['state'],'reconciliation_pending')
        self.assertEqual(calls, ['designer_notification_send_authorized','designer_finish_notification'])

    def test_delivery_reconciliation_uses_get_only_and_explicit_provider_event(self):
        pending={**job(),'provider_email_id':'synthetic-provider-id','delivery_lease_token':TOKEN}; calls=[]
        def transport(method,path,payload,headers):
            self.assertEqual(method,'GET'); self.assertIsNone(payload); self.assertNotIn('Idempotency-Key',headers)
            return {'id':'synthetic-provider-id','last_event':'delivered'}
        def rpc(name,payload): calls.append((name,payload));return {'state':'delivered'}
        self.assertEqual(process_delivery_check(pending,environment(ENV),rpc_call=rpc,transport=transport)['state'],'delivered')
        self.assertEqual(calls[0][0],'designer_finish_delivery_check'); self.assertEqual(calls[0][1]['p_event'],'delivered')
        def timeout(*args): raise ProviderFailure()
        result=process_delivery_check(pending,environment(ENV),rpc_call=lambda *args:None,transport=timeout)
        self.assertEqual(result['state'],'provider_accepted')


if __name__=='__main__': unittest.main()
