import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname))
  throw Error('PostgreSQL local obrigatório.');
const admin = new pg.Pool({ connectionString: url.toString() }),
  database = 'alvorada_test_' + randomUUID().replaceAll('-', '');
await admin.query(`CREATE DATABASE "${database}"`);
try {
  url.pathname = '/' + database;
  const selected = process.argv.slice(2).filter((arg) => arg.endsWith('.test.ts'));
  if (selected.some((arg) => !/^tests\/[\w-]+\.test\.ts$/.test(arg)))
    throw Error('Use caminhos tests/nome.test.ts para selecionar testes.');
  const tests = process.argv.includes('--all')
    ? (await readdir('tests'))
        .filter((f) => f.endsWith('.test.ts'))
        .sort()
        .map((f) => 'tests/' + f)
    : selected.length
      ? selected
      : ['tests/mission-tags.test.ts'];
  process.exitCode = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      process.argv.includes('--browser')
        ? ['--import', 'tsx', 'scripts/smoke-shop-clothing.ts']
        : ['--import', 'tsx', '--test', '--test-concurrency=1', ...tests],
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
  await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await admin.end();
}
