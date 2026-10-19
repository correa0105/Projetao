import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname))
  throw Error('PostgreSQL local obrigatório.');
const admin = new pg.Pool({ connectionString: url.toString() }),
  database = 'alvorada_test_' + randomUUID().replaceAll('-', '');
await admin.query(`CREATE DATABASE "${database}"`);
try {
  url.pathname = '/' + database;
  const tests = process.argv.slice(2).filter((a) => a.endsWith('.test.ts'));
  if (tests.some((a) => !/^tests\/[\w-]+\.test\.ts$/.test(a)))
    throw Error('Caminho de teste inválido.');
  process.exitCode = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      process.argv.includes('--details-browser')
        ? ['--import', 'tsx', 'scripts/smoke-guild-lore-sheet-refinements.ts']
        : process.argv.includes('--chat-browser')
          ? ['--import', 'tsx', 'scripts/smoke-rp-chat.ts']
          : process.argv.includes('--browser')
            ? ['--import', 'tsx', 'scripts/smoke-clothing-pieces-shelf.ts']
            : [
                '--import',
                'tsx',
                '--test',
                '--test-concurrency=1',
                ...(tests.length ? tests : ['tests/clothing-pieces-shelf.test.ts']),
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
  await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await admin.end();
}
