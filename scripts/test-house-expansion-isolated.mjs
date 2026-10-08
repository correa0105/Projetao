import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw Error('Local PostgreSQL required.');
const pool = new pg.Pool({ connectionString: url.toString() }),
  database = 'alvorada_test_' + randomUUID().replaceAll('-', '');
await pool.query(`CREATE DATABASE "${database}"`);
try {
  url.pathname = '/' + database;
  process.exitCode = await new Promise((r, j) => {
    const p = spawn(process.execPath, ['--import', 'tsx', 'scripts/smoke-house-expansion.ts'], {
      env: { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: 'test' },
      stdio: 'inherit',
      windowsHide: true,
    });
    p.on('error', j);
    p.on('exit', (c) => r(c ?? 1));
  });
} finally {
  await pool.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await pool.end();
}
