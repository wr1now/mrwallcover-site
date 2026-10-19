"""Synthetic diagnostics only: no cloud, antivirus downloads or customer files."""
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import diagnostics

NOW = 1_792_411_200
PRIVATE = 'PRIVATE-CREDENTIAL-OR-DOCUMENT'


def header(built=NOW - 3600, version=100):
    value = f'ClamAV-VDB:metadata:{version}:10:90:checksum:signature:builder:{built}'.encode()
    return value.ljust(diagnostics.HEADER_BYTES, b' ')


class DiagnosticsTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.paths = tuple(Path(self.temporary.name)/name for name in ('daily.cvd', 'daily.cld'))
        self.path_patch = patch.object(diagnostics, 'DEFINITION_PATHS', self.paths)
        self.path_patch.start()
        self.addCleanup(self.path_patch.stop)
        self.clock_patch = patch.object(diagnostics.time, 'time', return_value=NOW)
        self.clock_patch.start()
        self.addCleanup(self.clock_patch.stop)

    def test_no_configuration_or_definitions_cannot_claim_health(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(diagnostics.shutil, 'which', return_value=None):
            result = diagnostics.runtime_diagnostics()
        self.assertEqual(result['runtime'], {'region': None, 'environment': None, 'imageId': None, 'cloudProvider': None})
        self.assertFalse(result['scanner']['executableAvailable'])
        self.assertFalse(result['ocr']['executableAvailable'])
        self.assertEqual(result['scanner']['definitionsStatus'], 'missing')
        self.assertFalse(result['scanner']['definitionsFresh'])

    def test_only_allowlisted_runtime_metadata_and_definition_age_leave_probe(self):
        self.paths[0].write_bytes(header()+PRIVATE.encode())
        env = {'MODAL_REGION': 'uk', 'MODAL_ENVIRONMENT': 'mrwallcover-designer-staging',
               'MODAL_IMAGE_ID': 'im-ABC123', 'MODAL_CLOUD_PROVIDER': 'aws', 'SUPABASE_SERVICE_ROLE_KEY': PRIVATE,
               'MODAL_IDENTITY_TOKEN': PRIVATE, 'PROJECT_ADDRESS': PRIVATE}
        with patch.dict(os.environ, env, clear=True), \
             patch.object(diagnostics.shutil, 'which', return_value='/private/unused/clamscan'), \
             patch.object(socket.socket, 'connect', side_effect=AssertionError('Outbound network prohibited')), \
             patch.object(subprocess, 'Popen', side_effect=AssertionError('Subprocess prohibited')):
            result = diagnostics.runtime_diagnostics()
        self.assertEqual(result['runtime']['region'], 'uk')
        self.assertEqual(result['runtime']['cloudProvider'], 'aws')
        self.assertTrue(result['ocr']['executableAvailable'])
        self.assertEqual(result['scanner']['definitionAgeSeconds'], 3600)
        self.assertTrue(result['scanner']['definitionsFresh'])
        self.assertEqual(result['scanner']['definitionsUpdatedAt'], datetime.fromtimestamp(NOW-3600, timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'))
        output = json.dumps(result)
        for excluded in (PRIVATE, '/private/unused', 'metadata', 'checksum', 'signature', 'builder'):
            self.assertNotIn(excluded, output)
        self.assertLess(len(output), 1024)

    def test_freshness_boundary_future_and_stale_are_explicit(self):
        for age, status in ((diagnostics.MAX_DEFINITION_AGE_SECONDS, 'fresh'),
                            (diagnostics.MAX_DEFINITION_AGE_SECONDS+1, 'stale'), (-1, 'future')):
            with self.subTest(status=status):
                self.paths[0].write_bytes(header(NOW-age))
                result = diagnostics._definitions()
                self.assertEqual(result['definitionsStatus'], status)
                self.assertEqual(result['definitionsFresh'], status == 'fresh')

    def test_higher_version_controls_age_instead_of_newer_timestamp(self):
        self.paths[0].write_bytes(header(NOW-diagnostics.MAX_DEFINITION_AGE_SECONDS-1, version=101))
        self.paths[1].write_bytes(header(NOW-10, version=100))
        self.assertEqual(diagnostics._definitions()['definitionsStatus'], 'stale')

    def test_invalid_database_cannot_be_hidden_by_a_fresh_duplicate(self):
        for content in (b'short', b'X'*512, header().replace(b'ClamAV-VDB', b'OTHER--VDB'),
                        header(built=0), header(built=999999999999)):
            with self.subTest(content=content[:10]):
                self.paths[0].write_bytes(content)
                self.paths[1].write_bytes(header())
                result = diagnostics._definitions()
                self.assertEqual(result['definitionsStatus'], 'unreadable_or_invalid')
                self.assertFalse(result['definitionsFresh'])
                self.assertIsNone(result['definitionsUpdatedAt'])

    def test_links_and_non_regular_files_are_not_read(self):
        private_path = Path(self.temporary.name)/'private.txt'
        private_path.write_text(PRIVATE)
        self.paths[0].symlink_to(private_path)
        self.assertEqual(diagnostics._definitions()['definitionsStatus'], 'unreadable_or_invalid')
        self.paths[0].unlink()
        os.mkfifo(self.paths[0])
        self.assertEqual(diagnostics._definitions()['definitionsStatus'], 'unreadable_or_invalid')

    def test_malformed_runtime_values_are_not_echoed(self):
        with patch.dict(os.environ, {'MODAL_REGION': PRIVATE+'\n', 'MODAL_ENVIRONMENT': 'a'*129,
                                     'MODAL_IMAGE_ID': PRIVATE, 'MODAL_CLOUD_PROVIDER': PRIVATE}, clear=True):
            result = diagnostics.runtime_diagnostics()
        self.assertEqual(result['runtime'], {'region': None, 'environment': None, 'imageId': None, 'cloudProvider': None})
        self.assertNotIn(PRIVATE, json.dumps(result))

    def test_scanner_and_ocr_availability_are_independent(self):
        with patch.object(diagnostics.shutil, 'which', side_effect=lambda name: '/unused/clamscan' if name == diagnostics.CLAMSCAN_EXECUTABLE else None) as lookup:
            result = diagnostics.runtime_diagnostics()
        self.assertTrue(result['scanner']['executableAvailable'])
        self.assertFalse(result['ocr']['executableAvailable'])
        self.assertEqual([call.args for call in lookup.call_args_list], [(diagnostics.CLAMSCAN_EXECUTABLE,), ('tesseract',)])

    def test_probe_takes_no_input(self):
        with self.assertRaises(TypeError):
            diagnostics.runtime_diagnostics(PRIVATE)


if __name__ == '__main__':
    unittest.main()
