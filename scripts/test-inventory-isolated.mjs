import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname))
  throw new Error('O teste do inventário exige PostgreSQL local.');
const admin = new pg.Pool({ connectionString: url.toString() });
const database = 'alvorada_test_' + randomUUID().replaceAll('-', '');
await admin.query(`CREATE DATABASE "${database}"`);
try {
  url.pathname = '/' + database;
  process.exitCode = await new Promise((resolve, reject) => {
    const args = process.argv.includes('--tests')
      ? [
          '--import',
          'tsx',
          '--test',
          '--test-concurrency=1',
          'tests/inventory.test.ts',
          'tests/inventory-discard.test.ts',
        ]
      : ['--import', 'tsx', 'scripts/smoke-inventory.ts'];
    const child = spawn(process.execPath, args, {
      env: { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: 'test' },
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
} finally {
  await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await admin.end();
}
