import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticationClientIp, configureReverseProxy } from '../server/reverse-proxy.js';

async function withServer(enabled: string, run: (url: string) => Promise<void>) {
  const app = express();
  configureReverseProxy(app, enabled);
  app.use(authenticationClientIp);
  if (enabled === '1')
    app.use(
      rateLimit({ windowMs: 60_000, limit: 2, standardHeaders: false, legacyHeaders: false }),
    );
  app.get('/', (req, res) => res.json({ ip: req.ip, authIp: req.headers['x-guild-client-ip'] }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('direct access ignores forged forwarding and authentication IP headers', async () => {
  await withServer('', async (url) => {
    const response = await fetch(url, {
      headers: {
        'X-Forwarded-For': '198.51.100.10',
        'X-Guild-Client-IP': '198.51.100.11',
      },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ip: '127.0.0.1', authIp: '127.0.0.1' });
  });
});

test('one trusted proxy preserves independent rate budgets for 60 visitors', async () => {
  await withServer('1', async (url) => {
    await Promise.all(
      Array.from({ length: 60 }, async (_, i) => {
        const ip = `198.51.100.${i + 1}`;
        const response = await fetch(url, {
          headers: {
            'X-Forwarded-For': `203.0.113.99, ${ip}`,
            'X-Guild-Client-IP': '203.0.113.98',
          },
        });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ip, authIp: ip });
      }),
    );
    const sameClient = () => fetch(url, { headers: { 'X-Forwarded-For': '198.51.100.1' } });
    assert.equal((await sameClient()).status, 200);
    assert.equal((await sameClient()).status, 429);
    assert.equal(
      (await fetch(url, { headers: { 'X-Forwarded-For': '198.51.100.2' } })).status,
      200,
    );
  });
});

test('proxy trust is never enabled by ambiguous configuration', async () => {
  await withServer('true', async (url) => {
    const response = await fetch(url, { headers: { 'X-Forwarded-For': '198.51.100.1' } });
    assert.deepEqual(await response.json(), { ip: '127.0.0.1', authIp: '127.0.0.1' });
  });
});
