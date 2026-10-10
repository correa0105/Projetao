import { readFile, writeFile } from 'node:fs/promises';
const basic = JSON.parse(await readFile('data/shop-export/loja.json', 'utf8')).items;
const expansion = JSON.parse(await readFile('data/emporium-expansion.json', 'utf8')).items;
const completion = JSON.parse(
  await readFile('data/shop-magic-completion-20261009/catalog.json', 'utf8'),
);
if (!completion.ready) throw Error('Catálogo mágico revisado ainda não está pronto.');
let animals = [];
try {
  animals = JSON.parse(await readFile('data/animal-equipment-catalog.json', 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (!Array.isArray(animals)) animals = animals.items;
const bases = new Set([
  'padded-armor',
  'leather-armor',
  'studded-leather',
  'hide-armor',
  'chain-shirt',
  'scale-mail',
  'breastplate',
  'half-plate-armor',
  'ring-mail',
  'chain-mail',
  'splint-armor',
  'plate-armor',
  'spiked-armor',
]);
const bundles = [...basic, ...expansion, ...animals, ...completion.items].flatMap((item) => {
  const raw = item.raw_data || {};
  const target = raw.equipment_target || (raw.barding === true ? 'mount' : 'human');
  if (
    !bases.has(item.id) &&
    !(raw.barding === true && bases.has(raw.armor_base)) &&
    !(typeof raw.base_item === 'string' && bases.has(raw.base_item)) &&
    !(raw.animal_armor === true && (target === 'mount' || target === 'pet'))
  )
    return [];
  return [[item.id, Number(item.weight_lb), target]];
});
if (new Set(bundles.map(([id]) => id)).size !== bundles.length)
  throw Error('Conjuntos duplicados.');
await writeFile('shared/armor-bundle-catalog.json', JSON.stringify(bundles, null, 2) + '\n');
console.log(`${bundles.length} conjuntos registrados.`);
