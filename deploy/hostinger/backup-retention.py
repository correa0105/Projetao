"""Retain the current PostgreSQL backup and its two predecessors."""
import argparse
import datetime
import json
import os
from pathlib import Path
import stat
import subprocess
import time


def regular(path, root):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or path.resolve().parent != root:
        raise RuntimeError('Arquivo de backup fora do diretório permitido ou não regular.')
    return info


def verify(project, path):
    with path.open('rb') as stream:
        subprocess.run(
            ['docker', 'compose', '--env-file', '.env.hostinger', '-f',
             'compose.hostinger.yaml', 'exec', '-T', 'db', 'pg_restore', '--file=/dev/null'],
            cwd=project, stdin=stream, stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE, check=True,
        )


def retain(project, apply=False, verifier=verify):
    project = Path(project).resolve()
    root = (project / 'backups').resolve()
    if root.parent != project or root.is_symlink():
        raise RuntimeError('Diretório de backups inválido.')
    files = [(p, regular(p, root)) for p in root.glob('*.dump')]
    files.sort(key=lambda pair: (pair[1].st_mtime_ns, pair[0].name), reverse=True)
    kept, obsolete = files[:3], files[3:]
    if not kept:
        raise RuntimeError('Nenhum backup completo disponível; nada foi excluído.')
    cutoff = min(info.st_mtime for _, info in kept)
    archives = []
    for p in root.glob('checkpoint-archive-*/release-checkpoints.tar.zst'):
        parent = p.parent.resolve()
        if parent.parent != root or p.parent.is_symlink():
            raise RuntimeError('Arquivo consolidado fora do diretório de backups.')
        info = regular(p, parent)
        if info.st_mtime < cutoff:
            archives.append((p, info))
    partials = [(p, regular(p, root)) for p in root.glob('*.dump.partial')]
    obsolete += [(p, info) for p, info in partials if info.st_mtime < time.time() - 86400]
    obsolete += archives
    report = {
        'retention': 3, 'applied': apply,
        'created_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'kept': [p.relative_to(root).as_posix() for p, _ in kept],
        'removed': [p.relative_to(root).as_posix() for p, _ in obsolete],
        'freed_bytes': sum(info.st_size for _, info in obsolete),
    }
    if not apply:
        return report
    # Validate every retained dump in full before removing any earlier copy.
    for path, before in kept:
        verifier(project, path)
        after = regular(path, root)
        if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
            raise RuntimeError('Backup mudou durante a verificação; nada foi excluído.')
    for path, before in obsolete:
        after = regular(path, path.parent.resolve())
        if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
            raise RuntimeError('Cópia antiga mudou durante a verificação.')
    temporary = root / 'retention-last.json.tmp'
    with temporary.open('w', encoding='utf8') as stream:
        os.chmod(temporary, 0o600)
        json.dump(report, stream, indent=2)
    temporary.replace(root / 'retention-last.json')
    for path, _ in obsolete:
        path.unlink()
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    print(json.dumps(retain(Path(__file__).resolve().parents[2], apply=args.apply)))
