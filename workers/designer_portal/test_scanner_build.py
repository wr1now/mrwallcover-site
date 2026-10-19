"""Synthetic image-setup checks: no real package download, install or updater."""
import hashlib
import io
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import scanner_build
import scanner_config


class ScannerBuildTest(unittest.TestCase):
    def test_reviewed_artifact_manifest_and_common_paths(self):
        self.assertEqual(scanner_config.CLAMAV_VERSION, '1.4.6')
        self.assertEqual(scanner_config.CLAMAV_PACKAGE_VERSION, '1.4.6-1')
        self.assertEqual(scanner_config.CLAMAV_PACKAGE_URL, 'https://github.com/Cisco-Talos/clamav/releases/download/clamav-1.4.6/clamav-1.4.6.linux.x86_64.deb')
        self.assertEqual(scanner_config.CLAMAV_PACKAGE_SHA256, 'd3ee9e401974855a1edc1761b1425417d126de618d5f0c91cd51209f69f6fcc2')
        self.assertEqual(scanner_config.CLAMAV_PACKAGE_BYTES, 94_663_320)
        self.assertEqual(scanner_config.CLAMSCAN_EXECUTABLE, '/usr/local/bin/clamscan')
        self.assertEqual(scanner_config.SCANNER_DATABASE_DIRECTORY, '/var/lib/clamav')

    def test_download_checks_digest_size_and_bounds_before_any_install(self):
        expected = b'synthetic verified package'
        for actual, succeeds in ((expected, True), (b'X'*len(expected), False), (expected[:-1], False), (expected+b'X', False)):
            with self.subTest(succeeds=succeeds, size=len(actual)), tempfile.TemporaryDirectory() as temporary:
                path = Path(temporary)/'test.deb'
                with patch.object(scanner_build, 'CLAMAV_PACKAGE_BYTES', len(expected)), \
                     patch.object(scanner_build, 'CLAMAV_PACKAGE_SHA256', hashlib.sha256(expected).hexdigest()), \
                     patch.object(scanner_build.urllib.request, 'urlopen', return_value=io.BytesIO(actual)), \
                     patch.object(scanner_build, '_command') as command:
                    if succeeds:
                        scanner_build._download(path)
                        self.assertEqual(path.read_bytes(), expected)
                    else:
                        with self.assertRaisesRegex(RuntimeError, 'limit|mismatch'):
                            scanner_build._download(path)
                    command.assert_not_called()

    def test_tampered_download_cannot_reach_package_installation(self):
        with patch.object(scanner_build, '_validate_architecture'), \
             patch.object(scanner_build, '_download', side_effect=RuntimeError('checksum mismatch')), \
             patch.object(scanner_build, '_command') as command, patch.object(scanner_build, '_configure') as configuration:
            with self.assertRaisesRegex(RuntimeError, 'checksum mismatch'):
                scanner_build.install_scanner()
            command.assert_not_called()
            configuration.assert_not_called()

    def test_non_x86_or_non_debian_builder_is_rejected(self):
        for system, machine, arch in (('Darwin', 'x86_64', 'amd64'), ('Linux', 'aarch64', 'arm64'), ('Linux', 'x86_64', 'arm64')):
            with self.subTest(system=system, machine=machine, arch=arch), \
                 patch.object(scanner_build.platform, 'system', return_value=system), \
                 patch.object(scanner_build.platform, 'machine', return_value=machine), \
                 patch.object(scanner_build, '_command', return_value=SimpleNamespace(stdout=arch)):
                with self.assertRaisesRegex(RuntimeError, 'requires'):
                    scanner_build._validate_architecture()

    def test_package_metadata_must_match_reviewed_version_and_architecture(self):
        for control, succeeds in (('Package: clamav\nVersion: 1.4.6-1\nArchitecture: amd64\n', True),
                                  ('Package: clamav\nVersion: 1.4.3-1\nArchitecture: amd64\n', False),
                                  ('Package: clamav\nVersion: 1.4.6-1\nArchitecture: arm64\n', False),
                                  ('Package: other\nVersion: 1.4.6-1\nArchitecture: amd64\n', False)):
            with self.subTest(control=control), patch.object(scanner_build, '_command', return_value=SimpleNamespace(stdout=control)):
                if succeeds:
                    scanner_build._validate_package(Path('/synthetic/test.deb'))
                else:
                    with self.assertRaisesRegex(RuntimeError, 'identity mismatch'):
                        scanner_build._validate_package(Path('/synthetic/test.deb'))

    def test_old_executable_or_version_prefix_is_rejected(self):
        for version, succeeds in (('ClamAV 1.4.6/28158/Mon Oct 19', True), ('ClamAV 1.4.3', False), ('ClamAV 1.4.60', False)):
            with self.subTest(version=version), patch.object(scanner_build, '_command', return_value=SimpleNamespace(stdout=version)):
                if succeeds:
                    scanner_build._verify_executables()
                else:
                    with self.assertRaisesRegex(RuntimeError, 'version mismatch'):
                        scanner_build._verify_executables()

    def test_configuration_exists_before_freshclam_version_and_update(self):
        with tempfile.TemporaryDirectory() as temporary:
            configuration = Path(temporary)/'freshclam.conf'
            calls = []
            def command(arguments, **_kwargs):
                calls.append(arguments)
                if arguments[0] == scanner_config.FRESHCLAM_EXECUTABLE:
                    self.assertTrue(configuration.is_file(), 'FreshClam parses its config even for --version')
                    self.assertIn('--config-file='+str(configuration), arguments)
                return SimpleNamespace(stdout='ClamAV 1.4.6\n')
            with patch.object(scanner_build, '_validate_architecture'), patch.object(scanner_build, '_download'), \
                 patch.object(scanner_build, '_validate_package'), \
                 patch.object(scanner_build, 'FRESHCLAM_CONFIGURATION', str(configuration)), \
                 patch.object(scanner_build, '_configure', side_effect=lambda: configuration.write_text(scanner_config.FRESHCLAM_CONFIGURATION_TEXT)), \
                 patch.object(scanner_build, '_command', side_effect=command):
                scanner_build.install_scanner()
            self.assertEqual(calls[1], ['/usr/local/bin/clamscan', '--version'])
            self.assertEqual(calls[2], ['/usr/local/bin/freshclam', '--version', '--config-file='+str(configuration)])
            self.assertEqual(calls[3], ['/usr/local/bin/freshclam', '--config-file='+str(configuration), '--stdout'])

    def test_build_failure_reports_command_and_safe_bounded_stderr(self):
        private = 'PRIVATE-CREDENTIAL-OR-PROJECT-CONTENT'
        for stderr, expected in (("ERROR: Can't open/parse the config file /private/"+private, 'cannot open or parse scanner configuration'),
                                  ('loader: error while loading shared libraries: libclamav.so.12: cannot open shared object file: '+private, 'shared library unavailable: libclamav.so.12'),
                                  (private*1000, 'unrecognized diagnostic withheld')):
            with self.subTest(expected=expected), \
                 patch.object(scanner_build.subprocess, 'run', side_effect=subprocess.CalledProcessError(1, ['ignored'], stderr=stderr)):
                with self.assertRaises(RuntimeError) as failure:
                    scanner_build._command(['/usr/local/bin/freshclam', '--version'])
                message = str(failure.exception)
                self.assertIn('freshclam exited 1', message)
                self.assertIn(expected, message)
                self.assertNotIn(private, message)
                self.assertLess(len(message), 300)

    def test_unapproved_commands_cannot_reuse_public_build_diagnostics(self):
        with patch.object(scanner_build.subprocess, 'run') as command:
            with self.assertRaisesRegex(RuntimeError, 'Unapproved'):
                scanner_build._command(['/unapproved/show-private-environment'])
            command.assert_not_called()

    def test_dedicated_freshclam_config_preserves_database_validation(self):
        text = scanner_config.FRESHCLAM_CONFIGURATION_TEXT
        self.assertEqual(text, 'DatabaseDirectory /var/lib/clamav\nDatabaseOwner clamav\nDatabaseMirror database.clamav.net\nTestDatabases yes\n')
        for disabled_check in ('NotifyClamd', 'TestDatabases no', 'DisableCertCheck', 'HTTPProxy', 'PrivateMirror'):
            self.assertNotIn(disabled_check, text)
        with tempfile.TemporaryDirectory() as temporary, \
             patch.object(scanner_build, 'SCANNER_DATABASE_DIRECTORY', str(Path(temporary)/'database')), \
             patch.object(scanner_build, 'FRESHCLAM_CONFIGURATION', str(Path(temporary)/'config/freshclam.conf')), \
             patch.object(scanner_build.grp, 'getgrnam', return_value=SimpleNamespace(gr_gid=100)), \
             patch.object(scanner_build.pwd, 'getpwnam', return_value=SimpleNamespace(pw_uid=100)), \
             patch.object(scanner_build.os, 'chown') as chown:
            scanner_build._configure()
            configuration = Path(temporary)/'config/freshclam.conf'
            self.assertEqual(configuration.read_text(), text)
            self.assertEqual(configuration.stat().st_mode & 0o777, 0o644)
            chown.assert_called_once_with(Path(temporary)/'database', 100, 100)

    def test_update_failure_fails_the_image_build(self):
        with patch.object(scanner_build, '_validate_architecture'), patch.object(scanner_build, '_download'), \
             patch.object(scanner_build, '_validate_package'), patch.object(scanner_build, '_verify_executables'), \
             patch.object(scanner_build, '_configure'), patch.object(scanner_build, '_command') as command:
            command.side_effect = [SimpleNamespace(stdout=''), RuntimeError('updater failed')]
            with self.assertRaisesRegex(RuntimeError, 'updater failed'):
                scanner_build.install_scanner()
            self.assertEqual(command.call_args.args[0], ['/usr/local/bin/freshclam', '--config-file=/etc/clamav/freshclam.conf', '--stdout'])


if __name__ == '__main__':
    unittest.main()
