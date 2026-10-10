import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw Error('Local PostgreSQL required');
const admin = new pg.Pool({ connectionString: url.toString() }),
  database = 'alvorada_test_' + randomUUID().replaceAll('-', '');
await admin.query(`CREATE DATABASE "${database}"`);
try {
  url.pathname = '/' + database;
  process.exitCode = await new Promise((resolve, reject) => {
    const args = process.argv.includes('--equipment')
      ? ['--import', 'tsx', '--test', '--test-concurrency=1', 'tests/equipment.test.ts']
      : ['--import', 'tsx', 'scripts/smoke-shop-magic-completion.ts'];
    const p = spawn(process.execPath, args, {
      env: { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: 'test' },
      stdio: 'inherit',
      windowsHide: true,
    });
    p.on('error', reject);
    p.on('exit', (code) => resolve(code ?? 1));
  });
} finally {
  await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await admin.end();
}
