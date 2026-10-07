import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { assignMagicSkins } from './magic-skin-profiles.mjs';
import { writeThematicSkinIds } from './generate-thematic-skin-ids.mjs';

const file = 'data/emporium-expansion.json';
const catalog = JSON.parse(await fs.readFile(file, 'utf8'));
const old = JSON.parse(await fs.readFile('data/shop-export/loja.json', 'utf8')).items;
assignMagicSkins(catalog.items, old);
await fs.mkdir('public/shop/magic-skins', { recursive: true });
const encoded = new Map();
async function asset(url, maximum) {
  if (!/^\/shop\/[a-zA-Z0-9/_-]+\.(png|webp)$/.test(url)) throw Error(`Unsafe skin asset: ${url}`);
  const key = url + maximum;
  if (!encoded.has(key)) {
    const bytes = await sharp('public' + url)
      .resize({ width: maximum, height: maximum, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true, quality: 95 })
      .toBuffer();
    const metadata = await sharp(bytes).metadata();
    encoded.set(key, {
      href: 'data:image/png;base64,' + bytes.toString('base64'),
      width: metadata.width,
      height: metadata.height,
    });
  }
  return encoded.get(key);
}
const manifest = [];
for (const item of catalog.items) {
  const skin = item.raw_data?.magic_skin;
  if (!skin) continue;
  const base = await asset(skin.reference, 512),
    texture = await asset(skin.texture, 256);
  const width = base.width + 32,
    height = base.height + 32;
  const seed = ([...item.raw_data.magic_family].reduce((n, c) => n + c.charCodeAt(0), 0) % 47) + 1;
  // All resources are embedded. Browsers prohibit external images inside SVG img elements.
  const modelDefinition = `<image id="model" href="${base.href}" x="16" y="16" width="${base.width}" height="${base.height}"/>`;
  const model = '<use href="#model"/>';
  const etched = Array.from({ length: 11 }, (_, i) => {
    const y = 16 + ((i + 1) * base.height) / 12;
    return `<path d="M16 ${y}h${base.width * 0.25}l12 -7 12 14 12 -7h${base.width * 0.65}"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><mask id="shape" mask-type="alpha">${model}</mask><filter id="aura" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="${skin.glow}" result="blur"/><feFlood flood-color="${skin.color}" flood-opacity=".65"/><feComposite in2="blur" operator="in"/></filter><filter id="material"><feTurbulence type="fractalNoise" baseFrequency=".025" numOctaves="2" seed="${seed}" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="${skin.material === 'flame' ? 10 : 0}" xChannelSelector="R" yChannelSelector="G"/></filter></defs><g filter="url(#aura)">${model}</g>${model}<g mask="url(#shape)"><image href="${texture.href}" x="16" y="16" width="${base.width}" height="${base.height}" preserveAspectRatio="xMidYMid slice" opacity="${skin.opacity}" filter="url(#material)"/><g fill="none" stroke="${skin.color}" stroke-width=".8" opacity=".5">${etched}</g></g></svg>\n`;
  const renderedSvg = svg.replace('<defs>', '<defs>' + modelDefinition);
  await fs.writeFile('public' + item.image_path, renderedSvg);
  manifest.push({
    id: item.id,
    family: item.raw_data.magic_family,
    model: item.raw_data.base_item,
    path: item.image_path,
    ...skin,
    sha256: crypto.createHash('sha256').update(renderedSvg).digest('hex'),
  });
}
await fs.writeFile(file, JSON.stringify(catalog, null, 2) + '\n');
await fs.writeFile(
  'public/shop/magic-skins/skin-manifest.json',
  JSON.stringify(
    { mode: 'native SVG skins with built-in image_gen material textures', assets: manifest },
    null,
    2,
  ) + '\n',
);
console.log(
  `Built ${manifest.length} magical variant skins; energy shortbow uses its dedicated generated artwork.`,
);
await writeThematicSkinIds({ catalog: catalog.items, old, skins: manifest });
