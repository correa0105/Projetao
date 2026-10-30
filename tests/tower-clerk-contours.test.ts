import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { towerClerkOutlines } from '../src/tower-clerk-outlines';

test('os quatro contornos acompanham as máscaras extraídas das artes nativas', async () => {
  const record = JSON.parse(await readFile('data/tower-clerk-contours-20261030.json', 'utf8'));
  assert.equal(record.images.length, 4);
  for (const item of record.images) {
    const filename = item.source.split('/').at(-1).replace('.png', '');
    const outline = towerClerkOutlines['/tower/headquarters-' + filename + '-20261030.webp'];
    assert(outline, item.room);
    assert.equal(outline.width, item.width);
    const source = await readFile(item.source);
    assert.equal(createHash('sha256').update(source).digest('hex'), item.sourceSha256);
    const maskBytes = await readFile(item.mask);
    assert.equal(createHash('sha256').update(maskBytes).digest('hex'), item.maskSha256);
    const original = await sharp(maskBytes).greyscale().raw().toBuffer();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${item.width}" height="${item.height}"><rect width="100%" height="100%" fill="black"/><path d="${outline.path}" fill="white" fill-rule="evenodd"/></svg>`;
    const rendered = await sharp(Buffer.from(svg)).greyscale().raw().toBuffer();
    let intersect = 0,
      union = 0;
    for (let i = 0; i < original.length; i++) {
      const a = original[i] > 127,
        b = rendered[i] > 127;
      if (a && b) intersect++;
      if (a || b) union++;
    }
    assert(
      intersect / union > 0.985,
      `${item.room}: fidelidade de área ${(intersect / union).toFixed(5)}`,
    );
    // Uma máscara de aproximadamente 100–200 mil pixels não pode virar um retângulo ou halo genérico.
    assert(union > 80000 && union < 250000, item.room);
  }
});
