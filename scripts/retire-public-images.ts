import { readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import assert from 'node:assert/strict';
import retirement from '../data/public-image-retirements-20261029.json';
import { retirementTarget, pruneRetiredPublicImages } from './public-image-retirement';

const root = resolve('public'),
  archive = resolve(retirement.archiveRoot),
  backup = resolve('.local/retired-public-images-20261029');
assert(archive.startsWith(resolve('artwork-archive') + sep));
assert(!archive.startsWith(root + sep));
if (process.argv.includes('--apply')) {
  // Keep originals outside both the public directory and the Docker context.
  for (const entry of [...retirement.images, ...retirement.derivatives]) {
    const source = retirementTarget(root, entry.path);
    const destination = retirementTarget(
      retirement.images.some((e) => e.path === entry.path) ? archive : backup,
      entry.path,
    );
    let bytes: Buffer;
    try {
      bytes = await readFile(source);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      bytes = await readFile(destination);
    }
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.path);
    await mkdir(dirname(destination), { recursive: true });
    try {
      await stat(destination);
      assert.deepEqual(await readFile(destination), bytes);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await copyFile(source, destination);
    }
  }
  await mkdir(backup, { recursive: true });
  try {
    await copyFile(
      resolve(root, 'optimized-images-20261028/manifest.json'),
      resolve(backup, 'manifest-before.json'),
      constants.COPYFILE_EXCL,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  await writeFile(
    resolve(archive, 'README.md'),
    '# Artes retiradas da publicação\n\nOriginais preservados em 29/10/2026 após auditoria de referências do código, catálogos e banco publicado. Este diretório fica fora de public, dist e do contexto Docker. A relação de caminhos, tamanhos e hashes está em data/public-image-retirements-20261029.json.\n',
  );
  console.log(JSON.stringify(await pruneRetiredPublicImages(root, retirement)));
} else if (process.argv.includes('--check')) {
  console.log(JSON.stringify(await pruneRetiredPublicImages(root, retirement, true)));
} else throw Error('Use --apply para arquivar e retirar, ou --check para conferir a publicação.');
