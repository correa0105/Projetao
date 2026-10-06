import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname))
  throw Error('PostgreSQL local obrigatório.');
const administrator = new pg.Pool({ connectionString: url.toString() });
const database = 'alvorada_test_' + randomUUID().replaceAll('-', '');
await administrator.query(`CREATE DATABASE "${database}"`);
try {
  url.pathname = '/' + database;
  process.exitCode = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', '--test', 'tests/vtt-art-http.test.ts'],
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
  await administrator.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await administrator.end();
}
