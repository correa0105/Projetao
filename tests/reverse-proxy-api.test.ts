import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';

test('production proxy keeps authentication and API limits separate for 60 client IPs', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  const previous = process.env.TRUST_REVERSE_PROXY;
  process.env.TRUST_REVERSE_PROXY = '1';
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  try {
    // Sixty clients behind one proxy must not share the 30/min login budget.
    const responses = await Promise.all(
      Array.from({ length: 60 }, (_, index) =>
        fetch(`${base}/api/auth/sign-in/email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: origin,
            'X-Forwarded-For': `198.51.100.${index + 1}`,
            'X-Guild-Client-IP': '203.0.113.1',
          },
          body: JSON.stringify({
            email: 'missing-proxy-test@example.test',
            password: 'Invalid-password-test-only',
          }),
        }),
      ),
    );
    assert.deepEqual(
      responses.map((response) => response.status),
      Array(60).fill(401),
    );
    await Promise.all(responses.map((response) => response.arrayBuffer()));
    // 300 API requests exceed one IP's 240/min budget; each visitor makes five.
    for (let batch = 0; batch < 5; batch++) {
      const statuses = await Promise.all(
        Array.from({ length: 60 }, async (_, index) => {
          const response = await fetch(`${base}/api/me`, {
            headers: {
              'X-Forwarded-For': `198.51.100.${index + 1}`,
            },
          });
          await response.arrayBuffer();
          return response.status;
        }),
      );
      assert.deepEqual(statuses, Array(60).fill(401));
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (previous === undefined) delete process.env.TRUST_REVERSE_PROXY;
    else process.env.TRUST_REVERSE_PROXY = previous;
  }
});

test.after(() => pool.end());
