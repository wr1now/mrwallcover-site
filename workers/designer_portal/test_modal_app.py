"""Inspect deployment policy offline, without importing an authenticated SDK."""
import importlib.util
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch


class ImageStub:
    @classmethod
    def debian_slim(cls, **_kwargs):
        return cls()

    def __init__(self):
        self.packages, self.commands, self.local_files = [], [], []

    def apt_install(self, *args): self.packages.extend(args); return self
    def pip_install_from_requirements(self, *_args): return self
    def run_commands(self, *args): self.commands.extend(args); return self
    def add_local_file(self, *args, **kwargs): self.local_files.append((args, kwargs)); return self
    def add_local_dir(self, *_args, **_kwargs): return self
    def env(self, *_args): return self


class AppStub:
    def __init__(self, name):
        self.name, self.functions = name, {}

    def function(self, **options):
        def decorate(function):
            self.functions[function.__name__] = (function, options)
            return function
        return decorate


def load_definition(env):
    module_name = '_designer_modal_policy_test'
    fake_modal = SimpleNamespace(App=AppStub, Image=ImageStub,
        Period=lambda **options: ('period', options),
        Secret=SimpleNamespace(from_name=lambda name: ('secret', name)))
    spec = importlib.util.spec_from_file_location(module_name, Path(__file__).with_name('modal_app.py'))
    module = importlib.util.module_from_spec(spec)
    with patch.dict(os.environ, env, clear=True), patch.dict(sys.modules, {'modal': fake_modal}):
        spec.loader.exec_module(module)
    return module


class ModalPolicyTest(unittest.TestCase):
    def test_default_and_runtime_flags_do_not_install_schedules(self):
        for env in ({}, {'DESIGNER_PORTAL_WORKERS_ENABLED': 'true', 'DESIGNER_PORTAL_NOTIFICATIONS_ENABLED': 'true'},
                    {'DESIGNER_PORTAL_PROCESSING_SCHEDULE_ENABLED': 'TRUE', 'DESIGNER_PORTAL_NOTIFICATION_SCHEDULE_ENABLED': '1'}):
            with self.subTest(env=env):
                module = load_definition(env)
                for name in ('dispatch', 'dispatch_notifications'):
                    self.assertIsNone(module.app.functions[name][1]['schedule'])

    def test_schedules_are_independently_enabled_at_deployment(self):
        for enabled in ('PROCESSING', 'NOTIFICATION'):
            with self.subTest(enabled=enabled):
                module = load_definition({f'DESIGNER_PORTAL_{enabled}_SCHEDULE_ENABLED': 'true'})
                for flag, name in (('PROCESSING', 'dispatch'), ('NOTIFICATION', 'dispatch_notifications')):
                    schedule = module.app.functions[name][1]['schedule']
                    self.assertEqual(schedule, ('period', {'minutes': 1}) if flag == enabled else None)

    def test_diagnostic_is_unscheduled_regional_bounded_and_has_no_secrets(self):
        module = load_definition({})
        function, options = module.app.functions['diagnose_runtime']
        self.assertIs(options['image'], module.image)
        self.assertEqual((options['region'], options['routing_region']), ('uk', 'eu-west'))
        self.assertNotIn('secrets', options)
        self.assertNotIn('schedule', options)
        self.assertEqual(options['max_containers'], 1)
        self.assertEqual(options['timeout'], 15)
        self.assertEqual(options['cpu'], (0.125, 0.25))
        self.assertEqual(options['memory'], (256, 256))
        self.assertEqual(options['scaledown_window'], 2)
        with patch.dict(sys.modules, {'diagnostics': SimpleNamespace(runtime_diagnostics=lambda: {'synthetic': True})}):
            self.assertEqual(function(), {'synthetic': True})
            with self.assertRaises(TypeError):
                function('unaccepted document argument')

    def test_processing_functions_retain_secrets_and_european_routing(self):
        module = load_definition({})
        self.assertEqual(module.app.name, 'mrwallcover-designer-portal')
        for name in ('process_next', 'process_notification'):
            options = module.app.functions[name][1]
            self.assertEqual((options['region'], options['routing_region']), ('uk', 'eu-west'))
            self.assertEqual(options['secrets'], [('secret', 'mrwallcover-designer-portal')])

    def test_every_function_bounds_resources_and_scales_to_zero_without_platform_retries(self):
        module = load_definition({})
        expected = {
            'process_next': ((1, 1), (4096, 4096), 660, 2),
            'dispatch': ((0.125, 0.25), (256, 256), 750, 1),
            'process_notification': ((1, 1), (512, 512), 150, 1),
            'dispatch_notifications': ((0.125, 0.25), (256, 256), 240, 1),
            'diagnose_runtime': ((0.125, 0.25), (256, 256), 15, 1),
        }
        self.assertEqual(set(module.app.functions), set(expected))
        for name, (cpu, memory, timeout, containers) in expected.items():
            with self.subTest(function=name):
                options = module.app.functions[name][1]
                self.assertEqual(options['cpu'], cpu, 'a scalar request is not a CPU limit')
                self.assertEqual(options['memory'], memory, 'a scalar request is not a memory limit')
                self.assertEqual(options['timeout'], timeout)
                self.assertEqual(options['max_containers'], containers)
                self.assertEqual(options['startup_timeout'], 60)
                self.assertEqual(options['scaledown_window'], 2)
                self.assertEqual(options['min_containers'], 0)
                self.assertEqual(options['buffer_containers'], 0)
                self.assertEqual(options['retries'], 0, 'database leases own bounded retries')

    def test_dispatch_timeout_covers_child_startup_execution_and_response_margin(self):
        module = load_definition({})
        for dispatcher, worker in (('dispatch', 'process_next'),
                                   ('dispatch_notifications', 'process_notification')):
            with self.subTest(dispatcher=dispatcher):
                parent = module.app.functions[dispatcher][1]
                child = module.app.functions[worker][1]
                self.assertGreaterEqual(parent['timeout'], child['startup_timeout'] + child['timeout'] + 30)

    def test_image_installs_verified_upstream_scanner_not_stale_distribution_package(self):
        module = load_definition({})
        self.assertNotIn('clamav', module.image.packages)
        self.assertNotIn('clamav-freshclam', module.image.packages)
        self.assertIn('ca-certificates', module.image.packages)
        self.assertIn('tesseract-ocr', module.image.packages)
        self.assertIn('python /tmp/designer-scanner/scanner_build.py', module.image.commands)
        self.assertEqual({args[1] for args, _ in module.image.local_files},
                         {'/tmp/designer-scanner/scanner_build.py', '/tmp/designer-scanner/scanner_config.py'})
        self.assertTrue(all(kwargs.get('copy') is True for _, kwargs in module.image.local_files))


if __name__ == '__main__':
    unittest.main()
