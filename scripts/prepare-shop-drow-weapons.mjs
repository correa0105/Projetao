import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir = 'data/shop-magic-completion-20261009',
  candidates = JSON.parse(await fs.readFile(dir + '/candidates.json')).items,
  editorial = JSON.parse(await fs.readFile(dir + '/editorial.json')),
  before = structuredClone(editorial),
  recipes = JSON.parse(await fs.readFile(dir + '/variant-recipes.json'));
const source = JSON.parse(
    await fs.readFile('.local/shop-completion/magicvariants.json'),
  ).magicvariant,
  ids = [];
for (let bonus = 1; bonus <= 3; bonus++) {
  const sourceFamily = `Drow +${bonus} Weapon`,
    rows = candidates.filter((c) => c.family === sourceFamily),
    template = source.find((x) => x.name === sourceFamily)?.inherits;
  assert.equal(rows.length, 51);
  assert.equal(template.source, 'MM');
  assert.equal(template.bonusWeapon, '+' + bonus);
  assert.equal(template.rarity, 'unknown (magic)');
  assert(!template.reqAttune);
  assert(template.entries[0].includes('sunlight for 1 hour or longer'));
  await fs.access(`public/shop/magic-completion-20261009/material-drow-bonus-${bonus}.webp`);
  for (let i = 0; i < rows.length; i++) {
    const x = rows[i];
    ids.push(x.id);
    if (editorial[x.id]) continue;
    const original = candidates.find(
      (c) =>
        c.family === 'Enspelled Weapon (Cantrip)' &&
        c.base.name === x.base.name &&
        c.base.source === x.base.source,
    );
    assert(original, x.id);
    assert.deepEqual(x.base, original.base);
    const e = editorial[original.id],
      recipe = recipes.find((r) => r.id === original.id);
    assert(e && recipe);
    const { spell_binding, ...physical } = e,
      label = e.model_name;
    const projectPrice = [40000, 400000, 4000000][bonus - 1] + (x.base.value ?? 0);
    assert(Number.isSafeInteger(projectPrice) && projectPrice > 0);
    const rule =
      e.rules_summary.split(' Exige sintonia.')[0] +
      ` Encanto drow: +${bonus} nas jogadas de ataque e dano feitas com esta arma. Se exposta à luz do sol durante uma hora ou mais, perde permanentemente esse bônus de encantamento. Não exige sintonia. A fonte não informa uma raridade. O preço do Empório é uma estimativa por equivalência com uma arma +${bonus}, acrescida do modelo físico, e pode ser ajustado pelo administrador; não é um preço oficial do livro. Monster Manual (2014), p. 126. As propriedades físicas seguem o modelo escolhido; perda por luz solar é resolvida pelo mestre na mesa.` +
      (x.facts.weight == null
        ? ' Peso estimado para a loja: 0,1 lb; a fonte não informa peso da funda.'
        : '');
    const voice = [
      `${label} drow +${bonus}: a força do encanto vem das profundezas. Uma hora de sol pode apagar o bônus para sempre.`,
      `${label} drow +${bonus}: o bônus melhora ataque e dano; o sol tem seu preço. Proteja a peça no caminho da superfície.`,
      `${label} drow +${bonus}: não precisa de sintonia. Precisa de cuidado com a luz do sol para conservar o encantamento.`,
      `${label} drow +${bonus}: o encanto não muda a munição nem o alcance do modelo. Uma hora ao sol remove seu bônus permanentemente.`,
      `${label} drow +${bonus}: a raridade não veio definida na fonte. Este valor é a avaliação do Empório, com o risco do sol explicado nos detalhes.`,
      `${label} drow +${bonus}: confira o modelo inteiro apoiado no baú. O acabamento é próprio da peça, e o bônus vale para ataque e dano.`,
    ][i % 6];
    editorial[x.id] = {
      ...physical,
      name: `Arma drow (${label} +${bonus})`,
      description: `Forma: ${label}. +${bonus} em ataque e dano. Uma hora de luz solar remove permanentemente o bônus. Sem sintonia; raridade não informada pela fonte. Valor estimado pelo Empório.`,
      merchant_comment: voice,
      rules_summary: rule,
      family: 'Drow Weapon',
      source_edition: `Encanto: D&D 5e (2014); modelo: ${x.base.edition === 'one' ? '2024' : '2014'}`,
      project_price_cp: projectPrice,
      price_basis: `Estimativa do Empório por equivalência com arma +${bonus}; raridade não informada no Monster Manual.`,
    };
    assert(!recipes.some((r) => r.id === x.id));
    recipes.push({
      ...recipe,
      id: x.id,
      family: 'Drow Weapon',
      texture: `/shop/magic-completion-20261009/material-drow-bonus-${bonus}.webp`,
      material: `material-drow-bonus-${bonus}`,
      enhancement: bonus,
      color: '#c4b5db',
      opacity: recipe.opacity === 0.26 ? 0.3 : 0.58,
    });
  }
}
for (const [id, e] of Object.entries(before)) assert.deepEqual(editorial[id], e);
assert.equal(ids.length, 153);
assert.equal(
  new Set(Object.values(editorial).map((e) => e.merchant_comment)).size,
  Object.keys(editorial).length,
);
await fs.writeFile(dir + '/editorial.json', JSON.stringify(editorial, null, 2) + '\n');
await fs.writeFile(dir + '/variant-recipes.json', JSON.stringify(recipes, null, 2) + '\n');
await fs.writeFile('.local/drow-weapon-ids.json', JSON.stringify(ids, null, 2) + '\n');
console.log(
  'Prepared 153 source-reviewed Drow weapons; sunlight limitation, absent attunement and unknown rarity explicit, store valuation marked as estimate.',
);
