import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'data/vtt/biomes-20261015');
const plan = JSON.parse(await fs.readFile(path.join(directory, 'plan.json'), 'utf8'));
const groups = { forest: 'Floresta', swamp: 'Pântano', snow: 'Neve' };
const nature = [], trees = [], houses = [], paints = [], ready = [];
for (const spec of plan.items) {
  let asset;
  try { asset = JSON.parse(await fs.readFile(path.join(directory, 'completed', spec.id + '.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  if (asset.status !== 'reviewed') continue;
  const main = asset.outputs?.main;
  if (!main || (spec.type === 'building' && !asset.outputs.interior)) throw new Error('Arte incompleta: ' + spec.id);
  for (const output of Object.values(asset.outputs)) {
    const bytes = await fs.readFile(path.join(root, 'public', output.image));
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== output.sha256) throw new Error('Hash divergente: ' + output.image);
    if (![output.width, output.height].every(x => Number.isFinite(x) && x > 0)) throw new Error('Escala inválida: ' + spec.id);
    await fs.access(path.join(root, 'public', output.thumbnail));
  }
  const base = { id: spec.id, name: spec.name, category: groups[spec.biome], width: main.width, height: main.height, image: main.image, thumbnail: main.thumbnail };
  if (spec.type === 'ground' || spec.type === 'tree') {
    nature.push({ ...base, notes: `${groups[spec.biome]} · ${spec.type === 'tree' ? 'Árvore' : 'Chão da floresta e vegetação rasteira'} · ${spec.sizeMetres.toLocaleString('pt-BR')} m. Escala: 1 quadrado = 1,5 m.` });
    if (spec.type === 'tree') trees.push({ id: spec.id, name: spec.name, group: groups[spec.biome], squares: Math.max(main.width, main.height), image: main.image });
  } else if (spec.type === 'building') {
    houses.push({ ...base, interior: asset.outputs.interior.image, footprint: spec.footprint, roofBounds: spec.roofBounds, windows: [], notes: `${groups[spec.biome]} · Construção com interior e entrada livre. Escala: 1 quadrado = 1,5 m.` });
  } else if (spec.type === 'paint') paints.push({ id: spec.biome === 'swamp' ? 'swamp-floor' : 'snow-biome', name: spec.name, image: main.image, thumbnail: main.thumbnail });
  ready.push({ id: spec.id, biome: spec.biome, type: spec.type, images: Object.keys(asset.outputs).length });
}
const write = (file, data) => fs.writeFile(path.join(root, file), JSON.stringify(data, null, 2) + '\n');
await write('shared/vtt-biome-nature-20261015.json', nature);
await write('shared/vtt-biome-trees-20261015.json', trees);
await write('shared/vtt-biome-houses-20261015.json', houses);
await write('data/vtt/biomes-20261015/ready.json', { requested: plan.items.length, reviewed: ready.length, images: ready.reduce((n, item) => n + item.images, 0), ready, paints });
console.log(JSON.stringify({ requested: plan.items.length, reviewed: ready.length, nature: nature.length, trees: trees.length, houses: houses.length, paints: paints.length }));
