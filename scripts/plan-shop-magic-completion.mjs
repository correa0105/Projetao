// Reconcile identities before generating art or touching the active catalog.
// Raw upstream prose stays in an ignored cache. Published planning data holds
// names, mechanical facts, source references and coverage only.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import {
  nameKey as key,
  resolveCopies,
  isMagic,
  magicFacts as pick,
} from './shop-magic-source.mjs';
const cache = '.local/shop-completion';
await fs.mkdir(cache, { recursive: true });
const files = ['items', 'items-base', 'magicvariants', 'books', 'adventures'];
if (process.argv.includes('--fetch'))
  for (const name of files) {
    const r = await fetch(
      `https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/${name}.json`,
    );
    if (!r.ok) throw Error(`${name}: HTTP ${r.status}`);
    await fs.writeFile(`${cache}/${name}.json`, JSON.stringify(await r.json()));
  }
const sourceFiles = Object.fromEntries(
  await Promise.all(
    files.map(async (name) => {
      const bytes = await fs.readFile(`${cache}/${name}.json`);
      return [
        name,
        { data: JSON.parse(bytes), sha256: createHash('sha256').update(bytes).digest('hex') },
      ];
    }),
  ),
);
const catalog = [
  ...JSON.parse(await fs.readFile('data/shop-export/loja.json')).items,
  ...JSON.parse(await fs.readFile('data/emporium-expansion.json')).items,
];
const rules = JSON.parse(await fs.readFile('data/shop-item-rules.json'));
const items = sourceFiles.items.data.item;
const generic = resolveCopies(sourceFiles.magicvariants.data.magicvariant);
const sourceInfo = new Map(
  [...sourceFiles.books.data.book, ...sourceFiles.adventures.data.adventure].map((x) => [
    x.id,
    { name: x.name, published: x.published, group: x.group },
  ]),
);
const parent = new Map();
function root(k) {
  if (!parent.has(k)) parent.set(k, k);
  let p = parent.get(k);
  if (p !== k) {
    p = root(p);
    parent.set(k, p);
  }
  return p;
}
function unite(a, b) {
  const ra = root(key(a)),
    rb = root(key(b));
  if (ra !== rb) parent.set(ra, rb);
}
for (const x of [...items, ...generic]) {
  root(key(x.name));
  for (const target of x.reprintedAs || x.inherits?.reprintedAs || []) {
    const uid = typeof target === 'string' ? target : target.uid;
    assert(typeof uid === 'string', 'Unknown reprint');
    unite(x.name, uid.split('|')[0]);
  }
}
const known = new Map();
function remember(name, id) {
  const k = root(key(name));
  if (!known.has(k)) known.set(k, []);
  if (!known.get(k).includes(id)) known.get(k).push(id);
}
for (const x of catalog) {
  for (const name of [x.original_name, x.raw_data?.magic_family].filter(Boolean))
    remember(name, x.id);
  const mapping = rules.items[x.id];
  if (mapping?.reference_key)
    remember(mapping.reference_key.slice(mapping.reference_key.indexOf(':') + 1), x.id);
  const family = x.raw_data?.magic_family;
  // The existing frost/stone SKU already covers both names; their identical
  // strength value does not justify adding a second purchasable product.
  if (
    x.raw_data?.variant === 'frost-stone' &&
    ['Belt of Giant Strength', 'Potion of Giant Strength'].includes(family)
  ) {
    const kind = family.startsWith('Belt') ? 'Belt' : 'Potion';
    remember(`${kind} of Frost Giant Strength`, x.id);
    remember(`${kind} of Stone Giant Strength`, x.id);
  }
  if (family && /\+1.*\+2.*\+3/.test(family)) {
    const base = family.replace(/,?\s*\+1[\s\S]*$/, '').trim();
    const bonus = x.raw_data.enhancement ?? x.raw_data.variant?.match(/\+([123])/)?.[1];
    if (bonus) remember(`+${bonus} ${base}`, x.id);
  }
}
function priority(x) {
  const s = sourceInfo.get(x.source);
  return (x._copy ? '0' : '1') + (s?.published || '1900-01-01') + (x.source === 'XDMG' ? '1' : '0');
}
const eligible = (x) =>
  isMagic(x) &&
  !x.source.startsWith('UA') &&
  (!sourceInfo.get(x.source)?.published || sourceInfo.get(x.source).published <= '2026-10-09');
const candidates = resolveCopies(items).filter(eligible);
const unique = new Map();
for (const x of candidates) {
  const k = root(key(x.name)),
    old = unique.get(k);
  if (!old || priority(x) > priority(old)) unique.set(k, x);
}
const missing = [...unique.entries()]
  .filter(([k]) => !known.has(k))
  .map(([k, x]) => ({
    identity: k,
    facts: pick(x),
    book: sourceInfo.get(x.source) || { name: x.source },
    source_url: `https://5e.tools/items.html#${encodeURIComponent(x.name.toLowerCase())}_${x.source.toLowerCase()}`,
    reprints: items
      .filter((v) => root(key(v.name)) === k)
      .map((v) => ({ name: v.name, source: v.source })),
  }));
const covered = [...unique.entries()]
  .filter(([k]) => known.has(k))
  .map(([k, x]) => ({ name: x.name, source: x.source, catalog_ids: known.get(k) }));
const variantIdentities = new Map();
for (const x of generic) {
  const facts = x.inherits || {};
  if (!eligible(facts)) continue;
  const k = root(key(x.name)),
    old = variantIdentities.get(k);
  if (
    !old ||
    priority({ ...x, source: facts.source }) > priority({ ...old, source: old.inherits.source })
  )
    variantIdentities.set(k, x);
}
const variants = [...variantIdentities]
  .filter(([k]) => !known.has(k))
  .map(([k, x]) => ({
    identity: k,
    name: x.name,
    source: x.inherits.source,
    facts: pick(x.inherits),
    requires: x.requires,
    excludes: x.excludes,
    edition: x.edition,
  }));
const variantFamilies = [...variantIdentities].map(([identity, x]) => ({
  identity,
  name: x.name,
  source: x.inherits.source,
  facts: pick(x.inherits),
  requires: x.requires,
  excludes: x.excludes,
  edition: x.edition,
  aliases: generic.filter((v) => root(key(v.name)) === identity).map((v) => v.name),
  catalog_ids: known.get(identity) || [],
}));
const plan = {
  status: 'planning; not imported',
  asOf: '2026-10-09',
  source: 'https://5e.tools/items.html',
  upstream: 'https://github.com/5etools-mirror-3/5etools-src',
  sourceHashes: Object.fromEntries(files.map((n) => [n, sourceFiles[n].sha256])),
  existingCatalogRows: catalog.length,
  sourceMagicRows: candidates.length,
  distinctSourceIdentities: unique.size,
  alreadyCovered: covered.length,
  missingItems: missing.length,
  unexpandedVariantTemplates: variants.length,
  missing,
  variants,
  variantFamilies,
  covered,
};
await fs.mkdir('data/shop-magic-completion-20261009', { recursive: true });
await fs.writeFile(
  'data/shop-magic-completion-20261009/coverage-plan.json',
  JSON.stringify(plan, null, 2) + '\n',
);
console.log({
  ...plan,
  missing: undefined,
  variants: undefined,
  variantFamilies: undefined,
  covered: undefined,
  sourceHashes: undefined,
});
// Concrete regression examples: language/display choices must not create a
// second War Mage wand, giant belt, colored resistance ring or healing potion.
for (const name of [
  '+1 Wand of the War Mage',
  'Belt of Hill Giant Strength',
  'Belt of Stone Giant Strength',
  'Potion of Stone Giant Strength',
  'Ring of Cold Resistance',
  'Potion of Greater Healing',
])
  assert(!missing.some((x) => key(x.facts.name) === key(name)), name + ' already sold');
