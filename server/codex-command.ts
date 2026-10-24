import { existsSync, readdirSync, statSync } from 'node:fs';
import { delimiter, join } from 'node:path';

/** Resolve again on every invocation: desktop updates remove older versioned bins. */
export function resolveCodexCommand(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  node = process.execPath,
) {
  if (env.CODEX_BIN && existsSync(env.CODEX_BIN))
    return { command: env.CODEX_BIN, prefix: [] as string[] };
  for (const directory of (env.PATH || '').split(delimiter).filter(Boolean)) {
    const entry = join(directory, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    if (existsSync(entry)) return { command: node, prefix: [entry] };
    const executable = join(directory, platform === 'win32' ? 'codex.exe' : 'codex');
    if (existsSync(executable)) return { command: executable, prefix: [] as string[] };
  }
  if (platform === 'win32' && env.LOCALAPPDATA) {
    const root = join(env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin');
    try {
      const installed = readdirSync(root, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .flatMap(entry => {
          const command = join(root, entry.name, 'codex.exe');
          try {
            const file = statSync(command);
            return file.isFile() ? [{ command, modified: file.mtimeMs }] : [];
          } catch { return []; }
        })
        .sort((a, b) => b.modified - a.modified);
      if (installed[0]) return { command: installed[0].command, prefix: [] as string[] };
    } catch { /* A missing desktop install may still be repaired by the supervisor. */ }
  }
  throw new Error('Codex CLI não encontrado. Instale o Codex e execute codex login.');
}
