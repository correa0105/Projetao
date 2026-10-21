import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import pg from 'pg';

test(
  'a new database is migrated before authentication validates its schema',
  { timeout: 45_000 },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.match(url.pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
    assert(['localhost', '127.0.0.1'].includes(url.hostname));
    const admin = new pg.Pool({ connectionString: url.toString() });
    const database = 'alvorada_test_' + randomUUID().replaceAll('-', '');
    const reserve = createServer();
    await new Promise<void>((resolve) => reserve.listen(0, '127.0.0.1', resolve));
    const address = reserve.address();
    assert(address && typeof address !== 'string');
    const port = address.port;
    await new Promise<void>((resolve) => reserve.close(() => resolve()));
    const origin = `http://127.0.0.1:${port}`;
    await admin.query(`CREATE DATABASE "${database}"`);
    url.pathname = '/' + database;
    const child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
      env: {
        ...process.env,
        DATABASE_URL: url.toString(),
        PORT: String(port),
        NODE_ENV: 'test',
        APP_ORIGIN: origin,
        BETTER_AUTH_URL: origin,
        BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
      },
      stdio: 'ignore',
      windowsHide: true,
    });
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
    try {
      let ready = false;
      for (let attempt = 0; attempt < 300; attempt++) {
        try {
          ready = (await fetch(origin + '/api/health')).ok;
        } catch {
          /* Still starting. */
        }
        if (ready || child.exitCode !== null) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert(ready, 'The new server must start successfully');
      const signup = await fetch(origin + '/api/auth/sign-up/email', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Fresh startup',
          email: randomUUID() + '@example.test',
          password: randomBytes(20).toString('hex'),
        }),
      });
      assert.equal(signup.status, 200);
      const cookie = signup.headers
        .getSetCookie()
        .map((header) => header.split(';')[0])
        .join('; ');
      await signup.arrayBuffer();
      const profile = await fetch(origin + '/api/me', { headers: { Cookie: cookie } });
      assert.equal(profile.status, 200);
      await profile.arrayBuffer();
    } finally {
      child.kill();
      await exited;
      await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
      await admin.end();
    }
  },
);
