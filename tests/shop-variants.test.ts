import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Item } from '../src/types.js';
import { houseCatalog } from '../shared/house.js';
import {
  groupShopItems,
  getVariantLabel,
  getVariantOptions,
  matchShopGroup,
  selectShopVariant,
  type ShopItemGroup,
} from '../src/shop-variants.js';

type CatalogRow = Partial<Item> & {
  id: string;
  name: string;
  raw_data?: Record<string, unknown>;
  active?: boolean;
};
function load(path: string) {
  return JSON.parse(readFileSync(new URL(`../data/${path}`, import.meta.url), 'utf8'));
}
function apiItem(row: CatalogRow): Item {
  const raw = row.raw_data || {};
  const srdType = String(raw.srd_type || '');
  return {
    id: row.id,
    name: row.name,
    original_name: row.original_name || row.name,
    category: row.category || 'Itens mundanos',
    description: row.description || '',
    price_cp: row.price_cp ?? null,
    weight_lb: String(row.weight_lb ?? 0),
    source: row.source || 'Conteúdo do projeto',
    source_url: row.source_url || '',
    image_path: row.image_path,
    audio_path: row.audio_path,
    merchant_comment: row.merchant_comment,
    magic_family: (raw.magic_family as string) || null,
    base_item: (raw.base_item as string) || null,
    damage_type: (raw.damage_type as string) || null,
    rarity: (raw.rarity as string) || null,
    variant: (raw.variant as string) || null,
    enhancement: (raw.enhancement as number) ?? null,
    magic_kind: srdType.startsWith('Weapon ')
      ? 'weapon'
      : srdType.startsWith('Armor ')
        ? 'armor'
        : null,
  };
}
const expansion = load('emporium-expansion.json').items.map(apiItem) as Item[];
const originals = load('shop-export/loja.json').items.map(apiItem) as Item[];
const equipment = (load('equipment-catalog.json') as CatalogRow[])
  .filter((item) => item.active)
  .map(apiItem);
const ordinary = [
  ...new Map([...originals, ...equipment, ...expansion].map((item) => [item.id, item])).values(),
];
const house = houseCatalog.map((item): Item => ({
  id: `house-${item.id}`,
  name: item.name,
  original_name: item.name,
  category: 'Itens de House',
  description: item.description,
  price_cp: item.price_cp,
  weight_lb: '0',
  source: 'Conteúdo do projeto',
  source_url: '',
  merchant_comment: item.speech,
}));
const catalog = [...ordinary, ...house];
const groups = groupShopItems(catalog);
function family(name: string): ShopItemGroup {
  const found = groups.find((group) => group.family === name);
  assert.ok(found, `Família ausente: ${name}`);
  return found;
}
function item(id: string) {
  const found = catalog.find((candidate) => candidate.id === id);
  assert.ok(found, `Item ausente: ${id}`);
  return found;
}

test('Empório: 31 famílias reúnem 684 variantes sem perder ou duplicar os IDs reais', () => {
  const grouped = groups.filter((group) => group.family);
  assert.equal(grouped.length, 31);
  assert.equal(
    grouped.reduce((total, group) => total + group.variants.length, 0),
    684,
  );
  assert.equal(groups.length, catalog.length - 684 + 31);
  const offers = groups.flatMap((group) => group.variants);
  assert.equal(new Set(offers.map((offer) => offer.id)).size, catalog.length);
  assert.deepEqual(offers.map((offer) => offer.id).sort(), catalog.map((offer) => offer.id).sort());
  for (const offer of offers) assert.equal(offer, item(offer.id));
  for (const group of grouped) {
    assert.match(group.id, /^magic-family:(weapon|armor):/);
    assert.notEqual(group.id, group.variants[0].id);
    assert.ok(!group.name.includes(' ('), group.name);
    assert.deepEqual(
      group.models
        .flatMap((model) => model.variants)
        .map((offer) => offer.id)
        .sort(),
      group.variants.map((offer) => offer.id).sort(),
    );
  }
  const reversed = groupShopItems([...catalog].reverse());
  for (const group of grouped)
    assert.equal(reversed.find((other) => other.family === group.family)?.id, group.id);
});

test('Língua flamejante contém os 28 modelos corpo a corpo, inclusive o ID histórico', () => {
  const flame = family('Flame Tongue');
  assert.equal(flame.name, 'Língua flamejante');
  assert.equal(flame.kind, 'weapon');
  assert.equal(flame.models.length, 28);
  assert.equal(flame.variants.length, 28);
  assert.equal(
    flame.models.find((model) => model.id === 'longsword')?.variants[0],
    item('flame-tongue'),
  );
  assert.equal(flame.models.find((model) => model.id === 'club')?.label, 'Clava');
  assert.equal(
    flame.models.find((model) => model.id === 'club')?.variants[0].id,
    'flame-tongue-club',
  );
  assert.ok(!flame.models.some((model) => model.id === 'longbow'));
  assert.ok(!flame.models.some((model) => model.id === 'shortbow'));
  assert.deepEqual(flame.categories, ['Mágicos raros']);
});

test('Resistência possui os dez danos do SRD em cada uma das doze armaduras', () => {
  const resistance = family('Armor of Resistance');
  const damages = [
    'acid',
    'cold',
    'fire',
    'force',
    'lightning',
    'necrotic',
    'poison',
    'psychic',
    'radiant',
    'thunder',
  ];
  assert.equal(resistance.kind, 'armor');
  assert.equal(resistance.models.length, 12);
  assert.equal(resistance.variants.length, 120);
  for (const model of resistance.models) {
    assert.equal(model.variants.length, 10, model.label);
    assert.deepEqual(
      model.variants.map((variant) => variant.damage_type).sort(),
      [...damages].sort(),
    );
    const options = getVariantOptions(resistance, 'damage_type', { base_item: model.id });
    assert.equal(options.length, 10);
    assert.deepEqual(options.map((option) => option.value).sort(), [...damages].sort());
  }
  assert.equal(
    getVariantOptions(resistance, 'damage_type').find((option) => option.value === 'force')?.label,
    'Força',
  );
  const plateForce = resistance.variants.find(
    (variant) => variant.base_item === 'plate-armor' && variant.damage_type === 'force',
  )!;
  const leatherForce = selectShopVariant(resistance, plateForce, 'base_item', 'leather-armor')!;
  assert.equal(leatherForce.base_item, 'leather-armor');
  assert.equal(leatherForce.damage_type, 'force');
  assert.ok(resistance.variants.includes(leatherForce));
  const vulnerable = family('Armor of Vulnerability');
  assert.equal(vulnerable.variants.length, 36);
  assert.deepEqual(
    getVariantOptions(vulnerable, 'damage_type')
      .map((option) => option.value)
      .sort(),
    ['bludgeoning', 'piercing', 'slashing'],
  );
});

test('Bônus e raridades são seleções de ofertas concretas para armas, armaduras e escudos', () => {
  for (const [name, models, variants] of [
    ['Armor, +1, +2, or +3', 12, 36],
    ['Weapon, +1, +2, or +3', 38, 114],
    ['Shield, +1, +2, or +3', 1, 3],
  ] as const) {
    const group = family(name);
    assert.equal(group.models.length, models);
    assert.equal(group.variants.length, variants);
    assert.equal(group.categories.length, 3);
    for (const model of group.models) {
      assert.deepEqual(model.variants.map((variant) => variant.enhancement).sort(), [1, 2, 3]);
      assert.equal(new Set(model.variants.map((variant) => variant.rarity)).size, 3);
    }
  }
  const armor = family('Armor, +1, +2, or +3');
  assert.deepEqual(
    getVariantOptions(armor, 'enhancement', { base_item: 'plate-armor', rarity: 'Very Rare' }).map(
      (option) => option.value,
    ),
    ['2'],
  );
  const weapon = family('Weapon, +1, +2, or +3');
  const swordPlusTwo = selectShopVariant(weapon, item('magic-weapon'), 'enhancement', '2')!;
  assert.equal(swordPlusTwo.id, 'magic-weapon-longsword-plus-2');
  assert.equal(swordPlusTwo.rarity, 'Rare');
  assert.equal(
    selectShopVariant(weapon, swordPlusTwo, 'base_item', 'dagger')?.id,
    'magic-weapon-dagger-plus-2',
  );
  assert.equal(getVariantLabel(swordPlusTwo, 'Espada longa'), '+2 · Raro');
  const shield = family('Shield, +1, +2, or +3');
  assert.equal(shield.kind, 'armor');
  assert.equal(getVariantLabel(item('magic-shield'), 'Escudo'), '+1 · Incomum');
});

test('Escamas de dragão mantêm as dez cores com modelo único e sem dano inventado', () => {
  const scales = family('Dragon Scale Mail');
  assert.equal(scales.models.length, 1);
  assert.equal(scales.models[0].id, 'scale-mail');
  assert.equal(scales.models[0].label, 'Cota de escamas');
  assert.equal(scales.variants.length, 10);
  assert.equal(getVariantOptions(scales, 'damage_type').length, 0);
  const options = getVariantOptions(scales, 'variant', { base_item: 'scale-mail' });
  assert.equal(options.length, 10);
  assert.equal(new Set(options.map((option) => option.label)).size, 10);
  assert.equal(
    options.find((option) => option.value === 'black')?.label,
    'Negro · Ácido · Muito raro',
  );
  assert.equal(
    options.find((option) => option.value === 'red')?.label,
    'Vermelho · Fogo · Muito raro',
  );
  assert.equal(
    selectShopVariant(scales, item('dragon-scale-mail'), 'variant', 'blue')?.id,
    'dragon-scale-mail-blue',
  );
});

test('Busca por família, modelo, dano, bônus e cor conserva todas as opções do grupo', () => {
  const flame = family('Flame Tongue');
  assert.deepEqual(
    matchShopGroup(flame, 'lingua flamejante clava').map((offer) => offer.id),
    ['flame-tongue-club', 'flame-tongue-greatclub'],
  );
  assert.deepEqual(
    matchShopGroup(flame, 'LONGSWORD').map((offer) => offer.id),
    ['flame-tongue'],
  );
  assert.equal(matchShopGroup(flame, 'Língua flamejante').length, 28);
  assert.equal(matchShopGroup(flame, 'Arco longo').length, 0);
  const resistance = family('Armor of Resistance');
  const matches = matchShopGroup(resistance, 'resistencia acolchoada forca');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].base_item, 'padded-armor');
  assert.equal(matches[0].damage_type, 'force');
  assert.equal(resistance.variants.length, 120);
  assert.equal(resistance.models.length, 12);
  const weapon = family('Weapon, +1, +2, or +3');
  assert.equal(matchShopGroup(weapon, 'adaga +3')[0].id, 'magic-weapon-dagger-plus-3');
  assert.equal(matchShopGroup(weapon, 'MUITO RARO').length, 38);
  assert.equal(
    matchShopGroup(family('Dragon Scale Mail'), 'negro acido')[0].id,
    'dragon-scale-mail-black',
  );
  assert.deepEqual(matchShopGroup(flame, '   '), flame.variants);
});

test('Seletores não oferecem combinações inexistentes e não sintetizam IDs/preços', () => {
  const only = [
    item('magic-weapon'),
    item('magic-weapon-longsword-plus-3'),
    item('magic-weapon-dagger-plus-2'),
  ];
  const sparse = groupShopItems(only)[0];
  assert.deepEqual(
    getVariantOptions(sparse, 'enhancement', { base_item: 'longsword' }).map(
      (option) => option.value,
    ),
    ['1', '3'],
  );
  assert.equal(
    getVariantOptions(sparse, 'rarity', { base_item: 'longsword', enhancement: '2' }).length,
    0,
  );
  assert.equal(selectShopVariant(sparse, only[0], 'enhancement', '2'), only[2]);
  assert.equal(selectShopVariant(sparse, only[0], 'enhancement', '4'), null);
  for (const dimension of ['base_item', 'enhancement', 'rarity', 'variant'] as const) {
    for (const option of getVariantOptions(sparse, dimension)) {
      const selected = selectShopVariant(sparse, only[0], dimension, option.value);
      assert.ok(selected && only.includes(selected));
    }
  }
});

test('Itens mundanos, House, famílias únicas e mágicos sem modelo continuam individuais', () => {
  for (const id of [
    'dagger',
    'plate-armor',
    'sun-blade',
    'animated-shield',
    'ring-of-resistance',
    'potion-of-resistance',
  ]) {
    const group = groups.find((candidate) => candidate.id === id);
    assert.ok(group, id);
    assert.equal(group.family, null, id);
    assert.deepEqual(group.variants, [item(id)]);
    assert.deepEqual(group.models, []);
  }
  for (const offer of house) {
    const group = groups.find((candidate) => candidate.id === offer.id)!;
    assert.equal(group.family, null);
    assert.equal(group.variants[0], offer);
    assert.deepEqual(group.categories, ['Itens de House']);
  }
  const fakeNonEquipment = catalog
    .filter((offer) => offer.id === 'ring-of-resistance' || offer.id === 'potion-of-resistance')
    .map((offer) => ({ ...offer, magic_family: 'Teste', base_item: 'backpack', magic_kind: null }));
  assert.equal(
    groupShopItems([...catalog.filter((offer) => offer.id === 'backpack'), ...fakeNonEquipment])
      .length,
    3,
  );
});

test('Agrupamento conserva preço editado, som, fala, imagem e referência dos itens', () => {
  const edited = Object.freeze({
    ...item('flame-tongue-club'),
    price_cp: 12345,
    audio_path: '/audio/personalizado.wav',
    merchant_comment: 'Fala específica da clava escolhida.',
  });
  const unavailable = Object.freeze({ ...item('flame-tongue'), price_cp: null });
  const snapshot = JSON.stringify([edited, unavailable]);
  const group = groupShopItems(Object.freeze([edited, unavailable]))[0];
  assert.equal(group.variants[0], edited);
  assert.equal(group.variants[1], unavailable);
  assert.equal(selectShopVariant(group, unavailable, 'base_item', 'club'), edited);
  matchShopGroup(group, 'clava');
  getVariantLabel(edited);
  getVariantOptions(group, 'base_item');
  assert.equal(JSON.stringify([edited, unavailable]), snapshot);
  assert.equal(edited.price_cp, 12345);
  assert.equal(unavailable.price_cp, null);
  assert.equal(edited.audio_path, '/audio/personalizado.wav');
  assert.equal(edited.merchant_comment, 'Fala específica da clava escolhida.');
});
