import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port === '5437')
  throw Error('Banco local descartável obrigatório.');
const db = new pg.Pool({ connectionString: url.toString() }),
  name = 'alvorada_test_' + randomUUID().replaceAll('-', '');
await db.query(`CREATE DATABASE "${name}"`);
try {
  url.pathname = '/' + name;
  process.exitCode = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        '--import',
        'tsx',
        ...(process.argv.includes('--browser')
          ? ['scripts/smoke-character-account.ts']
          : ['--test', 'tests/character-account-admin.test.ts']),
      ],
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
  await db.query(`DROP DATABASE "${name}" WITH(FORCE)`);
  await db.end();
}
