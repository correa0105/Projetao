import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { transaction } from './db.js';

export async function migrate() {
  await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(74261923)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const folder = resolve('db/migrations');
    for (const name of (await readdir(folder)).filter((name) => name.endsWith('.sql')).sort()) {
      if ((await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name])).rowCount)
        continue;
      await client.query(await readFile(resolve(folder, name), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name]);
      console.log(`Migration: ${name}`);
    }
  });
}
