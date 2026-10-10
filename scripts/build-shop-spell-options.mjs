// Publish spell names and mechanical facts only; upstream prose stays private.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { resolveCopies } from './shop-magic-source.mjs';
const base = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/spells/',
  cache = '.local/shop-completion/spells';
const asOf = '2026-10-09';
await fs.mkdir(cache, { recursive: true });
async function read(name) {
  const file = cache + '/' + name;
  try {
    return JSON.parse(await fs.readFile(file));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    const response = await fetch(base + name);
    assert(response.ok, name + ' HTTP ' + response.status);
    const text = await response.text();
    await fs.writeFile(file, text);
    return JSON.parse(text);
  }
}
const index = await read('index.json'),
  books = [
    ...JSON.parse(await fs.readFile('.local/shop-completion/books.json')).book,
    ...JSON.parse(await fs.readFile('.local/shop-completion/adventures.json')).adventure,
  ];
const sourceInfo = new Map(books.map((x) => [x.id, { name: x.name, published: x.published }]));
const names = [
  ...new Set(
    Object.entries(index)
      .filter(
        ([id]) =>
          !id.startsWith('UA') &&
          (!sourceInfo.get(id)?.published || sourceInfo.get(id).published <= asOf),
      )
      .map(([, file]) => file),
  ),
];
const rows = [],
  sources = [];
for (let i = 0; i < names.length; i += 4) {
  const found = await Promise.all(
    names.slice(i, i + 4).map(async (name) => ({ name, data: await read(name) })),
  );
  for (const { name, data } of found) {
    rows.push(...(data.spell ?? []));
    sources.push({
      url: base + name,
      sha256: createHash('sha256')
        .update(await fs.readFile(cache + '/' + name))
        .digest('hex'),
    });
  }
}
const resolved = resolveCopies(rows),
  allowedSchools = new Set(['C', 'D', 'V', 'N', 'T']),
  byName = new Map();
for (const row of resolved) {
  if (
    row.source.startsWith('UA') ||
    row.level < 0 ||
    row.level > 8 ||
    (sourceInfo.get(row.source)?.published ?? '1900-01-01') > asOf
  )
    continue;
  const key = row.name.toLowerCase(),
    priority =
      (row.source === 'XPHB' ? '2' : '1') + (sourceInfo.get(row.source)?.published ?? '1900-01-01');
  if (!byName.has(key) || priority > byName.get(key).priority) byName.set(key, { row, priority });
}
const translated = new Map(
  JSON.parse(await fs.readFile('shared/srd-2024-spells.json')).spells.map((x) => [
    x.name.toLowerCase(),
    x.label,
  ]),
);
for (const [name, label] of Object.entries({
  'Booming Blade': 'Lâmina trovejante',
  'Control Flames': 'Controlar chamas',
  'Create Bonfire': 'Criar fogueira',
  Frostbite: 'Mordida de gelo',
  'Green-Flame Blade': 'Lâmina de chama verde',
  Gust: 'Rajada',
  Infestation: 'Infestação',
  'Lightning Lure': 'Atração elétrica',
  'Magic Stone': 'Pedra mágica',
  'Mold Earth': 'Moldar terra',
  'Primal Savagery': 'Selvageria primal',
  'Sapping Sting': 'Picada enfraquecedora',
  'Shape Water': 'Moldar água',
  'Sword Burst': 'Explosão de espadas',
}))
  translated.set(name.toLowerCase(), label);
const items = [...byName.values()]
  .filter(({ row }) => allowedSchools.has(row.school))
  .map(({ row }) => ({
    id:
      row.name
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 75) +
      '-' +
      row.source.toLowerCase(),
    name: row.name,
    label: translated.get(row.name.toLowerCase()) ?? row.name,
    level: row.level,
    school: row.school,
    source: row.source,
    book: sourceInfo.get(row.source)?.name ?? row.source,
    page: row.page ?? null,
    edition: row.edition === 'one' || row.source === 'XPHB' ? '2024' : 'legacy-compatible',
    source_url:
      'https://5e.tools/spells.html#' +
      encodeURIComponent(row.name.toLowerCase()) +
      '_' +
      row.source.toLowerCase(),
  }))
  .sort((a, b) => a.level - b.level || a.label.localeCompare(b.label, 'pt-BR'));
assert.equal(new Set(items.map((x) => x.id)).size, items.length);
assert(items.filter((x) => x.level === 0).length >= 20);
await fs.writeFile(
  'shared/shop-spell-options.json',
  JSON.stringify({ asOf, source: 'https://5e.tools/spells.html', items }, null, 2) + '\n',
);
await fs.writeFile(
  'data/shop-magic-completion-20261009/spell-options-provenance.json',
  JSON.stringify(
    { asOf, source: '5etools fact-only spell index; no upstream descriptions published', sources },
    null,
    2,
  ) + '\n',
);
console.log(
  'Prepared ' +
    items.length +
    ' fact-only choices in permitted weapon schools, including ' +
    items.filter((x) => x.level === 0).length +
    ' cantrips.',
);
console.log(items.filter((x) => x.level === 0).map((x) => [x.name, x.school, x.source]));
