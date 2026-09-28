import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, realpath, unlink, readdir } from 'node:fs/promises';
import { delimiter, isAbsolute, join, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import { races, classes } from '../shared/rules.js';
import { validateChoices } from '../shared/character-sheet.js';
import { characterStature } from '../shared/character-stature.js';

export class IllustratorError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

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
  return new Promise<{ stdout: string; threadId?: string }>((resolveRun, reject) => {
    const child = spawn(command, [...prefix, ...args], {
      shell: false,
      windowsHide: true,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let eventBuffer = '';
    let threadId: string | undefined;
    let failureCode = 'cli_exit';
    const timer = setTimeout(() => {
      child.kill();
      reject(
        new IllustratorError('timeout', 'O ilustrador demorou além do limite. Tente novamente.'),
      );
    }, timeout);
    child.stdout.on('data', (chunk) => {
      stdout = (stdout + chunk.toString()).slice(-100_000);
      if (args.includes('--json')) {
        eventBuffer += chunk.toString();
        const lines = eventBuffer.split('\n');
        eventBuffer = lines.pop() || '';
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            if (
              event.type === 'thread.started' &&
              z.string().uuid().safeParse(event.thread_id).success
            )
              threadId = event.thread_id;
          } catch {
            /* Ignore non-JSON lines; never retain or log the transcript. */
          }
        }
      }
    });
    // Never log the agent transcript or reference images.
    child.stderr.on('data', (chunk) => {
      if (args[0] === 'login') stdout = (stdout + chunk.toString()).slice(-100_000);
      // Inspect only in memory; never persist the transcript or raw provider errors.
      const diagnostic = chunk.toString();
      if (/usage limit|rate limit|quota exceeded|429/i.test(diagnostic))
        failureCode = 'usage_limit';
      else if (/401|authentication failed|token.*expired|not logged in/i.test(diagnostic))
        failureCode = 'authentication';
      else if (
        failureCode === 'cli_exit' &&
        /stream disconnected|connection reset|timed out|502|503|504/i.test(diagnostic)
      )
        failureCode = 'connection';
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new IllustratorError('cli_start', 'Não foi possível iniciar o ilustrador local.'));
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      code === 0
        ? resolveRun({ stdout, threadId })
        : reject(
            new IllustratorError(
              failureCode,
              failureCode === 'usage_limit'
                ? 'O ilustrador atingiu o limite de uso da assinatura. Tente novamente mais tarde.'
                : failureCode === 'authentication'
                  ? 'A sessão do ilustrador precisa ser reconectada.'
                  : failureCode === 'connection'
                    ? 'A conexão do ilustrador foi interrompida. Tente novamente.'
                    : 'O ilustrador não concluiu a execução. Tente novamente.',
            ),
          );
    });
    child.stdin.on('error', () => {});
    child.stdin.end(prompt || '');
  });
}
export async function checkCodexLogin() {
  const { stdout: status } = await runCodex(['login', 'status'], undefined, 30_000);
  if (!/ChatGPT/i.test(status) || /API key/i.test(status))
    throw new Error('Use codex login com sua conta ChatGPT.');
}

export async function generateCharacterArt(job: {
  id: string;
  reference: Buffer;
  race: string;
  class: string;
  choices?: unknown;
}) {
  z.string().uuid().parse(job.id);
  const race = z.enum(races).parse(job.race);
  const characterClass = z.enum(classes).parse(job.class);
  const choices = job.choices ? validateChoices(race, characterClass, job.choices) : undefined;
  const origin = choices
    ? `Regras SRD 5.2.1 / 2024, nível 1 sem subclasse. Linhagem validada: ${choices.subrace}. Tamanho: ${choices.options.size?.[0] || 'padrão da espécie'}.${race === 'Draconato' ? ` Ancestralidade dracônica validada: ${choices.options.dragon[0]}.` : ''}`
    : '';
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
    const execution = await runCodex(
      [
        'exec',
        '--json',
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
      `${instructions}\n\nRaça validada: ${race}. Classe validada: ${characterClass}. ${origin} Estatura de referência: ${characterStature[race].heightCm} cm. Anatomia obrigatória: ${characterStature[race].anatomy} Gere agora usando a ferramenta nativa.`,
    );
    // Native artifacts belong to the exact CLI session, independently of the
    // model's final JSON. Never select the newest image across other sessions.
    if (execution.threadId) {
      await writeFile(
        join(directory, 'session.json'),
        JSON.stringify({ threadId: execution.threadId }),
      );
      const sessionRoot = resolve(
        process.env.CODEX_HOME || join(homedir(), '.codex'),
        'generated_images',
        execution.threadId,
      );
      if (existsSync(sessionRoot)) {
        const files = (await readdir(sessionRoot, { withFileTypes: true })).filter(
          (entry) => entry.isFile() && /^exec-.*\.png$/i.test(entry.name),
        );
        if (files.length === 1) {
          const nativeFile = await realpath(join(sessionRoot, files[0].name));
          const part = relative(await realpath(sessionRoot), nativeFile);
          if (part && !part.startsWith('..') && !isAbsolute(part))
            return await readFile(nativeFile);
        }
      }
    }
    let rawResult: string;
    try {
      rawResult = await readFile(resultPath, 'utf8');
    } catch {
      throw new IllustratorError(
        'missing_result',
        'O ilustrador não devolveu o resultado da geração.',
      );
    }
    let result: { image_path: string; error: string };
    try {
      result = z.object({ image_path: z.string(), error: z.string() }).parse(JSON.parse(rawResult));
    } catch {
      throw new IllustratorError('invalid_result', 'O ilustrador devolveu um resultado inválido.');
    }
    if (result.error) {
      if (
        /policy|pol[ií]tica|sexual|porn|safety|conte[uú]do.*(recus|bloque)|not.*allowed/i.test(
          result.error,
        )
      )
        throw new IllustratorError(
          'content_refused',
          'O ilustrador recusou essa referência. Escolha outra imagem adequada ao personagem.',
        );
      if (/limit|quota|cota|rate|usage/i.test(result.error))
        throw new IllustratorError(
          'usage_limit',
          'O ilustrador atingiu o limite de uso da assinatura. Tente novamente mais tarde.',
        );
      if (/login|auth|sess[aã]o/i.test(result.error))
        throw new IllustratorError(
          'authentication',
          'A sessão do ilustrador precisa ser reconectada.',
        );
      throw new IllustratorError(
        'tool_error',
        'A ferramenta de imagem não concluiu a geração. Tente novamente.',
      );
    }
    if (!result.image_path)
      throw new IllustratorError(
        'no_image',
        'A ferramenta não entregou uma imagem. Verifique a disponibilidade de geração no Codex.',
      );
    let file: string;
    try {
      file = await realpath(result.image_path);
    } catch {
      throw new IllustratorError(
        'image_not_found',
        'A arte foi gerada, mas o ilustrador não encontrou o arquivo final.',
      );
    }
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
      throw new IllustratorError(
        'image_path',
        'O ilustrador devolveu um caminho de imagem inválido.',
      );
    return await readFile(file);
  } finally {
    await unlink(reference).catch(() => {});
    await unlink(resultPath).catch(() => {});
  }
}
