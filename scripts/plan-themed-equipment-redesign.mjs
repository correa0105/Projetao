import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const catalogs = ['data/shop-export/loja.json', 'data/equipment-catalog.json', 'data/emporium-expansion.json', 'data/animal-equipment-catalog.json', 'data/shop-magic-completion-20261009/catalog.json'];
const items = new Map();
for (const file of catalogs) {
  const data = JSON.parse(await fs.readFile(file, 'utf8'));
  for (const item of Array.isArray(data) ? data : data.items) items.set(item.id, item);
}
const registry = JSON.parse(await fs.readFile('data/thematic-equipment-art-20261102.json', 'utf8'));
const approved = new Map(registry.assets.filter(asset => asset.review === 'approved').map(asset => [asset.id, asset]));
const recipes = new Set(JSON.parse(await fs.readFile('data/shop-magic-completion-20261009/variant-recipes.json','utf8')).map(recipe => recipe.id));
const jobs = new Map(), checked = new Map();
const ammunitionModels = new Set(['energy-cell', 'modern-bullet', 'arrows-20', 'bolts-20', 'firearm-bullet', 'blowgun-needles-50', 'sling-bullets-20', 'single-arrow', 'single-bolt', 'single-needle', 'single-sling-bullet']);
const isAmmunition = item => Boolean(item?.raw_data?.ammunition_type)
  || ammunitionModels.has(item?.raw_data?.base_item || item?.id)
  || /^A(?:\||$)/.test(item?.raw_data?.upstream_facts?.type || '');
function add(id, legacyPath, slot, item) {
  if (!legacyPath) return;
  const key = legacyPath;
  const job = jobs.get(key) || { id: createHash('sha256').update(key).digest('hex').slice(0,16), legacy_path: legacyPath,
    family: item?.raw_data?.magic_family || 'Família a revisar', model: item?.raw_data?.base_item || item?.id,
    slot, consumers: [], status: 'pending' };
  if (!job.consumers.some(consumer => consumer.id === id)) job.consumers.push({ id, name: item?.name || id });
  jobs.set(key, job);
}
for (const item of items.values()) {
  const image = item.image_path;
  let legacy = Boolean(item.raw_data?.magic_skin) || recipes.has(item.id);
  if (!legacy && image?.endsWith('.svg')) {
    if (!checked.has(image)) {
      let source = ''; try { source = await fs.readFile('public' + image, 'utf8'); } catch(error) { if(error.code !== 'ENOENT') throw error; }
      checked.set(image, source.includes('<mask') && (source.match(/<image\b/g)||[]).length >= 2);
    }
    legacy = checked.get(image);
  }
  if (legacy) add(item.id, image, item.raw_data?.equipment_slots?.[0] || 'item', item);
}
const pieces = JSON.parse(await fs.readFile('data/armor-piece-art-20261012.json','utf8')).variants;
for (const piece of pieces) add(`${piece.id}--${piece.slot}`, piece.output.replace(/^public/,''), piece.slot, items.get(piece.id));
for (const asset of approved.values()) {
  if (![...jobs.values()].some(job => job.consumers.some(consumer => consumer.id === asset.id)))
    add(asset.id, asset.legacy_path, asset.id.includes('--') ? asset.id.split('--').at(-1) : 'armor', items.get(asset.id));
}
const excluded = [...jobs.values()].filter(job => job.consumers.every(consumer => isAmmunition(items.get(consumer.id))))
  .map(job => ({ ...job, status: 'excluded', reason: 'Munições excluídas pelo proprietário em 2026-11-04' }));
const excludedIds = new Set(excluded.map(job => job.id));
const list = [...jobs.values()].filter(job => !excludedIds.has(job.id)).sort((a,b) => a.family.localeCompare(b.family) || String(a.model).localeCompare(String(b.model)) || a.slot.localeCompare(b.slot));
for (const job of list) {
  job.completed_consumers = job.consumers.filter(consumer => approved.has(consumer.id)).map(consumer => consumer.id);
  if (job.completed_consumers.length === job.consumers.length) job.status = 'approved';
}
const stats = { physical_artworks: list.length, approved_artworks: list.filter(job => job.status === 'approved').length,
  pending_artworks: list.filter(job => job.status !== 'approved').length,
  catalog_references: list.reduce((n,job) => n + job.consumers.length,0),
  approved_references: list.reduce((n,job) => n + job.completed_consumers.length,0), excluded_ammunition_artworks: excluded.length };
// Include every selector model, including older native artwork that was not a
// coating. A family cannot be called complete just because one variant is done.
const pieceImages = JSON.parse(await fs.readFile('shared/armor-piece-images.json','utf8'));
const families = new Map();
for (const item of items.values()) {
  const family=item.raw_data?.magic_family;
  if(!family || isAmmunition(item))continue;
  const ids=[item.id,...['head','shoulders','bracers','legs','feet'].filter(slot=>pieceImages[item.id+':'+slot]).map(slot=>item.id+'--'+slot)];
  const models=families.get(family)||[];
  models.push({id:item.id,name:item.name,model:item.raw_data?.base_item||item.id,
    artwork_ids:ids,approved_artwork_ids:ids.filter(id=>approved.has(id)),
    status:ids.every(id=>approved.has(id))?'approved':'pending'});
  families.set(family,models);
}
const familyCoverage=[...families].sort(([a],[b])=>a.localeCompare(b)).map(([family,models])=>({family,
  status:models.every(model=>model.status==='approved')?'approved':'pending',
  models:models.sort((a,b)=>a.id.localeCompare(b.id))}));
await fs.writeFile('data/thematic-equipment-redesign-plan-20261102.json', JSON.stringify({ policy_version:2,
  scope:'Todos os itens e todos os modelos de cada conjunto/família, incluindo armas, armaduras, capas e peças separadas, exceto munições para armas; substituir revestimentos por desenhos temáticos nativos.', stats, family_coverage:familyCoverage, jobs:list, excluded_jobs:excluded },null,2)+'\n');
console.log(JSON.stringify(stats));
