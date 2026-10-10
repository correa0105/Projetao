// Eight source-reviewed fixed-spell tiers reuse complete original physical models.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir = 'data/shop-magic-completion-20261009';
const candidates = JSON.parse(await fs.readFile(dir + '/candidates.json')).items;
const editorial = JSON.parse(await fs.readFile(dir + '/editorial.json')),
  before = structuredClone(editorial);
const recipes = JSON.parse(await fs.readFile(dir + '/variant-recipes.json'));
const source = JSON.parse(
  await fs.readFile('.local/shop-completion/magicvariants.json'),
).magicvariant;
const cantrips = candidates.filter((x) => x.family === 'Enspelled Weapon (Cantrip)');
const ids = [];
for (let level = 1; level <= 8; level++) {
  const family = `Enspelled Weapon (Level ${level})`,
    rows = candidates.filter((x) => x.family === family),
    rule = source.find((x) => x.name === family)?.inherits;
  assert.equal(rows.length, 52);
  assert(
    rule &&
      rule.spellScrollLevel === level &&
      rule.reqAttune === true &&
      rule.charges === 6 &&
      rule.source === 'XDMG',
  );
  assert.equal(rule.recharge, 'dawn');
  assert.equal(rule.rechargeAmount, '{@dice 1d6}');
  const dc = Number(rule.entries[1].match(/DC is (\d+)/)?.[1]),
    attack = Number(rule.entries[1].match(/\{@hit (\d+)\}/)?.[1]);
  assert.deepEqual(
    [dc, attack],
    [
      [13, 5],
      [13, 5],
      [15, 7],
      [15, 7],
      [17, 9],
      [17, 9],
      [18, 10],
      [18, 10],
    ][level - 1],
  );
  assert(rule.entries[0].includes(`school=C;D;V;N;T|level=${level}`));
  await fs.access(`public/shop/magic-completion-20261009/material-enspell-level-${level}.webp`);
  for (let i = 0; i < rows.length; i++) {
    const x = rows[i];
    ids.push(x.id);
    if (editorial[x.id]) continue;
    const original = cantrips.find(
      (c) => c.base.name === x.base.name && c.base.source === x.base.source,
    );
    assert(original, x.id);
    assert.deepEqual(x.base, original.base);
    const e = editorial[original.id],
      recipe = recipes.find((r) => r.id === original.id),
      label = e.model_name;
    assert(e?.review === 'approved' && recipe);
    assert.equal(x.facts.rarity, rule.rarity);
    assert.equal(x.facts.spellScrollLevel, level);
    const prefix = e.rules_summary.split(' Exige sintonia.')[0];
    assert(prefix.length > 30);
    const magic = ` Exige sintonia. Uma magia de nível ${level} fica vinculada quando a arma é criada, escolhida dentre Conjuração, Adivinhação, Evocação, Necromancia ou Transmutação. A magia é fixa deste exemplar e não pode ser trocada após a compra. Enquanto segura a arma, pode gastar uma das seis cargas para conjurar essa magia; ela usa CD ${dc} para resistências e bônus de ataque +${attack}. Recupera 1d6 cargas gastas a cada amanhecer, sem superar seis. O encantamento não concede bônus numérico aos ataques ou ao dano da arma nem munição ilimitada. Dungeon Master’s Guide (2024), p. 258. Conjuração, cargas e demais efeitos são resolvidos pelo mestre na mesa.`;
    const physical =
      prefix +
      magic +
      (x.facts.weight == null
        ? ' Peso estimado para a loja: 0,1 lb; a fonte não fornece peso para a funda.'
        : '');
    const voice = [
      `${label} de nível ${level}: escolha a magia antes da compra. Uma vez vinculada, ela permanece com esta peça.`,
      `${label} de nível ${level}: a reserva é de seis cargas. O amanhecer devolve um dado de seis, sem garantir todas.`,
      `${label} de nível ${level}: sintonia primeiro, conjuração depois. Segurando a arma, uma carga basta para a magia escolhida.`,
      `${label} de nível ${level}: a magia usa CD ${dc} e ataque +${attack}. São os números da conjuração; o golpe físico conserva os próprios valores.`,
      `${label} de nível ${level}: as cinco escolas permitidas estão na seleção. Escolha uma magia deste nível e mantenha sua fonte à mão.`,
      `${label} de nível ${level}: este acabamento abriga uma magia fixa. As propriedades normais da arma continuam valendo em cada ataque.`,
    ][i % 6];
    editorial[x.id] = {
      ...e,
      name: `Arma com magia vinculada de nível ${level} (${label})`,
      description: `Forma: ${label}. Magia fixa de nível ${level}, seis cargas, CD ${dc} e ataque mágico +${attack}; exige sintonia.`,
      merchant_comment: voice,
      rules_summary: physical,
      family,
      spell_binding: { level, schools: ['C', 'D', 'V', 'N', 'T'] },
    };
    assert(!recipes.some((r) => r.id === x.id));
    recipes.push({
      ...recipe,
      id: x.id,
      family,
      texture: `/shop/magic-completion-20261009/material-enspell-level-${level}.webp`,
      material: `material-enspell-level-${level}`,
      enhancement: 0,
      decoration_tier: level,
      spell_level: level,
      color: [
        '#d8b882',
        '#99cba7',
        '#ccb0e8',
        '#dce4da',
        '#dfa49b',
        '#b6d0ec',
        '#ddd9f0',
        '#e7d0a0',
      ][level - 1],
      opacity: recipe.opacity === 0.26 ? 0.32 : 0.54,
    });
  }
}
for (const [id, e] of Object.entries(before)) assert.deepEqual(editorial[id], e);
assert.equal(ids.length, 416);
assert.equal(
  new Set(Object.values(editorial).map((e) => e.merchant_comment)).size,
  Object.keys(editorial).length,
);
await fs.writeFile(dir + '/editorial.json', JSON.stringify(editorial, null, 2) + '\n');
await fs.writeFile(dir + '/variant-recipes.json', JSON.stringify(recipes, null, 2) + '\n');
await fs.writeFile('.local/enspell-level-ids.json', JSON.stringify(ids, null, 2) + '\n');
console.log(
  'Prepared 416 complete distinct fixed-spell weapons in eight levels; prior 1083 offers untouched.',
);
