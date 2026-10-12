import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname))
  throw Error('PostgreSQL local requerido para testes isolados.');
const pool = new pg.Pool({ connectionString: url.toString() }),
  database = 'alvorada_test_' + randomUUID().replaceAll('-', '');
await pool.query(`CREATE DATABASE "${database}"`);
try {
  url.pathname = '/' + database;
  const args = process.argv.includes('--browser')
    ? ['--import', 'tsx', 'scripts/smoke-character-advancement.ts']
    : [
        '--import',
        'tsx',
        '--test',
        '--test-concurrency=1',
        ...(process.argv.includes('--all')
          ? ['tests/*.test.ts']
          : [
              'tests/character-advancement.test.ts',
              'tests/character-sheet.test.ts',
              'tests/srd-2024.test.ts',
              'tests/progression.test.ts',
              'tests/equipped-attacks.test.ts',
            ]),
      ];
  process.exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      env: { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: 'test' },
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('error', reject);
    child.on('exit', (c) => resolve(c ?? 1));
  });
} finally {
  await pool.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await pool.end();
}
