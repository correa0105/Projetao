// Reviewed 2024 weapon template applied to existing complete physical models.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { resolveCopies } from './shop-magic-source.mjs';
const dir = 'data/shop-magic-completion-20261009',
  family = 'Enspelled Weapon (Cantrip)';
const editorial = JSON.parse(await fs.readFile(dir + '/editorial.json')),
  old = structuredClone(editorial),
  recipes = JSON.parse(await fs.readFile(dir + '/variant-recipes.json'));
const candidates = JSON.parse(await fs.readFile(dir + '/candidates.json')).items.filter(
    (x) => x.family === family,
  ),
  bases = resolveCopies(
    JSON.parse(await fs.readFile('.local/shop-completion/items-base.json')).baseitem,
  );
const basics = [
  ...JSON.parse(await fs.readFile('data/shop-export/loja.json')).items,
  ...JSON.parse(await fs.readFile('data/emporium-expansion.json')).items,
].filter((x) => !x.raw_data?.magic_family);
const jobs = (
    await Promise.all(
      ['art-jobs-new-models.json', 'art-jobs-metal-models.json'].map(
        async (file) => JSON.parse(await fs.readFile(dir + '/' + file)).jobs,
      ),
    )
  ).flat(),
  materials = JSON.parse(await fs.readFile('shared/emporium-materials.json'));
const damage = {
    P: 'perfurante',
    S: 'cortante',
    B: 'contundente',
    N: 'necrótico',
    R: 'radiante',
    F: 'fogo',
  },
  properties = {
    A: 'munição',
    AF: 'munição de arma de fogo',
    BF: 'rajada',
    RLD: 'recarga',
    F: 'acuidade',
    H: 'pesada',
    L: 'leve',
    LD: 'carregamento',
    R: 'alcance',
    T: 'arremesso',
    V: 'versátil',
    '2H': 'duas mãos',
  },
  mastery = {
    Cleave: 'Fender',
    Graze: 'Raspar',
    Nick: 'Entalhar',
    Push: 'Empurrar',
    Sap: 'Enfraquecer',
    Slow: 'Lentidão',
    Topple: 'Derrubar',
    Vex: 'Provocar',
  };
const special = {
  'Double-Bladed Scimitar':
    'Se a usar na ação Atacar em seu turno, pode usar uma ação bônus imediatamente depois para um ataque corpo a corpo com dano básico 1d4 cortante, em vez de 2d4.',
  Hoopak:
    'Corpo a corpo ignora a propriedade Munição. Também pode ser usada como arma marcial à distância, usando balas de funda e causando 1d4 contundente, em vez de 1d6 perfurante.',
  'Hooked Shortspear':
    'Ao acertar, pode abrir mão do dano para tentar derrubar o alvo: ele faz resistência de Força, CD 8 + seu modificador de Força + sua proficiência; na falha, fica Caído.',
  'Light Repeating Crossbow':
    'O carregador contém até seis virotes e alimenta a arma após cada disparo; recarregar o carregador exige uma ação.',
};
const ids = [];
assert.equal(candidates.length, 52);
for (let i = 0; i < candidates.length; i++) {
  const x = candidates[i];
  if (editorial[x.id]) continue;
  const b = bases.find((y) => y.name === x.base.name && y.source === x.base.source),
    basic = basics.find((y) => y.original_name === x.base.name),
    job = jobs.find((y) => y.name === x.base.name);
  assert(b && damage[b.dmgType] && (basic || job), x.id);
  const label = basic?.name ?? job.label,
    baseId = basic?.id ?? job.id.replace(/^model-/, ''),
    reference = basic
      ? (basic.image_path ?? '/shop/items/' + basic.id + '.png')
      : '/shop/magic-completion-20261009/' + job.id + '.webp';
  await fs.access('public' + reference);
  const props = (b.property ?? []).map((p) => (typeof p === 'string' ? p : p.uid).split('|')[0]),
    two = props.includes('2H'),
    ranged = (b.type ?? '').split('|')[0] === 'R';
  let rule = `Forma: ${label}. Dano básico ${b.dmg1} ${damage[b.dmgType]}.`;
  if (b.range) rule += ` Alcance normal/máximo: ${b.range} pés.`;
  const propLabels = props
    .filter((p) => p !== 'S')
    .map((p) => {
      assert(properties[p], p);
      return properties[p];
    });
  if (propLabels.length) rule += ' Propriedades: ' + propLabels.join(', ') + '.';
  if (props.includes('V')) rule += ` Dano com duas mãos: ${b.dmg2} ${damage[b.dmgType]}.`;
  if (props.includes('H') && b.source === 'XPHB')
    rule += ` Arma pesada: ataques têm desvantagem sem ${ranged ? 'Destreza' : 'Força'} de pelo menos 13.`;
  if (b.name === 'Lance' && b.source === 'XPHB')
    rule += ' Exige duas mãos quando você não está montado; a exceção montada é resolvida na mesa.';
  if (special[b.name]) rule += ' ' + special[b.name];
  if (props.includes('RLD')) {
    assert(Number.isInteger(b.reload));
    rule += ` Após ${b.reload} disparos, recarregue com uma ação ou ação bônus.`;
  }
  if (props.includes('BF'))
    rule +=
      ' Com uma ação e dez munições, pode disparar em um cubo de dez pés no alcance normal. Cada criatura faz resistência de Destreza CD 15; as falhas recebem a mesma rolagem do dano da arma.';
  if (props.includes('AF'))
    rule +=
      b.age === 'futuristic'
        ? ' Usa células de energia; uma célula esgotada só pode ser recarregada com equipamento adequado a critério do mestre.'
        : 'As balas de arma de fogo são destruídas ao disparar.';
  if (b.mastery?.length)
    rule +=
      ' Maestria: ' +
      b.mastery
        .map((p) => {
          const key = p.split('|')[0];
          assert(mastery[key], key);
          return mastery[key];
        })
        .join(', ') +
      ', somente quando uma habilidade permite aplicá-la.';
  assert.equal(x.facts.reqAttune, true);
  assert.equal(x.facts.charges, 6);
  assert.equal(x.facts.spellScrollLevel, 0);
  assert.equal(x.facts.source, 'XDMG');
  rule +=
    ' Exige sintonia. Um truque fica vinculado quando a arma é criada, escolhido dentre Conjuração, Adivinhação, Evocação, Necromancia ou Transmutação. A magia é fixa deste exemplar e não pode ser trocada após a compra. Enquanto segura a arma, pode gastar uma das seis cargas para conjurar esse truque; ele usa CD 13 para resistências e bônus de ataque +5. Recupera 1d6 cargas gastas a cada amanhecer, sem superar seis. O encantamento não concede bônus numérico aos ataques ou ao dano da arma nem munição ilimitada. Dungeon Master’s Guide (2024), p. 258. Conjuração, cargas e demais efeitos são resolvidos pelo mestre na mesa.';
  if (x.facts.weight == null) {
    assert.equal(b.name, 'Sling');
    rule += ' Peso estimado para a loja: 0,1 lb; a fonte não fornece peso para a funda.';
  }
  const voice = [
    `${label}: escolha o truque antes de levar. Ele fica vinculado a esta peça; não vira um repertório de magias.`,
    `${label}: são seis cargas, mas o amanhecer recupera um dado de seis, não garante a reserva completa.`,
    `${label}: a sintonia vem antes do truque. Segurar a arma permite usar uma carga para conjurá-lo.`,
    `${label}: o truque usa CD treze e ataque mais cinco. Esses números não viram bônus nos golpes da arma.`,
    `${label}: conjuração, adivinhação, evocação, necromancia ou transmutação. Uma magia de outra escola não cabe neste encanto.`,
    `${label}: compre pelo modelo e pelo truque que precisa. Encantar a peça não dispensa ${props.includes('A') || props.includes('AF') ? 'munição nos disparos' : 'as propriedades normais da arma'}.`,
  ][i % 6];
  const material = materials[baseId] ?? 'metal';
  editorial[x.id] = {
    name: 'Arma com truque vinculado (' + label + ')',
    description:
      'Forma: ' +
      label +
      '. Um truque fixo, seis cargas, CD 13 e ataque mágico +5; exige sintonia.',
    merchant_comment: voice,
    rules_summary: rule,
    slots: two ? ['main_hand'] : ['main_hand', 'off_hand'],
    two_handed: two,
    material,
    family,
    base_id: baseId,
    model_name: label,
    magic_kind: 'weapon',
    source_edition: 'D&D 5e (2024)',
    spell_binding: { level: 0, schools: ['C', 'D', 'V', 'N', 'T'] },
    ...(x.facts.weight == null ? { estimated_weight_lb: 0.1 } : {}),
    review: 'approved',
  };
  assert(!recipes.some((r) => r.id === x.id));
  recipes.push({
    id: x.id,
    family,
    model: label,
    reference,
    texture: '/shop/magic-completion-20261009/material-enspell-cantrip.webp',
    enhancement: 0,
    material: 'material-enspell-cantrip',
    color: '#d9ccb4',
    opacity: material === 'wood' || material === 'leather' ? 0.26 : 0.42,
    glow: 0.35,
  });
  ids.push(x.id);
}
for (const [id, entry] of Object.entries(old)) assert.deepEqual(editorial[id], entry);
assert.equal(
  new Set(Object.values(editorial).map((x) => x.merchant_comment)).size,
  Object.keys(editorial).length,
);
await fs.writeFile(dir + '/editorial.json', JSON.stringify(editorial, null, 2) + '\n');
await fs.writeFile(dir + '/variant-recipes.json', JSON.stringify(recipes, null, 2) + '\n');
await fs.mkdir('.local', { recursive: true });
await fs.writeFile(
  '.local/enspell-cantrip-ids.json',
  JSON.stringify(
    candidates.map((x) => x.id),
    null,
    2,
  ) + '\n',
);
console.log(
  'Prepared ' +
    ids.length +
    ' distinct complete physical forms, individual speeches, source-reviewed mechanics and a fixed-spell selection. Existing editorial rows preserved.',
);
