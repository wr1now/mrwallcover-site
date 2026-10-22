"""Offline image-build guards; no Modal import, archive download or model setup."""
import ast
import hashlib
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


class WorkerImageTests(unittest.TestCase):
    def test_archive_integrity_gate_accepts_exact_bytes_and_rejects_changed_bytes(self):
        source=ast.parse(Path(__file__).with_name('modal_app.py').read_text())
        constants={node.targets[0].id:ast.literal_eval(node.value) for node in source.body
            if isinstance(node,ast.Assign) and isinstance(node.targets[0],ast.Name)
            and node.targets[0].id in ('BLENDER_SHA256','BLENDER_VERIFY_CODE')}
        self.assertRegex(constants['BLENDER_SHA256'],r'^[a-f0-9]{64}$')
        with tempfile.TemporaryDirectory() as temporary:
            archive=Path(temporary)/'fixture.tar.xz'
            original=b'Original illustrative archive-integrity fixture'
            archive.write_bytes(original)
            command=[sys.executable,'-c',constants['BLENDER_VERIFY_CODE'],str(archive),hashlib.sha256(original).hexdigest()]
            accepted=subprocess.run(command,capture_output=True,text=True)
            self.assertEqual(accepted.returncode,0,accepted.stderr)
            archive.write_bytes(original+b'changed')
            rejected=subprocess.run(command,capture_output=True,text=True)
            self.assertNotEqual(rejected.returncode,0)
            self.assertIn('checksum mismatch; extraction stopped',rejected.stderr)
        # Check the actual image-build command links successful verification to
        # extraction, so a failed digest cannot proceed to tar in another step.
        calls=[node for node in ast.walk(source) if isinstance(node,ast.Call)
            and isinstance(node.func,ast.Attribute) and node.func.attr=='run_commands']
        self.assertEqual(len(calls),1)
        self.assertEqual(len(calls[0].args),2)
        command=ast.unparse(calls[0].args[1])
        self.assertIn('BLENDER_VERIFY_CODE',command)
        self.assertIn('BLENDER_SHA256',command)
        self.assertIn('&& mkdir -p /opt/blender && tar -xJf',command)


if __name__=='__main__':
    unittest.main()
