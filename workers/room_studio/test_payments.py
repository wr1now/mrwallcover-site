"""Run real refund/entitlement functions against offline transports; no Modal import."""
import ast
import os
import json
import sys
from pathlib import Path
import re
import tempfile
import unittest
from unittest.mock import patch
import subprocess
import urllib.error
import urllib.parse
from typing import Any

SOURCE=Path(__file__).with_name('modal_app.py')
def boundary(name, namespace):
    function=next(node for node in ast.parse(SOURCE.read_text()).body if isinstance(node,ast.FunctionDef) and node.name==name)
    exec(compile(ast.Module(body=[function],type_ignores=[]),str(SOURCE),'exec'),namespace)
    return namespace[name]

def asset_failure_reports():
    reports=[]
    for mime,content in [('image/png',b'\x89PNG\r\n\x1a\ninvalid'),('image/jpeg',b'\xff\xd8\xffinvalid'),('image/webp',b'RIFF\x04\x00\x00\x00WEBPinvalid')]:
        calls=[];invocations=[]
        job={'id':'job','type':'render','owner_id':'owner','project_id':'project','revision_id':'revision','order_id':'order','lease_token':'lease','input':{'orderId':'order','packageAssetId':'package','packageSha256':'hash'}}
        package={'projectId':'project','revisionId':'revision','textures':[{'id':'source','storagePath':'owner/project/source.png','sha256':'image-hash','widthPx':512,'heightPx':512}]}
        def asset(job,asset_id=None,storage_path=None):return {'kind':'package','sha256':'hash'} if asset_id else {'kind':'artwork','sha256':'image-hash'}
        namespace={'os':os,'json':json,'re':re,'Path':Path,'tempfile':tempfile,'subprocess':subprocess,'urllib':__import__('urllib'),'_uuid':lambda value:value,'TransientWorkerError':RuntimeError,'cleanup_unpublished_outputs':lambda job:None,'_active':lambda job:True,'_asset':asset,'_download':lambda asset:json.dumps(package).encode() if asset['kind']=='package' else content,'_rows':lambda *args:[{'payment_intent_id':'pi_paid','revision_id':'revision'}],'_rpc':lambda name,payload:calls.append((name,payload))}
        boundary('_clean_texture',namespace)
        with patch.dict(os.environ,{'ROOM_STUDIO_PAID_JOBS_ENABLED':'true'}),patch.object(subprocess,'run',side_effect=lambda *args,**kwargs:invocations.append(args)):
            boundary('process_job',namespace)(job)
        finish=next(payload for name,payload in calls if name=='room_finish_job')
        reports.append({'mime':mime,'finish':finish,'blenderInvocations':len(invocations)})
    return reports

class PaymentTests(unittest.TestCase):
    def run_refund(self, prior=None, fail=False, mismatch=False):
        order={'id':'order','payment_intent_id':'pi_offline','amount_pence':1500,'currency':'gbp','refund_token':'lease','refund_id':prior}
        calls=[]; claimed=False
        def rpc(name,payload):
            nonlocal claimed
            calls.append((name,payload))
            if name=='room_claim_refund':
                if claimed:return None
                claimed=True;return order
        def stripe(path,payload=None,key=None):
            calls.append(('stripe',(path,payload,key)))
            if fail:raise RuntimeError('offline transport failure')
            if path=='refunds/re_failed':return {'status':'failed'}
            return {'id':'re_result','payment_intent':'pi_offline','amount':1 if mismatch else 1500,'currency':'gbp','status':'pending' if prior=='re_pending' else 'succeeded'}
        namespace={'os':os,'re':re,'urllib':__import__('urllib'),'_rpc':rpc,'_rows':lambda *args:[],'_stripe_request':stripe}
        with patch.dict(os.environ,{'ROOM_STUDIO_STRIPE_SECRET_KEY':'sk_test_fixture','ROOM_STUDIO_PAID_JOBS_ENABLED':'false'}):boundary('payment_maintenance',namespace)()
        return calls

    def test_refund_continues_when_new_jobs_disabled(self):
        calls=self.run_refund();stripe=next(args for name,args in calls if name=='stripe')
        self.assertEqual(stripe[2],'room-refund-order')
        self.assertEqual([args['p_status'] for name,args in calls if name=='room_finish_refund'],['succeeded'])
        self.assertFalse(any(name=='room_finish_job' for name,_ in calls))

    def test_lost_response_keeps_stable_key_and_refund_obligation(self):
        calls=self.run_refund(fail=True)
        self.assertEqual([args['p_status'] for name,args in calls if name=='room_finish_refund'],['failed'])
        self.assertIsNone(next(args for name,args in calls if name=='room_finish_refund')['p_refund'])
        self.assertEqual(next(args for name,args in calls if name=='stripe')[2],'room-refund-order')

    def test_pending_refund_is_polled_without_another_refund(self):
        calls=self.run_refund(prior='re_pending');stripe=[args for name,args in calls if name=='stripe']
        self.assertEqual(len(stripe),1);self.assertEqual(stripe[0][0],'refunds/re_pending')
        self.assertEqual(next(args for name,args in calls if name=='room_finish_refund')['p_status'],'pending')

    def test_failed_provider_refund_gets_new_generation(self):
        calls=self.run_refund(prior='re_failed');stripe=[args for name,args in calls if name=='stripe']
        self.assertEqual(stripe[-1][2],'room-refund-order-after-re_failed')

    def test_partial_or_mismatched_refund_remains_unresolved(self):
        calls=self.run_refund(mismatch=True)
        self.assertEqual(next(args for name,args in calls if name=='room_finish_refund')['p_status'],'failed')

    def test_render_worker_rejects_missing_paid_order_before_blender(self):
        calls=[]
        class TransientWorkerError(Exception):pass
        namespace={'os':os,'Path':Path,'tempfile':tempfile,'subprocess':subprocess,'urllib':__import__('urllib'),'TransientWorkerError':TransientWorkerError,'cleanup_unpublished_outputs':lambda job:None,'_active':lambda job:True,'_rpc':lambda name,payload:calls.append((name,payload))}
        job={'id':'job','type':'render','owner_id':'owner','project_id':'project','lease_token':'lease','input':{}}
        with patch.dict(os.environ,{'ROOM_STUDIO_PAID_JOBS_ENABLED':'true'}):boundary('process_job',namespace)(job)
        self.assertEqual(len(calls),1);self.assertEqual(calls[0][0],'room_finish_job');self.assertFalse(calls[0][1]['p_success'])

    def test_killed_attempt_cleanup_claims_before_deletion_and_restores_capacity(self):
        calls=[]
        def rpc(name,args):
            calls.append((name,args))
            return {'id':'asset','storage_path':'private/orphan.png'} if name=='room_claim_output_cleanup' else None
        namespace={'BUCKET':'room-studio','_rpc':rpc,'_service':lambda *args:calls.append(('delete',args))}
        boundary('cleanup_output_asset',namespace)('job','asset')
        self.assertEqual([name for name,_ in calls],['room_claim_output_cleanup','delete','room_release_output'])

    def test_lost_success_response_cannot_delete_delivered_outputs(self):
        calls=[]
        namespace={'BUCKET':'room-studio','_rpc':lambda *args:None,'_service':lambda *args:calls.append(args)}
        boundary('cleanup_output_asset',namespace)('job','asset')
        self.assertFalse(calls)

    def test_reconciliation_recovers_a_paid_session_after_webhook_loss(self):
        calls=[];order={'id':'order','state':'expired','checkout_session_id':'cs_offline'}
        session={'payment_status':'paid','client_reference_id':'order','payment_intent':'pi_offline','amount_total':1500,'currency':'gbp','metadata':{'orderId':'order','ownerId':'owner','projectId':'project','revisionId':'revision','packageSha256':'hash'}}
        namespace={'os':os,'re':re,'urllib':__import__('urllib'),'_uuid':lambda value:value,'_rows':lambda *args:[order],'_rpc':lambda *args:calls.append(args),'_service':lambda *args:calls.append(('patch',args)),'_stripe_request':lambda *args:session}
        with patch.dict(os.environ,{'ROOM_STUDIO_STRIPE_SECRET_KEY':'sk_test_fixture','ROOM_STUDIO_PAID_JOBS_ENABLED':'false'}):boundary('payment_maintenance',namespace)()
        received=next(args for name,args in calls if name=='room_receive_payment')
        self.assertEqual(received['p_event'],'evt_reconcile_cs_offline');self.assertEqual(received['p_amount'],1500)
        self.assertTrue(any(name=='patch' for name,_ in calls))

    def test_corrupt_containers_fail_before_blender_without_publishing_outputs(self):
        for report in asset_failure_reports():
            self.assertFalse(report['finish']['p_success']);self.assertFalse(report['finish']['p_retryable'])
            self.assertEqual(report['finish']['p_outputs'],[]);self.assertEqual(report['blenderInvocations'],0)

if __name__=='__main__':
    if '--asset-failure-reports' in sys.argv:print(json.dumps(asset_failure_reports()))
    else:unittest.main(verbosity=2)
