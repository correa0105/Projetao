// Names, levels and mechanical tables only. Book prose and artwork stay out of this snapshot.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { subclassDescriptions } from '../shared/subclass-descriptions-2024.ts';
import { permittedSource } from '../shared/content-sources.ts';
const revision = '90d343cde64cf8dce1083ea0525a6b0b9e545f2e';
const baseUrl = `https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/${revision}/data/`;
const cache = '.local/subclass-sources';
const editorial = 'data/character-rules-20261015';
const mapping = JSON.parse(await fs.readFile(editorial + '/mapping.json', 'utf8'));
const oldSpells = JSON.parse(await fs.readFile('shared/srd-2024-spells.json', 'utf8')).spells;
const sources = [];
await fs.mkdir(cache, { recursive: true });
async function read(relative, local) {
  let bytes;
  if (process.argv.includes('--offline')) {
    bytes = await fs.readFile(cache + '/' + local);
  } else {
    const response = await fetch(baseUrl + relative);
    assert(response.ok, relative + ': ' + response.status);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  await fs.writeFile(cache + '/' + local, bytes);
  sources.push({
    url: baseUrl + relative,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  return JSON.parse(bytes.toString('utf8'));
}
const lookup = await read(
  'generated/gendata-spell-source-lookup.json',
  'spell-source-lookup.json',
);
const books = (await read('books.json', 'books.json')).book;
const classIndex = await read('class/index.json', 'class-index.json');
const spellIndex = await read('spells/index.json', 'spell-index.json');
const raw = {};
for (const cls of Object.keys(mapping.classes))
  raw[cls] = await read('class/' + classIndex[cls], cls + '.json');
const spellRows = [];
for (const src of ['XPHB', 'FRHoF', 'EFA'].filter(permittedSource))
  spellRows.push(...(await read('spells/' + spellIndex[src], 'spells-' + src + '.json')).spell);
const slug = (name) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const aliases = new Map(oldSpells.map((s) => [s.name.toLowerCase(), s.id]));
for (const s of spellRows) {
  const canon = typeof s.srd52 === 'string' ? s.srd52 : s.name;
  const id =
    aliases.get(canon.toLowerCase()) || aliases.get(s.name.toLowerCase()) || slug(canon);
  aliases.set(s.name.toLowerCase(), id);
  aliases.set(canon.toLowerCase(), id);
}
const schoolNames = {
  A: 'Abjuration',
  C: 'Conjuration',
  D: 'Divination',
  E: 'Enchantment',
  V: 'Evocation',
  I: 'Illusion',
  N: 'Necromancy',
  T: 'Transmutation',
};
const spells = new Map(oldSpells.map((s) => [s.id, s]));
for (const s of spellRows) {
  assert(!s._copy, 'Resolve explicit spell copies before publishing');
  const id = aliases.get(s.name.toLowerCase()),
    old = spells.get(id);
  const lists = Object.entries(
    lookup[s.source.toLowerCase()]?.[s.name.toLowerCase()]?.class || {},
  )
    .filter(([src]) => ['XPHB', 'EFA'].includes(src))
    .flatMap(([, classes]) => Object.keys(classes).map((c) => c.toLowerCase()));
  assert(lists.length, s.name + ' missing class list');
  spells.set(id, {
    id,
    name: typeof s.srd52 === 'string' ? s.srd52 : s.name,
    level: s.level,
    classes: [...new Set([...(old?.classes || []), ...lists])],
    ritual: Boolean(s.meta?.ritual),
    concentration: s.duration?.some((d) => d.concentration) || false,
    label: old?.label || mapping.spellLabels[s.name] || s.name,
    school: schoolNames[s.school],
    source: s.source,
    page: s.page,
  });
}
function fixed(value) {
  if (typeof value === 'string') {
    const name = value.split(/[|#]/)[0].toLowerCase(),
      id = aliases.get(name);
    assert(id && spells.has(id), 'Unresolved spell ' + value);
    return [id];
  }
  if (Array.isArray(value)) return value.flatMap(fixed);
  if (!value || value.choose || value.filter) return [];
  return Object.values(value).flatMap(fixed);
}
const subclasses = [];
for (const m of mapping.subclasses.filter((m) => permittedSource(m.source))) {
  const classSource = m.class === 'artificer' ? 'EFA' : 'XPHB';
  const s = raw[m.class].subclass.find(
    (s) => s.name === m.name && s.source === m.source && s.classSource === classSource,
  );
  assert(s && !s._copy, 'Missing current subclass ' + m.name);
  const source = books.find((b) => b.id === s.source);
  assert(source?.published <= '2026-10-15', 'Unpublished source');
  const features = raw[m.class].subclassFeature.filter(
    (f) =>
      f.classSource === classSource &&
      f.subclassSource === s.source &&
      f.subclassShortName === s.shortName,
  );
  const levels = [...new Set(features.map((f) => f.level))].sort((a, b) => a - b);
  const key = mapping.classes[m.class] + '/' + m.id;
  // Existing twelve SRD summaries remain in class-advancement-text.ts with their stable IDs.
  if (subclassDescriptions[key])
    assert.deepEqual(
      Object.keys(subclassDescriptions[key])
        .map(Number)
        .sort((a, b) => a - b),
      levels,
      key + ' missing feature level',
    );
  const prepared = {},
    innate = [],
    variants = {};
  for (const grant of s.additionalSpells || []) {
    const target =
      s.additionalSpells.length > 1 && grant.name && grant.prepared
        ? (variants[grant.name] = {})
        : prepared;
    for (const type of ['prepared', 'known'])
      for (const [lv, values] of Object.entries(grant[type] || {})) {
        if (!/^\d+$/.test(lv)) continue;
        const level = Math.max(3, Number(lv));
        target[level] = [...new Set([...(target[level] || []), ...fixed(values)])];
      }
    for (const [lv, values] of Object.entries(grant.innate || {})) {
      if (!/^\d+$/.test(lv)) continue;
      const ids = fixed(values);
      if (ids.length)
        innate.push({
          level: Math.max(3, Number(lv)),
          spells: [...new Set(ids)],
          ability: grant.ability || s.spellcastingAbility || null,
        });
    }
  }
  const casting =
    s.casterProgression === '1/3'
      ? {
          list: m.class === 'monk' ? 'sorcerer' : 'wizard',
          ability: s.spellcastingAbility === 'wis' ? 4 : 3,
          cantrips: s.cantripProgression,
          prepared: s.preparedSpellsProgression,
          slots: s.subclassTableGroups.find((t) => t.rowsSpellProgression)
            ?.rowsSpellProgression,
        }
      : undefined;
  if (casting)
    assert(
      casting.slots?.length === 20 &&
        casting.prepared?.length === 20 &&
        casting.cantrips?.length === 20,
    );
  const savant = features.find((f) => f.name.endsWith(' Savant'));
  const school = savant
    ? Object.entries(schoolNames).find(([, name]) => savant.name.startsWith(name))?.[1]
    : undefined;
  const extraAttack = features
    .filter((f) => f.name === 'Extra Attack')
    .map((f) => f.level)
    .sort((a, b) => a - b)[0];
  subclasses.push({
    class: mapping.classes[m.class],
    id: m.id,
    name: m.label,
    originalName: s.name,
    source: s.source,
    book: source.name,
    page: s.page,
    edition: '2024',
    url:
      'https://5e.tools/classes.html#' +
      encodeURIComponent(s.className.toLowerCase()) +
      '_' +
      classSource.toLowerCase() +
      ',state:' +
      encodeURIComponent(
        'sub' + s.shortName.toLowerCase().replace(/[^a-z0-9]/g, '') + s.source.toLowerCase(),
      ) +
      '=b1',
    levels,
    sourceFeatures: features
      .filter((f) => f.name !== s.name)
      .map((f) => ({ name: f.name, level: f.level, page: f.page || s.page })),
    spells: prepared,
    innate,
    variants,
    casting,
    school,
    extraAttack,
    resources: s.subclassTableGroups
      ?.filter((t) => t.rows && !t.rowsSpellProgression)
      .map((t) => ({
        labels: t.colLabels.map((l) => l.replace(/\{@\w+ ([^}|]+)[^}]*\}/g, '$1')),
        rows: t.rows,
      })),
  });
}
assert.equal(subclasses.length, mapping.subclasses.filter((m) => permittedSource(m.source)).length);
assert.equal(new Set(subclasses.map((s) => s.class + '/' + s.id)).size, subclasses.length);
const art = raw.artificer.class.find((c) => c.source === 'EFA');
const artFeatures = raw.artificer.classFeature.filter(
  (f) => f.classSource === 'EFA' && f.source === 'EFA',
);
const artRows = Array.from({ length: 20 }, (_, i) => ({
  level: i + 1,
  proficiency: 2 + Math.floor(i / 4),
  features:
    art.classFeatures
      .filter(
        (ref) =>
          Number((typeof ref === 'string' ? ref : ref.classFeature).split('|')[3]) === i + 1,
      )
      .map((ref) => (typeof ref === 'string' ? ref : ref.classFeature).split('|')[0])
      .join(', ') || '—',
  numbers: [
    ...art.classTableGroups[0].rows[i].map((n) => (typeof n === 'number' ? n : 0)),
    ...art.classTableGroups[1].rowsSpellProgression[i],
  ],
}));
const artPlans = artFeatures.find((f) => f.name === 'Replicate Magic Item');
const rawItems = (await read('items.json', 'items.json')).item;
const itemIndex = JSON.parse(
  await fs.readFile('data/emporium-source/srd-magic-index.json', 'utf8'),
);
const itemLabels = (await fs.readFile('data/emporium-source/magic.tsv', 'utf8'))
  .split(/\r?\n/)
  .filter(Boolean)
  .map((l) => l.split('|'));
const localLabels = new Map(
  itemIndex.map((i) => [i.name, itemLabels.find((l) => Number(l[0]) === i.number)?.[1]]),
);
const publishedLabels = JSON.parse(
  await fs.readFile('data/shop-magic-completion-20261009/editorial.json', 'utf8'),
);
const planLabel = (name) =>
  mapping.planLabels[name] ||
  localLabels.get(name) ||
  publishedLabels[slug(name)]?.name ||
  name;
const plans = new Map();
function planTables(value) {
  if (!value || typeof value !== 'object') return;
  if (value.type === 'table' && value.caption?.startsWith('Magic Item Plans')) {
    const level = Number(value.caption.match(/Level (\d+)/)[1]);
    for (const [cell, attunement] of value.rows) {
      const tag = cell.match(/\{@item ([^}|]+)(?:\|([^}|]+))?/);
      if (!tag) continue;
      const name = tag[1],
        source = tag[2] || 'XDMG';
      plans.set(name, {
        name,
        label: planLabel(name),
        level,
        source,
        armor: name.includes('Armor') || name === 'Elven Chain',
        attunement: attunement === 'Yes',
      });
    }
  }
  for (const child of Object.values(value))
    if (typeof child === 'object')
      Array.isArray(child) ? child.forEach(planTables) : planTables(child);
}
planTables(artPlans);
for (const item of rawItems) {
  if (
    !['XDMG', 'EFA', 'FRHoF', 'RHW'].includes(item.source) ||
    item._copy ||
    item.curse ||
    item.cursed
  )
    continue;
  const common = item.rarity === 'common' && !['P', 'SC'].includes(item.type?.split('|')[0]);
  const uncommon = item.rarity === 'uncommon' && item.wondrous;
  const rare = item.rarity === 'rare' && item.wondrous;
  if (!common && !uncommon && !rare) continue;
  const level = common ? 2 : uncommon ? 10 : 14;
  if (plans.has(item.name) && plans.get(item.name).level <= level) continue;
  plans.set(item.name, {
    name: item.name,
    label: planLabel(item.name),
    level,
    source: item.source,
    page: item.page,
    armor: false,
    attunement: Boolean(item.reqAttune),
  });
}
// These two grants are alternative cantrips, selected by the feature field.
const archer = subclasses.find((s) => s.class === 'Guerreiro' && s.id === 'arcane-archer');
if (archer) archer.spells = {};
const result = {
  asOf: '2026-10-15',
  revision,
  books: books
    .filter((b) => ['XPHB', 'FRHoF', 'EFA', 'RHW'].includes(b.id))
    .map((b) => ({ id: b.id, name: b.name, published: b.published })),
  subclasses,
  spells: [...spells.values()].sort((a, b) => a.id.localeCompare(b.id)),
  artificer: {
    source: 'EFA',
    page: art.page,
    plans: [...plans.values()].sort(
      (a, b) => a.level - b.level || a.label.localeCompare(b.label, 'pt-BR'),
    ),
    rows: artRows,
    skills: art.startingProficiencies.skills[0].choose.from,
    sourceFeatures: artFeatures.map((f) => ({ name: f.name, level: f.level, page: f.page })),
  },
};
await fs.writeFile('shared/character-rules-2024.json', JSON.stringify(result, null, 2) + '\n');
await fs.writeFile(
  editorial + '/sources.json',
  JSON.stringify(
    {
      asOf: result.asOf,
      revision,
      content: 'Mechanical facts and original Portuguese summaries; upstream prose excluded',
      sources,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({ classes: 13, subclasses: subclasses.length, spells: spells.size, revision }),
);
