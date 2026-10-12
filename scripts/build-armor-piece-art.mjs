// Import original transparent cutouts and extend the existing native material-skin system.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { magicSkinProfile } from './magic-skin-profiles.mjs';

const file = 'data/armor-piece-art-20261012.json';
const manifest = JSON.parse(await fs.readFile(file));
const sourceArgument = process.argv.find(value => value.startsWith('--generated-dir='));
const generatedDirectory = sourceArgument?.slice('--generated-dir='.length);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const slots = ['head', 'bracers', 'legs', 'feet', 'shoulders'];
const originals = new Map();
for (const asset of manifest.assets) {
  assert(/^[a-z0-9-]+$/.test(asset.model) && slots.includes(asset.slot));
  assert.equal(asset.output, `public/shop/armor-parts-20261012/${asset.model}-${asset.slot}.webp`);
  assert(!originals.has(`${asset.model}:${asset.slot}`), 'Duplicate original piece');
  await fs.mkdir(path.dirname(asset.output), { recursive: true });
  if (generatedDirectory) {
    assert(/^exec-[a-f0-9-]+\.png$/.test(asset.source));
    const source = path.resolve(generatedDirectory, asset.source);
    assert.equal(path.dirname(source), path.resolve(generatedDirectory));
    const bytes = await sharp(source).resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true }).webp({ quality: 94, alphaQuality: 100 }).toBuffer();
    await fs.writeFile(asset.output, bytes);
  }
  const bytes = await fs.readFile(asset.output), metadata = await sharp(bytes).metadata();
  assert(metadata.hasAlpha, 'An original piece must preserve transparency');
  const alpha = await sharp(bytes).extractChannel('alpha').stats();
  assert.equal(alpha.channels[0].min, 0);
  assert(alpha.channels[0].max > 200);
  asset.width = metadata.width; asset.height = metadata.height; asset.sha256 = sha(bytes);
  originals.set(`${asset.model}:${asset.slot}`, asset.output.replace(/^public/, ''));
}
assert.equal(originals.size, 80, 'All human models and four pet suits require their own cutouts');
for (const [slot, name] of Object.entries({ head: 'helmet', bracers: 'bracers', legs: 'leggings', feet: 'boots', shoulders: 'pauldrons' }))
  originals.set(`plate-armor:${slot}`, `/shop/equipment/plate-${name}.png`);

const catalog = [];
for (const file of ['data/shop-export/loja.json', 'data/emporium-expansion.json', 'data/animal-equipment-catalog.json', 'data/shop-magic-completion-20261009/catalog.json']) {
  const source = JSON.parse(await fs.readFile(file));
  catalog.push(...(Array.isArray(source) ? source : source.items));
}
const items = new Map(catalog.map(item => [item.id, item]));
const bundles = JSON.parse(await fs.readFile('shared/armor-bundle-catalog.json'));
const recipes = new Map(JSON.parse(await fs.readFile('data/shop-magic-completion-20261009/variant-recipes.json')).map(recipe => [recipe.id, recipe]));
const oldSkins = new Map(JSON.parse(await fs.readFile('public/shop/magic-skins/skin-manifest.json')).assets.map(skin => [skin.id, skin]));
const encoded = new Map();
async function image(url, size) {
  assert(/^\/shop\/[a-z0-9/_-]+\.(png|webp)$/.test(url), 'Only local raster artwork');
  const key = url + ':' + size;
  if (!encoded.has(key)) {
    const bytes = await sharp('public' + url).resize(size, size, { fit: 'contain', background: '#00000000' }).png().toBuffer();
    encoded.set(key, 'data:image/png;base64,' + bytes.toString('base64'));
  }
  return encoded.get(key);
}
const images = {}, variants = [], jobs = [];
for (const [id, , target] of bundles) {
  if (target === 'mount') continue;
  const item = items.get(id); assert(item, id);
  const model = item.raw_data?.base_item || id;
  for (const slot of slots) {
    const reference = originals.get(`${model}:${slot}`); assert(reference, `Missing ${model}:${slot}`);
    if (!item.raw_data?.base_item) { images[`${id}:${slot}`] = reference; continue; }
    let skin = recipes.get(id) || oldSkins.get(id);
    if (!skin) {
      const profile = magicSkinProfile(item);
      skin = profile && item.raw_data.magic_family !== 'Dragon Scale Mail'
        ? { ...profile, texture: `/shop/magic-materials/${profile.material}.webp` }
        : { texture: item.image_path, color: '#c9b995', opacity: 0.32, glow: 1.8 };
    }
    assert(skin?.texture, `Missing reviewed material: ${id}`);
    const output = `/shop/armor-parts-20261012/${id}--${slot}.webp`;
    images[`${id}:${slot}`] = output;
    jobs.push({ id, slot, model, reference, skin, output });
  }
}
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++], skin = job.skin;
    const model = await image(job.reference, 512), texture = await image(skin.texture, 256);
    const color = skin.color; assert(/^#[a-f0-9]{3,8}$/i.test(color));
    const opacity = Number(skin.opacity), glow = Number(skin.glow);
    assert(opacity >= 0 && opacity <= 1 && glow >= 0 && glow <= 30);
    const tier = Number(skin.decoration_tier ?? skin.enhancement ?? items.get(job.id).raw_data?.enhancement ?? 0);
    assert(Number.isInteger(tier) && tier >= 0 && tier <= 8);
    const diamonds = Array.from({ length: tier }, (_, index) => {
      const x = 276 + (index - (tier - 1) / 2) * 18;
      return `<path d="M${x} 252l5 9 -5 9 -5 -9Z"/>`;
    }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="552" height="552"><defs><image id="model" href="${model}" x="20" y="20" width="512" height="512"/><mask id="shape" mask-type="alpha"><use href="#model"/></mask><filter id="aura" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${glow}" result="blur"/><feFlood flood-color="${color}" flood-opacity=".35"/><feComposite in2="blur" operator="in"/></filter></defs><g filter="url(#aura)"><use href="#model"/></g><use href="#model"/><g mask="url(#shape)"><image href="${texture}" x="20" y="20" width="512" height="512" preserveAspectRatio="xMidYMid slice" opacity="${opacity}"/><g fill="none" stroke="${color}" stroke-width="1.4" opacity=".7">${diamonds}</g></g></svg>`;
    const bytes = await sharp(Buffer.from(svg)).webp({ quality: 94, alphaQuality: 100 }).toBuffer();
    await fs.writeFile('public' + job.output, bytes);
    variants.push({ id: job.id, slot: job.slot, model: job.model, reference: job.reference, texture: skin.texture, family: items.get(job.id).raw_data.magic_family, enhancement: tier, output: 'public' + job.output, sha256: sha(bytes) });
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
assert.equal(Object.keys(images).length, bundles.filter(bundle => bundle[2] !== 'mount').length * 5);
manifest.assets.sort((a, b) => (a.model + a.slot).localeCompare(b.model + b.slot));
manifest.variants = variants.sort((a, b) => (a.id + a.slot).localeCompare(b.id + b.slot));
manifest.variant_mode = 'Native material skins, using the original reviewed family textures and individual generated piece cutouts';
await fs.writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
await fs.writeFile('shared/armor-piece-images.json', JSON.stringify(Object.fromEntries(Object.entries(images).sort()), null, 2) + '\n');
console.log(JSON.stringify({ originalCutouts: manifest.assets.length, derivedVariants: variants.length, mappedPieces: Object.keys(images).length, originalPlatePreserved: true }));
