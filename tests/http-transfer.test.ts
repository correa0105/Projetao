import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { compressedBundle, sendCompressedJson } from '../server/http-transfer';

test('compressed JSON preserves the complete response and private no-store policy', async () => {
  const payload = { scene: 'águas', tokens: Array.from({ length: 100 }, (_, id) => ({ id, name: 'Guardião', hp: 25 })) };
  const app = express();
  app.get('/state', (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    return sendCompressedJson(req, res, payload);
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    for (const encoding of ['gzip', 'identity']) {
      const response = await fetch(origin + '/state', { headers: { 'Accept-Encoding': encoding } });
      assert.equal(response.headers.get('content-encoding'), encoding === 'gzip' ? 'gzip' : null);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.match(response.headers.get('vary')!, /Accept-Encoding/);
      assert.deepEqual(await response.json(), payload);
    }
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
});

test('build assets negotiate Brotli, gzip, identity and an absent Brotli file without changing bytes', async () => {
  const name = `transfer-${randomUUID()}.js`, file = `dist/client/assets/${name}`;
  const body = '/* arte preservada */\n' + 'const value = "Alvorada";\n'.repeat(100);
  await mkdir('dist/client/assets', { recursive: true });
  await Promise.all([writeFile(file, body), writeFile(file + '.gz', gzipSync(body)), writeFile(file + '.br', brotliCompressSync(body))]);
  const app = express(); app.use(compressedBundle); app.use(express.static('dist/client'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    for (const [accept, expected] of [['br, gzip', 'br'], ['gzip, br;q=0.5', 'gzip'], ['identity', null], ['br;q=0, gzip;q=0', null]] as const) {
      const response = await fetch(origin + '/assets/' + name, { headers: { 'Accept-Encoding': accept } });
      assert.equal(response.headers.get('content-encoding'), expected);
      assert.equal(await response.text(), body);
      if (expected) assert.match(response.headers.get('cache-control')!, /immutable/);
    }
    await rm(file + '.br');
    const fallback = await fetch(origin + '/assets/' + name, { headers: { 'Accept-Encoding': 'br, gzip' } });
    assert.equal(fallback.headers.get('content-encoding'), 'gzip');
    assert.equal(await fallback.text(), body);
  } finally {
    server.closeAllConnections(); await new Promise<void>(r => server.close(() => r()));
    await Promise.all([file, file + '.gz', file + '.br'].map(path => rm(path, { force: true })));
  }
});
