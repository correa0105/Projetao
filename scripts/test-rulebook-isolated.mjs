import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname))
  throw new Error('Use PostgreSQL local para testes isolados.');
const admin = new pg.Pool({ connectionString: url.toString() });
const database = 'alvorada_test_' + randomUUID().replaceAll('-', '');
await admin.query(`CREATE DATABASE "${database}"`);
try {
  url.pathname = '/' + database;
  process.exitCode = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      process.argv.includes('--browser')
        ? ['--import', 'tsx', 'scripts/smoke-rulebook.ts']
        : ['--import', 'tsx', '--test', '--test-concurrency=1', 'tests/rulebook.test.ts'],
      {
        env: { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: 'test' },
        stdio: 'inherit',
        windowsHide: true,
      },
    );
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
} finally {
  // The only deletion target is the fresh UUID database created above.
  await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await admin.end();
}
