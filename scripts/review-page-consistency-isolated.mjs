import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw Error('Local PostgreSQL required');
const pool = new pg.Pool({ connectionString: url.toString() }),
  database = 'alvorada_test_' + randomUUID().replaceAll('-', '');
await pool.query(`CREATE DATABASE "${database}"`);
try {
  url.pathname = '/' + database;
  process.exitCode = await new Promise((resolve, reject) => {
    const processRun = spawn(
      process.execPath,
      ['--import', 'tsx', 'scripts/review-page-consistency.ts'],
      {
        env: { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: 'test' },
        stdio: 'inherit',
        windowsHide: true,
      },
    );
    processRun.on('error', reject);
    processRun.on('exit', (c) => resolve(c ?? 1));
  });
} finally {
  await pool.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await pool.end();
}
