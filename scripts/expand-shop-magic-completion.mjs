import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { resolveCopies, acceptsBase, isMagic, nameKey, magicFacts } from './shop-magic-source.mjs';
const plan = JSON.parse(
  await fs.readFile('data/shop-magic-completion-20261009/coverage-plan.json'),
);
const raw = JSON.parse(await fs.readFile('.local/shop-completion/magicvariants.json')).magicvariant;
const bases = resolveCopies(
  JSON.parse(await fs.readFile('.local/shop-completion/items-base.json')).baseitem,
);
const variants = resolveCopies(raw);
const catalog = [
  ...JSON.parse(await fs.readFile('data/shop-export/loja.json')).items,
  ...JSON.parse(await fs.readFile('data/emporium-expansion.json')).items,
];
const byId = new Map(catalog.map((x) => [x.id, x]));
const modelKey = (name) =>
  nameKey(name)
    .replace(/\barmor\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const modelParents = new Map();
function modelRoot(name) {
  const k = modelKey(name);
  if (!modelParents.has(k)) modelParents.set(k, k);
  const p = modelParents.get(k);
  if (p !== k) {
    const r = modelRoot(p);
    modelParents.set(k, r);
    return r;
  }
  return k;
}
for (const b of bases) {
  modelRoot(b.name);
  for (const target of b.reprintedAs || []) {
    const uid = typeof target === 'string' ? target : target.uid;
    modelParents.set(modelRoot(b.name), modelRoot(uid.split('|')[0]));
  }
}
const ammunitionModels = {
  'arrows-20': 'Arrow',
  'bolts-20': 'Bolt',
  'firearm-bullets-10': 'Firearm Bullet',
  'sling-bullets-20': 'Sling Bullet',
  'blowgun-needles-50': 'Needle',
};
const bookInfo = new Map(
  [
    ...JSON.parse(await fs.readFile('.local/shop-completion/books.json')).book,
    ...JSON.parse(await fs.readFile('.local/shop-completion/adventures.json')).adventure,
  ].map((x) => [x.id, { name: x.name, published: x.published }]),
);
export function magicItemId(name) {
  const bonus = name.match(/^\+([0-9]+)\s+/)?.[1];
  const text = bonus ? name.replace(/^\+[0-9]+\s+/, '') + ` plus ${bonus}` : name;
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
const additions = plan.missing.map((x) => ({ ...x, id: magicItemId(x.facts.name), kind: 'named' }));
const directNames = new Set([
  ...plan.covered.map((x) => nameKey(x.name)),
  ...additions.map((x) => nameKey(x.facts.name)),
]);
const seen = new Map(),
  unmatched = [];
for (const family of plan.variantFamilies) {
  const choices = variants.filter((x) =>
    family.aliases.some((alias) => nameKey(x.name) === nameKey(alias)),
  );
  // A reissued family takes the newest compatible definition for each model.
  const matches = [];
  for (const template of choices) {
    if (!isMagic(template.inherits) || template.inherits.source.startsWith('UA')) continue;
    if (bookInfo.get(template.inherits.source)?.published > '2026-10-09') continue;
    for (const base of bases) {
      if (!acceptsBase(base, template)) continue;
      if (base.edition && template.edition && base.edition !== template.edition) continue;
      const inherits = template.inherits;
      const name =
        (inherits.namePrefix || '') +
        base.name.replace(inherits.nameRemove || '\u0000', '') +
        (inherits.nameSuffix || '');
      const identity = family.identity + '::' + modelRoot(base.name);
      const bonus = Number(
        inherits.bonusWeapon || inherits.bonusAc || inherits.bonusWeaponAttack || 0,
      );
      const alreadySold = family.catalog_ids.some((id) => {
        const item = byId.get(id);
        if (!item?.raw_data?.base_item && !item?.raw_data?.ammunition_type) return false;
        if (item.raw_data.ammunition_type)
          return (
            modelRoot(ammunitionModels[item.raw_data.ammunition_type] || '') ===
              modelRoot(base.name) &&
            (!bonus || item.raw_data.enhancement === bonus)
          );
        const model = byId.get(item.raw_data.base_item);
        const oldName = model?.original_name || item.raw_data.base_item.replace(/-/g, ' ');
        return (
          modelRoot(oldName) === modelRoot(base.name) &&
          (!bonus || item.raw_data.enhancement == null || item.raw_data.enhancement === bonus)
        );
      });
      if (alreadySold) continue;
      const facts = {
        ...magicFacts(base),
        ...magicFacts(inherits),
        name,
        baseItem: `${base.name.toLowerCase()}|${base.source.toLowerCase()}`,
      };
      delete facts.value;
      if (inherits.propertyAdd)
        facts.property = [...new Set([...(facts.property || []), ...inherits.propertyAdd])];
      if (inherits.propertyRemove)
        facts.property = facts.property?.filter((x) => !inherits.propertyRemove.includes(x));
      const rank =
        (base.edition === 'one' ? '2' : base.edition === 'classic' ? '0' : '1') +
        (bookInfo.get(inherits.source)?.published || '1900-01-01');
      matches.push({
        identity,
        id: magicItemId(name),
        kind: 'variant',
        family: family.name,
        facts,
        base: magicFacts(base),
        book: bookInfo.get(inherits.source) || { name: inherits.source },
        source_url: `https://5e.tools/items.html#${encodeURIComponent(name.toLowerCase())}_${inherits.source.toLowerCase()}`,
        rank,
      });
    }
  }
  if (!matches.length && !family.catalog_ids.length) unmatched.push(family.name);
  for (const match of matches) {
    if (directNames.has(nameKey(match.facts.name))) continue;
    const old = seen.get(match.identity);
    if (!old || old.rank < match.rank) seen.set(match.identity, match);
  }
}
const concrete = new Map(),
  collisions = [];
for (const x of seen.values()) {
  const old = concrete.get(x.id);
  if (old) {
    assert.equal(
      nameKey(x.facts.name),
      nameKey(old.facts.name),
      'Distinct names collapse to one ID',
    );
    assert.equal(
      modelKey(x.base.name),
      modelKey(old.base.name),
      'Distinct models collapse to one ID',
    );
    collisions.push({
      id: x.id,
      families: [old.family, x.family],
      sources: [old.facts.source, x.facts.source],
    });
    // Attack-only net templates describe the same net, rather than a second
    // saleable object. Retain the definition that explicitly omits damage.
    if (/no damage/.test(old.family) && !/no damage/.test(x.family)) continue;
    if (!/no damage/.test(x.family) && old.rank >= x.rank) continue;
  }
  concrete.set(x.id, x);
}
for (const x of concrete.values()) {
  delete x.rank;
  additions.push(x);
}
const ids = new Map();
for (const x of additions) {
  if (ids.has(x.id)) throw Error(`Duplicate ID ${x.id}: ${ids.get(x.id)} / ${x.facts.name}`);
  ids.set(x.id, x.facts.name);
}
assert(!unmatched.length, 'Families without a valid base: ' + unmatched.join(', '));
const output = {
  status:
    'planned candidates; require original art and reviewed Portuguese content before activation',
  asOf: plan.asOf,
  named: plan.missing.length,
  variants: concrete.size,
  total: additions.length,
  items: additions,
};
await fs.writeFile(
  'data/shop-magic-completion-20261009/candidates.json',
  JSON.stringify(output, null, 2) + '\n',
);
console.log({ ...output, items: undefined });
await fs.writeFile(
  '.local/shop-completion/variant-collisions.json',
  JSON.stringify(collisions, null, 2),
);
