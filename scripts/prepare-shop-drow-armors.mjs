import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const dir = 'data/shop-magic-completion-20261009';
const candidates = JSON.parse(await fs.readFile(dir + '/candidates.json')).items;
const editorial = JSON.parse(await fs.readFile(dir + '/editorial.json'));
const before = structuredClone(editorial);
const recipes = JSON.parse(await fs.readFile(dir + '/variant-recipes.json'));
const variants = JSON.parse(await fs.readFile('.local/shop-completion/magicvariants.json')).magicvariant;
const ids = [];
for (let bonus = 1; bonus <= 3; bonus++) {
  const family = `Drow +${bonus} Armor`;
  const source = variants.find((x) => x.name === family)?.inherits;
  assert.equal(source.source, 'MM');
  assert.equal(source.bonusAc, '+' + bonus);
  assert.equal(source.rarity, 'unknown (magic)');
  assert(!source.reqAttune);
  assert(source.entries[0].includes('sunlight for 1 hour or longer'));
  const rows = candidates.filter((x) => x.family === family);
  assert.equal(rows.length, 13);
  for (let index = 0; index < rows.length; index++) {
    const c = rows[index];
    ids.push(c.id);
    if (editorial[c.id]) continue;
    const original = candidates.find((x) => x.family === 'Armor of Gleaming' && x.base.name === c.base.name && x.base.source === c.base.source);
    assert(original, c.id);
    assert.deepEqual(c.base, original.base);
    const e = editorial[original.id], recipe = recipes.find((x) => x.id === original.id);
    assert(e && recipe);
    const label = e.model_name, type = c.facts.type.split('|')[0], f = c.facts;
    assert(['LA', 'MA', 'HA'].includes(type) && Number.isFinite(f.ac));
    let physical = `Armadura ${type === 'LA' ? 'leve' : type === 'MA' ? 'média' : 'pesada'}. CA base ${f.ac}${type === 'LA' ? ' + modificador de Destreza' : type === 'MA' ? ' + modificador de Destreza, limitado a +2' : ''}, acrescida do bônus mágico +${bonus} enquanto vestida.`;
    if (f.stealth) physical += ' Impõe desvantagem em Furtividade.';
    if (f.strength) physical += ` Sem Força de pelo menos ${f.strength}, seu deslocamento diminui 10 pés.`;
    const voice = [
      `${label} drow +${bonus}: o encanto melhora a defesa enquanto você veste o conjunto. Uma hora de sol pode apagar esse bônus para sempre.`,
      `${label} drow +${bonus}: não exige sintonia, mas exige cuidado na superfície. A luz solar pode remover permanentemente o encantamento.`,
      `${label} drow +${bonus}: confira o acabamento da peça inteira junto ao baú. A compra entrega as seis proteções do conjunto, com seu peso total.`,
      `${label} drow +${bonus}: o bônus soma à CA do modelo. Não elimina o peso nem a limitação de Furtividade da construção física.`,
      `${label} drow +${bonus}: a fonte não define a raridade. Este valor é uma avaliação do Empório, e o risco do sol está nos detalhes.`,
    ][index % 5];
    editorial[c.id] = {
      ...e,
      name: `Armadura drow (${label} +${bonus})`,
      description: `Forma: ${label}. +${bonus} à CA enquanto vestida. Uma hora de sol remove permanentemente o bônus. Sem sintonia; raridade não informada. Valor estimado pelo Empório.`,
      merchant_comment: voice,
      rules_summary: physical + ` Encanto drow: +${bonus} à CA enquanto você veste esta armadura. Se exposta à luz do sol durante uma hora ou mais, perde permanentemente esse bônus de encantamento. Não exige sintonia. A fonte não informa uma raridade. O preço do Empório é uma estimativa por equivalência com armadura +${bonus}, acrescida do modelo físico, e pode ser ajustado pelo administrador; não é um preço oficial do livro. Monster Manual (2014), p. 126. As propriedades físicas seguem o modelo escolhido; perda por luz solar é resolvida pelo mestre. A compra entrega um conjunto de seis peças, com peso total igual ao do modelo.`,
      family: 'Drow Armor',
      source_edition: `Encanto: D&D 5e (2014); modelo: ${c.base.edition === 'one' ? '2024' : '2014'}`,
      project_price_cp: [400000, 4000000, 20000000][bonus - 1] + (c.base.value ?? 0),
      price_basis: `Estimativa do Empório por equivalência com armadura +${bonus}; raridade não informada no Monster Manual.`,
    };
    assert(!recipes.some((x) => x.id === c.id));
    recipes.push({ ...recipe, id: c.id, family: 'Drow Armor', texture: `/shop/magic-completion-20261009/material-drow-bonus-${bonus}.webp`, material: `material-drow-bonus-${bonus}`, enhancement: bonus, color: '#c4b5db', opacity: ['cloth', 'leather'].includes(e.material) ? 0.44 : 0.62, glow: 0.8 });
  }
}
for (const [id, value] of Object.entries(before)) assert.deepEqual(editorial[id], value);
assert.equal(ids.length, 39);
assert.equal(new Set(Object.values(editorial).map((x) => x.merchant_comment)).size, Object.keys(editorial).length);
await fs.writeFile(dir + '/editorial.json', JSON.stringify(editorial, null, 2) + '\n');
await fs.writeFile(dir + '/variant-recipes.json', JSON.stringify(recipes, null, 2) + '\n');
await fs.writeFile('.local/drow-armor-ids.json', JSON.stringify(ids, null, 2) + '\n');
console.log('Prepared 39 source-reviewed Drow armor sets with honest rarity/valuation, physical CA restrictions and original family material.');
