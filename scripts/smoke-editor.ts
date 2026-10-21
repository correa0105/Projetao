import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// The old builder was retired. Keep test:editor as a check of the current
// administrator map: no builder, pin management and preserved mission stories.
// This runner always creates/disposes its own local PostgreSQL database.
process.exitCode = await new Promise<number>((resolve, reject) => {
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(new URL('./test-portal-controls-isolated.mjs', import.meta.url)),
      '--pins-browser',
    ],
    { stdio: 'inherit', windowsHide: true },
  );
  child.on('error', reject);
  child.on('exit', (code) => resolve(code ?? 1));
});
