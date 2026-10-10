import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const dir = 'data/shop-magic-completion-20261009';
const candidates = JSON.parse(await fs.readFile(dir + '/candidates.json')).items;
const editorial = JSON.parse(await fs.readFile(dir + '/editorial.json'));
const art = JSON.parse(await fs.readFile(dir + '/art-manifest.json')).assets;
const existing = [
  ...JSON.parse(await fs.readFile('data/shop-export/loja.json')).items,
  ...JSON.parse(await fs.readFile('data/equipment-catalog.json')),
  ...JSON.parse(await fs.readFile('data/emporium-expansion.json')).items,
];
const existingIds = new Set(existing.map((x) => x.id));
const prices = {
  common: 100,
  uncommon: 400,
  rare: 4000,
  'very rare': 40000,
  legendary: 200000,
  artifact: null,
};
const categories = {
  common: 'Mágicos comuns',
  uncommon: 'Mágicos incomuns',
  rare: 'Mágicos raros',
  'very rare': 'Mágicos muito raros',
  legendary: 'Mágicos lendários',
  artifact: 'Artefatos',
};
const titles = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  'very rare': 'Very Rare',
  legendary: 'Legendary',
  artifact: 'Artifact',
};
const slots = new Set([
  'head',
  'armor',
  'shoulders',
  'bracers',
  'legs',
  'feet',
  'main_hand',
  'off_hand',
  'ring_left',
  'ring_right',
  'neck',
  'cloak',
  'hands',
  'back',
  'belt',
]);
const items = [],
  pending = [],
  hashes = new Set();
for (const c of candidates) {
  const e = editorial[c.id],
    a = art.find((x) => x.id === c.id);
  if (e?.review !== 'approved' || a?.review !== 'approved') {
    pending.push(c.id);
    continue;
  }
  assert(!existingIds.has(c.id), 'Existing product must not be overwritten: ' + c.id);
  assert(e.name && e.description && e.merchant_comment, c.id + ' content incomplete');
  assert(e.slots && e.slots.every((x) => slots.has(x)), c.id + ' invalid equipment');
  assert(/^\/shop\/magic-completion-20261009\/[a-z0-9-]+\.(webp|svg)$/.test(a.path), 'Unsafe art');
  const bytes = await fs.readFile('public' + a.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), a.sha256, c.id + ' changed art');
  assert(!hashes.has(a.sha256), 'Repeated art: ' + c.id);
  hashes.add(a.sha256);
  const f = c.facts,
    type = (f.type || '').split('|')[0];
  const consumable = e.consumable === true || ['P', 'SC'].includes(type);
  const baseName = f.baseItem?.split('|')[0];
  const basic =
    baseName && ['M', 'R', 'LA', 'MA', 'HA', 'S'].includes(type)
      ? existing.find(
          (x) =>
            x.original_name?.toLowerCase() === baseName.toLowerCase() && !x.raw_data?.magic_family,
        )
      : undefined;
  const gp = prices[f.rarity];
  const price_cp =
    gp == null
      ? null
      : Math.round(
          gp * 100 * (consumable && type !== 'SC' ? 0.5 : 1) +
            (c.base?.value ?? basic?.price_cp ?? 0),
        );
  const weight = f.weight ?? e.estimated_weight_lb ?? null;
  assert(Number.isFinite(weight) && weight >= 0, c.id + ' needs reviewed weight estimate');
  const source = `D&D · ${c.book.name}`;
  const raw_data = {
    shop_magic_completion: true,
    upstream_name: f.name,
    upstream_source: f.source,
    upstream_page: f.page ?? null,
    upstream_facts: f,
    source_book: c.book.name,
    source_edition:
      f.edition === 'one' || ['XDMG', 'XPHB'].includes(f.source) ? 'D&D 5e (2024)' : 'D&D 5e',
    rules_summary: e.rules_summary || e.description,
    equipment_target: e.target || 'human',
    equipment_slots: e.slots,
    two_handed: e.two_handed === true,
    consumable,
    rarity: titles[f.rarity] || f.rarity,
    sound_material: e.material,
    attunement: f.reqAttune || false,
  };
  if (f.baseItem && ['M', 'R', 'LA', 'MA', 'HA', 'S'].includes(type)) {
    raw_data.base_item = basic?.id || baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    raw_data.magic_kind = ['M', 'R'].includes(type) ? 'weapon' : 'armor';
    if (f.bonusWeapon) raw_data.enhancement = Number(f.bonusWeapon);
  }
  if (c.kind === 'variant')
    Object.assign(raw_data, {
      magic_family: c.family,
      base_item: e.base_id || c.base.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      variant: e.model_name,
      magic_kind: c.base.weapon
        ? 'weapon'
        : c.base.armor || ['LA', 'MA', 'HA', 'S'].includes((c.base.type || '').split('|')[0])
          ? 'armor'
          : undefined,
    });
  items.push({
    id: c.id,
    name: e.name,
    original_name: f.name,
    category: type === 'P' ? 'Poções' : categories[f.rarity] || 'Itens mágicos especiais',
    description: e.description,
    merchant_comment: e.merchant_comment,
    price_cp,
    weight_lb: weight,
    weight_estimated: f.weight == null,
    source,
    source_url: c.source_url,
    image_path: a.path,
    audio_path: `/audio/emporium/${c.id}.wav`,
    raw_data,
  });
}
assert.equal(new Set(items.map((x) => x.id)).size, items.length, 'Duplicate prepared IDs');
let audioReady = true;
for (const x of items) {
  try {
    await fs.access('public' + x.audio_path);
  } catch {
    audioReady = false;
  }
}
if (process.argv.includes('--verify')) assert(audioReady, 'Missing original item sound');
const catalog = {
  status: audioReady
    ? 'ready reviewed subset; full completion in progress'
    : 'preparing original audio; not ready to deploy',
  ready: audioReady,
  source: 'https://5e.tools/items.html',
  asOf: '2026-10-09',
  planned: candidates.length,
  pending: pending.length,
  items,
};
await fs.writeFile(dir + '/catalog.json', JSON.stringify(catalog, null, 2) + '\n');
console.log({ ...catalog, items: items.map((x) => x.id) });
