import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname))
  throw Error('Os controles devem ser testados em PostgreSQL local.');
const admin = new pg.Pool({ connectionString: url.toString() });
const database = 'alvorada_test_' + randomUUID().replaceAll('-', '');
await admin.query(`CREATE DATABASE "${database}"`);
try {
  url.pathname = '/' + database;
  const args = process.argv.includes('--warforged-reference-api')
    ? [
        '--test',
        '--test-concurrency=1',
        'tests/warforged-without-reference.test.ts',
        'tests/character-creation-recovery.test.ts',
      ]
    : process.argv.includes('--warforged')
      ? ['scripts/smoke-warforged-appearance.ts']
      : process.argv.includes('--beta-gold')
        ? [
            '--test',
            '--test-concurrency=1',
            'tests/beta-accounts.test.ts',
            'tests/open-beta-starting-gold.test.ts',
          ]
        : process.argv.includes('--shortcuts')
          ? ['scripts/smoke-vtt-shortcuts.ts']
          : process.argv.includes('--account-access')
            ? ['scripts/smoke-account-access.ts']
            : process.argv.includes('--creation-spells')
              ? ['scripts/smoke-creation-spells.ts']
              : process.argv.includes('--pins-browser')
                ? ['scripts/smoke-world-pins.ts']
                : process.argv.includes('--atlas-places')
                  ? ['--test', 'tests/atlas-places.test.ts']
                  : process.argv.includes('--guild-door')
                    ? ['scripts/smoke-guild-door.ts']
                    : process.argv.includes('--vtt-entry')
                      ? ['scripts/smoke-vtt-entry.ts']
                      : process.argv.includes('--assets')
                        ? ['scripts/smoke-site-loading.ts']
                        : process.argv.includes('--browser')
                          ? ['scripts/smoke-portal-controls.ts']
                          : ['--test', 'tests/board-moderation.test.ts'];
  process.exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', ...args], {
      env: {
        ...process.env,
        DATABASE_URL: url.toString(),
        NODE_ENV:
          process.argv.includes('--browser') ||
          process.argv.includes('--assets') ||
          process.argv.includes('--creation-spells') ||
          process.argv.includes('--account-access') ||
          process.argv.includes('--shortcuts') ||
          process.argv.includes('--warforged') ||
          process.argv.includes('--vtt-entry') ||
          process.argv.includes('--guild-door') ||
          process.argv.includes('--pins-browser')
            ? 'production'
            : 'test',
        MAINTENANCE_AREAS: '',
      },
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
