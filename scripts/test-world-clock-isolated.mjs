import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw Error('PostgreSQL local obrigatório');
const admin = new pg.Pool({ connectionString: url.toString() }),
  name = 'alvorada_test_' + randomUUID().replaceAll('-', '');
await admin.query('CREATE DATABASE "' + name + '"');
try {
  url.pathname = '/' + name;
  process.exitCode = await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['--import', 'tsx', '--test', 'tests/world-clock.test.ts'], {
      env: { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: 'test' },
      windowsHide: true,
      stdio: 'inherit',
    });
    p.on('error', reject);
    p.on('exit', (c) => resolve(c ?? 1));
  });
} finally {
  await admin.query('DROP DATABASE "' + name + '" WITH (FORCE)');
  await admin.end();
}
