import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

/** Keep hashed modules reachable by tabs opened before an incremental release. */
export async function retainClientAssets(previousAssets, nextAssets) {
  await fs.mkdir(nextAssets, { recursive: true });
  let retained = 0;
  for (const entry of await fs.readdir(previousAssets, { withFileTypes: true })) {
    if (!entry.isFile()) throw Error('Expected flat Vite assets directory: ' + entry.name);
    const from = path.join(previousAssets, entry.name), to = path.join(nextAssets, entry.name);
    let existing;
    try { existing = await fs.readFile(to); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (existing) {
      const digest = data => createHash('sha256').update(data).digest('hex');
      if (digest(existing) !== digest(await fs.readFile(from))) throw Error('Asset filename collision: ' + entry.name);
    } else {
      await fs.copyFile(from, to);
      retained++;
    }
  }
  return retained;
}
