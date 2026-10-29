import { readFile, writeFile, unlink, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

export type RetiredImage = { path: string; sha256: string; bytes: number; optimizedFile?: string };
export type ImageRetirement = {
  images: RetiredImage[];
  derivatives: RetiredImage[];
};
type OptimizedEntry = { file: string; sourceBytes: number; bytes: number };
type OptimizedManifest = {
  images: Record<string, OptimizedEntry>;
  skipped?: Record<string, string>;
  summary?: Record<string, unknown>;
  [key: string]: unknown;
};

export function retirementTarget(root: string, path: string) {
  assert(path.startsWith('/') && !path.includes('\\') && !path.split('/').includes('..'), path);
  const base = resolve(root),
    target = resolve(base, '.' + path);
  assert(target.startsWith(base + sep), path);
  return target;
}

export async function pruneRetiredPublicImages(
  root: string,
  retirement: ImageRetirement,
  check = false,
) {
  const manifestFile = resolve(root, 'optimized-images-20261028/manifest.json');
  let manifest: OptimizedManifest | null = null;
  try {
    manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const retired = new Set(retirement.images.map((e) => e.path));
  for (const entry of retirement.images)
    if (entry.optimizedFile && manifest?.images[entry.path])
      assert.equal(
        manifest.images[entry.path].file,
        entry.optimizedFile,
        entry.path + ': cópia otimizada alterada',
      );
  const retained = new Set(
    Object.entries(manifest?.images || {})
      .filter(([p]) => !retired.has(p))
      .map(([, e]) => e.file),
  );
  const targets = [
    ...retirement.images,
    ...retirement.derivatives.filter((e) => !retained.has(e.path)),
  ];
  const existing: { file: string; bytes: number }[] = [];
  // Validate every target before modifying any file. New artwork at a retired
  // URL requires an explicit review of the retirement list.
  for (const entry of targets) {
    const file = retirementTarget(root, entry.path);
    try {
      await stat(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    const bytes = await readFile(file);
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      entry.sha256,
      entry.path + ': conteúdo alterado',
    );
    existing.push({ file, bytes: bytes.length });
  }
  const mapped = Object.keys(manifest?.images || {}).filter((p) => retired.has(p));
  if (check) {
    assert.equal(existing.length, 0, 'Ainda existem imagens retiradas na publicação');
    assert.equal(mapped.length, 0, 'O manifesto ainda aponta para imagens retiradas');
    return { removedFiles: 0, removedBytes: 0, retainedDerivatives: retained.size };
  }
  for (const entry of existing) await unlink(entry.file);
  if (manifest) {
    for (const p of retired) {
      delete manifest.images[p];
      if (manifest.skipped) delete manifest.skipped[p];
    }
    const images = Object.values(manifest.images),
      sourceBytes = images.reduce((s, e) => s + e.sourceBytes, 0),
      deliveredBytes = images.reduce((s, e) => s + e.bytes, 0);
    manifest.summary = {
      ...manifest.summary,
      optimized: images.length,
      sourceBytes,
      deliveredBytes,
      verified: images.length,
      reductionPercent: sourceBytes ? +(100 * (1 - deliveredBytes / sourceBytes)).toFixed(1) : 0,
      retiredImages: retirement.images.length,
    };
    await writeFile(manifestFile, JSON.stringify(manifest));
  }
  return {
    removedFiles: existing.length,
    removedBytes: existing.reduce((s, e) => s + e.bytes, 0),
    retainedDerivatives: retained.size,
  };
}
