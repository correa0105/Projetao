import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname))
  throw new Error('Use PostgreSQL local para os testes isolados.');
const admin = new pg.Pool({ connectionString: url.toString() });
const database = 'alvorada_test_' + randomUUID().replaceAll('-', '');
await admin.query(`CREATE DATABASE "${database}"`);
try {
  url.pathname = '/' + database;
  const files = process.argv.includes('--all')
    ? (await readdir('tests'))
        .filter((file) => file.endsWith('.test.ts'))
        .map((file) => 'tests/' + file)
    : ['tests/equipment.test.ts', 'tests/equipment-illustrator.test.ts'];
  const args = process.argv.includes('--browser')
    ? [
        '--import',
        'tsx',
        'scripts/smoke-equipment.ts',
        ...(process.argv.includes('--unlimited') ? ['--unlimited'] : []),
      ]
    : ['--import', 'tsx', '--test', '--test-concurrency=1', ...files];
  process.exitCode = await new Promise((resolve, reject) => {
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
