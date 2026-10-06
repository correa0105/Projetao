import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const [id, source, metadataPath] = process.argv.slice(2);
const catalog = JSON.parse(await readFile('data/vtt/srd-2024.json', 'utf8'));
const monster = catalog.monsters.find((m) => m.id === id);
if (!monster || !/^monster-[a-z0-9-]+$/.test(id)) throw Error('Monstro não existe no catálogo.');
const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
if (!metadata.prompt || !metadata.references?.length) throw Error('Registre prompt e referências.');
const { data, info } = await sharp(source)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
let transparent = 0,
  solid = 0;
for (let i = 3; i < data.length; i += 4) {
  if (data[i] === 0) transparent++;
  if (data[i] > 240) solid++;
}
if (transparent < info.width * info.height * 0.05 || solid < info.width * info.height * 0.1)
  throw Error('A imagem precisa de fundo transparente real e silhueta visível.');
await mkdir('data/vtt/premium-art', { recursive: true });
const filename = id + '-v1.webp';
const bytes = await sharp(source).webp({ quality: 94, alphaQuality: 100 }).toBuffer();
await writeFile('data/vtt/premium-art/' + filename, bytes);
let manifest;
try {
  manifest = JSON.parse(await readFile('data/vtt/premium-art/manifest.json', 'utf8'));
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
  manifest = { version: 1, assets: [] };
}
const asset = {
  id,
  name: monster.name,
  filename,
  width: info.width,
  height: info.height,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  transparentPixels: transparent,
  mode: 'imagegen built-in',
  ...metadata,
};
manifest.assets = [...manifest.assets.filter((a) => a.id !== id), asset].sort((a, b) =>
  a.id.localeCompare(b.id),
);
await writeFile(
  'data/vtt/premium-art/manifest.next.json',
  JSON.stringify(manifest, null, 2) + '\n',
);
await rename('data/vtt/premium-art/manifest.next.json', 'data/vtt/premium-art/manifest.json');
console.log(
  JSON.stringify({
    id,
    width: info.width,
    height: info.height,
    transparent,
    bytes: bytes.length,
    count: manifest.assets.length,
  }),
);
