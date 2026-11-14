import importlib.util
import os
from pathlib import Path
import tempfile
import time
import unittest

spec = importlib.util.spec_from_file_location('retention', Path(__file__).resolve().parents[1] / 'deploy/hostinger/backup-retention.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class RetentionTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.project = Path(self.temporary.name)
        self.root = self.project / 'backups'
        self.root.mkdir()
        for i in range(5):
            p = self.root / ('backup-%d.dump' % i)
            p.write_bytes(b'PGDMP' + bytes([i]))
            os.utime(p, (1000 + i, 1000 + i))

    def test_preserves_three_and_configuration(self):
        (self.root / 'return.env').write_text('preservar')
        archive = self.root / 'checkpoint-archive-old' / 'release-checkpoints.tar.zst'
        archive.parent.mkdir()
        archive.write_bytes(b'antigo')
        os.utime(archive, (900, 900))
        checked = []
        report = module.retain(self.project, True, lambda _, p: checked.append(p.name))
        self.assertEqual(report['kept'], ['backup-4.dump', 'backup-3.dump', 'backup-2.dump'])
        self.assertEqual(checked, report['kept'])
        self.assertFalse(archive.exists())
        self.assertTrue((self.root / 'return.env').exists())
        self.assertEqual(len(list(self.root.glob('*.dump'))), 3)

    def test_failed_verification_deletes_nothing(self):
        def fail(*_):
            raise RuntimeError('inválido')
        with self.assertRaises(RuntimeError):
            module.retain(self.project, True, fail)
        self.assertEqual(len(list(self.root.glob('*.dump'))), 5)

    def test_dry_run_and_recent_partial(self):
        partial = self.root / 'active.dump.partial'
        partial.write_bytes(b'incompleto')
        old = self.root / 'failed.dump.partial'
        old.write_bytes(b'incompleto')
        os.utime(old, (time.time() - 90000, time.time() - 90000))
        report = module.retain(self.project)
        self.assertFalse(report['applied'])
        self.assertEqual(len(list(self.root.glob('*.dump'))), 5)
        module.retain(self.project, True, lambda *_: None)
        self.assertTrue(partial.exists())
        self.assertFalse(old.exists())

    def test_symlink_is_rejected(self):
        target = self.project / 'outside'
        target.write_bytes(b'preservar')
        try:
            (self.root / 'link.dump').symlink_to(target)
        except OSError:
            self.skipTest('Ambiente sem suporte a symlink')
        with self.assertRaises(RuntimeError):
            module.retain(self.project, True, lambda *_: None)
        self.assertTrue(target.exists())


if __name__ == '__main__':
    unittest.main()
