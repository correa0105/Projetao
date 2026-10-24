import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveCodexCommand } from '../server/codex-command.js';
import { checkCodexLogin } from '../server/codex-illustrator.js';

test('a desktop update recovers a removed override and ignores empty version folders', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'codex-update-'));
  const root = join(temp, 'OpenAI', 'Codex', 'bin');
  try {
    for (const version of ['removed', 'older', 'current']) await mkdir(join(root, version), { recursive: true });
    const older = join(root, 'older', 'codex.exe'), current = join(root, 'current', 'codex.exe');
    await writeFile(older, 'old'); await writeFile(current, 'new');
    await utimes(older, new Date(0), new Date(0));
    const env = { CODEX_BIN: join(root, 'removed', 'codex.exe'), PATH: '', LOCALAPPDATA: temp };
    assert.deepEqual(resolveCodexCommand(env, 'win32'), { command: current, prefix: [] });
    await rm(current);
    assert.equal(resolveCodexCommand(env, 'win32').command, older, 'Each call checks the current installation');
    await rm(older);
    assert.throws(() => resolveCodexCommand(env, 'win32'), /Codex CLI não encontrado/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('an existing explicit executable is preserved', () => {
  assert.deepEqual(resolveCodexCommand({ CODEX_BIN: process.execPath, PATH: '' }), { command: process.execPath, prefix: [] });
});

test('a stale executable override falls back to the npm CLI and really checks login', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'codex-login-'));
  const entry = join(temp, 'node_modules', '@openai', 'codex', 'bin');
  const original = { CODEX_BIN: process.env.CODEX_BIN, PATH: process.env.PATH };
  try {
    await mkdir(entry, { recursive: true });
    await writeFile(join(entry, 'codex.js'), "console.log('Logged in using ChatGPT');");
    process.env.CODEX_BIN = join(temp, 'removed.exe');
    process.env.PATH = temp;
    await checkCodexLogin();
    await writeFile(join(entry, 'codex.js'), "console.log('Not logged in');");
    await assert.rejects(checkCodexLogin(), /Use codex login/);
  } finally {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    await rm(temp, { recursive: true, force: true });
  }
});
