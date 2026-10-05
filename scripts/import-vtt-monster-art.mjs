import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Image repository linked by https://5e.tools, pinned for reproducibility.
const release = 'v2.36.1';
const base = `https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/${release}/bestiary/tokens/XMM/`;
const { monsters } = JSON.parse(await readFile('data/vtt/srd-2024.json', 'utf8'));
await mkdir('public/vtt/monsters', { recursive: true });
const images = [],
  failures = [];
let cursor = 0;
async function worker() {
  while (cursor < monsters.length) {
    const monster = monsters[cursor++];
    const url = base + encodeURIComponent(monster.name) + '.webp';
    try {
      const file = `public/vtt/monsters/${monster.id}.webp`;
      let bytes;
      try {
        bytes = await readFile(file);
      } catch {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(20000),
          redirect: 'error',
        });
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        const input = Buffer.from(await response.arrayBuffer());
        if (input.length > 4 * 1024 * 1024) throw Error('Imagem acima de 4 MB.');
        bytes = await sharp(input, { limitInputPixels: 20000000 })
          .rotate()
          .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 92, alphaQuality: 100 })
          .toBuffer();
        await writeFile(file, bytes);
      }
      const { width, height } = await sharp(bytes).metadata();
      images.push({
        id: monster.id,
        name: monster.name,
        path: `/vtt/monsters/${monster.id}.webp`,
        source: 'XMM',
        url,
        width,
        height,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
      if (images.length % 50 === 0)
        console.log(`${images.length}/${monsters.length} artes importadas`);
    } catch (error) {
      failures.push({ name: monster.name, error: error.message });
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
if (failures.length) {
  console.error(failures);
  process.exitCode = 1;
} else {
  images.sort((a, b) => a.id.localeCompare(b.id));
  await writeFile(
    'data/vtt/monster-token-art.json',
    JSON.stringify({ release, images }, null, 2) + '\n',
  );
  console.log(`${images.length} artes prontas; manifesto e hashes gravados.`);
}
