import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import express from 'express';
import { pruneRetiredPublicImages, retirementTarget } from '../scripts/public-image-retirement';
import { publicImageNotFound } from '../server/public-image-not-found';
import { publicImageReplacements } from '../server/public-image-replacements';
import replacements from '../shared/public-image-replacements-20261029.json';
import retirement from '../data/public-image-retirements-20261029.json';

const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'alvorada-retirement-'));
  const old = Buffer.from('old original'),
    current = Buffer.from('current original');
  const shared = Buffer.from('shared derivative'),
    unused = Buffer.from('unused derivative');
  const sharedPath = '/optimized-images-20261028/' + hash(shared) + '.webp';
  const unusedPath = '/optimized-images-20261028/' + hash(unused) + '.webp';
  const files: [string, Buffer][] = [
    ['/old.png', old],
    ['/old-unique.png', old],
    ['/active.png', current],
    [sharedPath, shared],
    [unusedPath, unused],
  ];
  for (const [path, bytes] of files) {
    const f = retirementTarget(root, path);
    await mkdir(dirname(f), { recursive: true });
    await writeFile(f, bytes);
  }
  const images = {
    '/old.png': { file: sharedPath, sourceBytes: old.length, bytes: shared.length },
    '/old-unique.png': { file: unusedPath, sourceBytes: old.length, bytes: unused.length },
    '/active.png': { file: sharedPath, sourceBytes: current.length, bytes: shared.length },
  };
  await writeFile(
    join(root, 'optimized-images-20261028/manifest.json'),
    JSON.stringify({ images }),
  );
  const plan = {
    images: [
      { path: '/old.png', sha256: hash(old), bytes: old.length },
      { path: '/old-unique.png', sha256: hash(old), bytes: old.length },
    ],
    derivatives: [
      { path: sharedPath, sha256: hash(shared), bytes: shared.length },
      { path: unusedPath, sha256: hash(unused), bytes: unused.length },
    ],
  };
  return { root, plan, sharedPath, unusedPath, shared, current };
}
async function clean(root: string) {
  assert.equal(dirname(resolve(root)), resolve(tmpdir()));
  assert.match(basename(root), /^alvorada-retirement-/);
  await rm(root, { recursive: true, force: true });
}

test('retira originais e cópias exclusivas; preserva derivada compartilhada e imagem ativa', async () => {
  const f = await setup();
  try {
    assert.equal((await pruneRetiredPublicImages(f.root, f.plan)).removedFiles, 3);
    await assert.rejects(stat(join(f.root, 'old.png')), { code: 'ENOENT' });
    await assert.rejects(stat(retirementTarget(f.root, f.unusedPath)), { code: 'ENOENT' });
    assert.deepEqual(await readFile(retirementTarget(f.root, f.sharedPath)), f.shared);
    assert.deepEqual(await readFile(join(f.root, 'active.png')), f.current);
    const m = JSON.parse(
      await readFile(join(f.root, 'optimized-images-20261028/manifest.json'), 'utf8'),
    );
    assert.deepEqual(Object.keys(m.images), ['/active.png']);
    assert.equal(m.summary.optimized, 1);
    await pruneRetiredPublicImages(f.root, f.plan, true);
    assert.equal((await pruneRetiredPublicImages(f.root, f.plan)).removedFiles, 0);
  } finally {
    await clean(f.root);
  }
});
test('aborta antes de retirar qualquer arquivo se uma arte mudou; modo check não modifica', async () => {
  const f = await setup();
  try {
    await assert.rejects(pruneRetiredPublicImages(f.root, f.plan, true));
    await writeFile(join(f.root, 'old-unique.png'), 'new artwork at the same URL');
    await assert.rejects(pruneRetiredPublicImages(f.root, f.plan), /conteúdo alterado/);
    assert((await stat(join(f.root, 'old.png'))).isFile());
    assert((await stat(retirementTarget(f.root, f.unusedPath))).isFile());
    for (const p of ['/../outside.png', '/nested/../../outside.png', '/nested\\outside.png'])
      assert.throws(() => retirementTarget(f.root, p));
  } finally {
    await clean(f.root);
  }
});
test('imagens ausentes retornam 404 em GET/HEAD, inclusive codificadas; mantém imagens ativas e SPA', async () => {
  const f = await setup();
  await pruneRetiredPublicImages(f.root, f.plan);
  const app = express();
  app.use(express.static(f.root));
  app.use(publicImageNotFound);
  app.get('/{*splat}', (_req, res) => res.type('html').send('<main>SPA</main>'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const url = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
  try {
    for (const p of ['/old.png', '/old.png?original=1', '/old%2Epng', f.unusedPath])
      for (const method of ['GET', 'HEAD']) {
        const response = await fetch(url + p, { method, headers: { Accept: 'image/webp' } });
        assert.equal(response.status, 404, p);
        assert.equal(response.headers.get('cache-control'), 'no-store');
      }
    assert.deepEqual(
      Buffer.from(await (await fetch(url + '/active.png')).arrayBuffer()),
      f.current,
    );
    assert.equal((await fetch(url + '/profiles')).status, 200);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await clean(f.root);
  }
});

test('referências antigas recebem a arte atual sem restaurar arquivos legados ou alterar IDs', async () => {
  const [old, target] = Object.entries(replacements)[0];
  const root = await mkdtemp(join(tmpdir(), 'alvorada-retirement-'));
  const bytes = Buffer.from('current approved artwork');
  await mkdir(dirname(retirementTarget(root, target)), { recursive: true });
  await writeFile(retirementTarget(root, target), bytes);
  const app = express();
  app.use(publicImageReplacements);
  app.use(express.static(root));
  app.use(publicImageNotFound);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const url = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
  try {
    const response = await fetch(url + old + '?original=1', { redirect: 'manual' });
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('location'), target + '?original=1');
    assert.deepEqual(Buffer.from(await (await fetch(url + old)).arrayBuffer()), bytes);
    await assert.rejects(stat(retirementTarget(root, old)), { code: 'ENOENT' });
    const removed = new Set(retirement.images.map((e) => e.path));
    for (const [from, to] of Object.entries(replacements)) {
      assert(removed.has(from), from);
      assert(!removed.has(to), to);
      assert((await stat(retirementTarget('public', to))).isFile(), to);
    }
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await clean(root);
  }
});
