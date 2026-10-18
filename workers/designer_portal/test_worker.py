"""Synthetic adapter tests: no cloud, customer documents or scanner network calls."""
import hashlib
import os
import unittest
from unittest.mock import patch
import worker

STUDIO = '11111111-1111-4111-8111-111111111111'
PROJECT = '22222222-2222-4222-8222-222222222222'
LEASE = '33333333-3333-4333-8333-333333333333'


def job(kind='document.verify'):
    content = b'Wall width: 3000 mm'
    return {'id': '44444444-4444-4444-8444-444444444444', 'studio_id': STUDIO,
            'project_id': PROJECT, 'lease_token': LEASE, 'type': kind,
            'input': {'bucket': 'designer-portal', 'storagePath': f'{STUDIO}/{PROJECT}/source.txt',
                      'fileName': 'source.txt', 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest(), 'documentId': 'document-1'}}


class WorkerTest(unittest.TestCase):
    def test_environment_disabled_does_not_touch_cloud(self):
        with patch.dict(os.environ, {'DESIGNER_PORTAL_WORKERS_ENABLED': 'false'}), patch.object(worker, 'rpc') as rpc:
            self.assertEqual(worker.run_once(), {'enabled': False})
            rpc.assert_not_called()

    def test_path_cannot_escape_studio(self):
        for value in [f'{STUDIO}/{PROJECT}/../other', f'{PROJECT}/{STUDIO}/source.txt', 'https://example.invalid/source']:
            with self.assertRaises(ValueError): worker.safe_path(job(), value)

    def test_verified_document_requires_scanner_and_hash(self):
        content = b'Wall width: 3000 mm'
        with patch.object(worker, 'active', return_value=True), patch.object(worker, 'service', return_value=content), patch.object(worker, 'scan') as scan, patch.object(worker, 'rpc') as rpc:
            worker.process_job(job())
            scan.assert_called_once()
            output = rpc.call_args.args[1]
            self.assertTrue(output['p_success'])
            self.assertEqual(output['p_output']['sha256'], hashlib.sha256(content).hexdigest())

    def test_hash_mismatch_cannot_become_verified(self):
        with patch.object(worker, 'active', return_value=True), patch.object(worker, 'service', return_value=b'Wall width: 9000 mm'), patch.object(worker, 'scan') as scan, patch.object(worker, 'rpc') as rpc:
            worker.process_job(job())
            self.assertFalse(rpc.call_args.args[1]['p_success'])
            scan.assert_not_called()

    def test_scanner_unavailability_is_retryable_and_quarantined(self):
        with patch.object(worker, 'active', return_value=True), patch.object(worker, 'service', return_value=b'Wall width: 3000 mm'), patch.object(worker, 'scan', side_effect=worker.TemporaryFailure('Document scanner unavailable; file remains quarantined')), patch.object(worker, 'rpc') as rpc:
            worker.process_job(job())
            output = rpc.call_args.args[1]
            self.assertFalse(output['p_success'])
            self.assertTrue(output['p_retryable'])

    def test_pdf_output_is_unique_to_lease(self):
        data = job('estimate.pdf')
        data['input'] = {'storagePath': f'{STUDIO}/{PROJECT}/estimate.pdf', 'publicEstimate': {}}
        with patch.object(worker, 'active', return_value=True), patch.object(worker, 'render_estimate', return_value=b'%PDF-test'), patch.object(worker, 'service') as service, patch.object(worker, 'rpc') as rpc:
            worker.process_job(data)
            path = f'{STUDIO}/{PROJECT}/estimate.{LEASE}.pdf'
            self.assertEqual(rpc.call_args.args[1]['p_output']['storagePath'], path)
            self.assertIn(path, service.call_args.args[0])

    def test_uncertain_publication_does_not_delete_committed_pdf(self):
        data = job('estimate.pdf')
        data['input'] = {'storagePath': f'{STUDIO}/{PROJECT}/estimate.pdf', 'publicEstimate': {}}
        with patch.object(worker, 'active', return_value=True), patch.object(worker, 'render_estimate', return_value=b'%PDF-test'), patch.object(worker, 'service') as service, patch.object(worker, 'rpc', side_effect=[worker.TemporaryFailure('Private service is temporarily unavailable'), None]):
            worker.process_job(data)
            self.assertFalse(any(len(call.args) > 1 and call.args[1] == 'DELETE' for call in service.call_args_list))

    def test_failure_messages_exclude_document_and_secret_content(self):
        with patch.object(worker, 'active', side_effect=ValueError('PRIVATE PROJECT OR SECRET')), patch.object(worker, 'rpc') as rpc:
            worker.process_job(job())
            self.assertNotIn('PRIVATE', str(rpc.call_args))


if __name__ == '__main__': unittest.main()
