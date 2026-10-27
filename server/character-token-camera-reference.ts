import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';

const profileSchema = z.object({ root: z.string().min(1), file: z.string().min(1) });

// A trusted, local-only reference profile. Never accept this path from a player
// payload or publish/copy the source artwork into the game's asset catalog.
export async function characterTokenCameraReference(
  fallback: string,
  profile = resolve(process.env.CHARACTER_TOKEN_CAMERA_PROFILE || '.local/token-camera-reference.json'),
): Promise<{ path: string; custom: boolean }> {
  let source: string;
  try {
    source = await readFile(profile, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return { path: resolve(fallback), custom: false };
    throw new Error('Não foi possível ler a configuração local da referência de tokens.');
  }
  try {
    const config = profileSchema.parse(JSON.parse(source));
    if (!isAbsolute(config.root)) throw new Error('root');
    const root = await realpath(config.root);
    const path = await realpath(resolve(root, config.file));
    const part = relative(root, path);
    if (!part || part.startsWith('..') || isAbsolute(part) || !/\.(png|webp)$/i.test(path))
      throw new Error('path');
    const meta = await sharp(await readFile(path), { limitInputPixels: 40_000_000 }).metadata();
    if (!['png', 'webp'].includes(meta.format || '') || (meta.pages || 1) !== 1)
      throw new Error('format');
    return { path, custom: true };
  } catch {
    throw new Error('A referência local de tokens está inválida ou indisponível. Preserve o acervo e confira sua configuração.');
  }
}
