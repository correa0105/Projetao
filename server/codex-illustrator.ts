import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, realpath, unlink } from 'node:fs/promises';
import { delimiter, isAbsolute, join, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import { races, classes } from '../shared/rules.js';

function codexCommand() {
  // Invoke executable or Node entry point directly. Never pass prompts through a shell.
  if (process.env.CODEX_BIN) return { command: process.env.CODEX_BIN, prefix: [] as string[] };
  for (const directory of (process.env.PATH || '').split(delimiter)) {
    const entry = join(directory, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    if (existsSync(entry)) return { command: process.execPath, prefix: [entry] };
    const executable = join(directory, process.platform === 'win32' ? 'codex.exe' : 'codex');
    if (existsSync(executable)) return { command: executable, prefix: [] as string[] };
  }
  throw new Error('Codex CLI não encontrado. Instale o Codex e execute codex login.');
}
async function runCodex(args: string[], prompt?: string, timeout = 15 * 60_000) {
  const { command, prefix } = codexCommand();
  const env = { ...process.env };
  delete env.OPENAI_API_KEY;
  delete env.CODEX_API_KEY;
  delete env.DATABASE_URL;
  delete env.BETTER_AUTH_SECRET;
  delete env.POSTGRES_PASSWORD;
  return new Promise<string>((resolveRun, reject) => {
    const child = spawn(command, [...prefix, ...args], {
      shell: false,
      windowsHide: true,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('O ilustrador excedeu o tempo limite.'));
    }, timeout);
    child.stdout.on('data', (chunk) => {
      stdout = (stdout + chunk.toString()).slice(-100_000);
    });
    // Never log the agent transcript or reference images.
    child.stderr.on('data', (chunk) => {
      if (args[0] === 'login') stdout = (stdout + chunk.toString()).slice(-100_000);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      code === 0
        ? resolveRun(stdout)
        : reject(
            new Error(
              'O Codex não concluiu a geração. Verifique a sessão e os limites da assinatura.',
            ),
          );
    });
    child.stdin.on('error', () => {});
    child.stdin.end(prompt || '');
  });
}
export async function checkCodexLogin() {
  const status = await runCodex(['login', 'status'], undefined, 30_000);
  if (!/ChatGPT/i.test(status) || /API key/i.test(status))
    throw new Error('Use codex login com sua conta ChatGPT.');
}

export async function generateCharacterArt(job: {
  id: string;
  reference: Buffer;
  race: string;
  class: string;
}) {
  z.string().uuid().parse(job.id);
  const race = z.enum(races).parse(job.race);
  const characterClass = z.enum(classes).parse(job.class);
  const directory = resolve('.local/character-art', job.id);
  await mkdir(directory, { recursive: true });
  const reference = join(directory, 'reference.png');
  const style = resolve('docs/references/character-style-v1.png');
  const resultPath = join(directory, 'result.json');
  const schema = join(directory, 'result-schema.json');
  await writeFile(reference, job.reference);
  await writeFile(
    schema,
    JSON.stringify({
      type: 'object',
      properties: { image_path: { type: 'string' }, error: { type: 'string' } },
      required: ['image_path', 'error'],
      additionalProperties: false,
    }),
  );
  const instructions = await readFile(resolve('docs/CHARACTER-ART-PROMPT-v1.md'), 'utf8');
  try {
    await runCodex(
      [
        'exec',
        '--ephemeral',
        '--ignore-user-config',
        '--skip-git-repo-check',
        '--color',
        'never',
        '--sandbox',
        'read-only',
        '-c',
        'forced_login_method="chatgpt"',
        '-c',
        'features.shell_tool=false',
        '--cd',
        directory,
        '--image',
        style,
        '--image',
        reference,
        '--output-schema',
        schema,
        '--output-last-message',
        resultPath,
        '-',
      ],
      `${instructions}\n\nRaça validada: ${race}. Classe validada: ${characterClass}. Gere agora usando a ferramenta nativa.`,
    );
    const result = z
      .object({ image_path: z.string(), error: z.string() })
      .parse(JSON.parse(await readFile(resultPath, 'utf8')));
    if (!result.image_path || result.error)
      throw new Error(
        'A ferramenta não entregou uma imagem. Verifique a disponibilidade de geração no Codex.',
      );
    const file = await realpath(result.image_path);
    const allowedRoots = [
      directory,
      resolve(process.env.CODEX_HOME || join(homedir(), '.codex'), 'generated_images'),
    ];
    const allowed = await Promise.all(
      allowedRoots.map(async (root) => {
        if (!existsSync(root)) return false;
        const part = relative(await realpath(root), file);
        return part !== '' && !part.startsWith('..') && !isAbsolute(part);
      }),
    );
    if (!allowed.some(Boolean))
      throw new Error('O ilustrador devolveu um caminho de imagem inválido.');
    return await readFile(file);
  } finally {
    await unlink(reference).catch(() => {});
    await unlink(resultPath).catch(() => {});
  }
}
