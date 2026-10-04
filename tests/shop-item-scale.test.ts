import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { shopItemScale } from '../src/shop-item-scale.js';
import type { Item } from '../src/types.js';

const size = (id: string, category = 'Itens mundanos') => shopItemScale({ id, category });

test('balcão: os 71 itens têm proporções limitadas e independentes de peso, preço e categoria mágica', async () => {
  const original = JSON.parse(
    await readFile(new URL('../data/shop-export/loja.json', import.meta.url), 'utf8'),
  ) as { items: Item[] };
  const extensions = JSON.parse(
    await readFile(new URL('../data/equipment-catalog.json', import.meta.url), 'utf8'),
  ) as (Item & { active?: boolean })[];
  const items = [...original.items, ...extensions.filter((item) => item.active)];
  assert.equal(items.length, 71);
  assert.equal(new Set(items.map((item) => item.id)).size, 71);
  for (const item of items) {
    const scale = shopItemScale(item);
    assert.ok(Number.isFinite(scale) && scale >= 0.55 && scale <= 1.7, item.id);
    assert.ok(scale * 110 <= 187, `${item.id}: grande demais no balcão`);
    assert.equal(
      shopItemScale({
        ...item,
        category: 'Categoria alterada',
        weight_lb: '10000',
        price_cp: 999999,
      } as Item),
      scale,
      `${item.id}: tamanho deve vir do objeto ilustrado, não de seus atributos de jogo`,
    );
  }
});

test('balcão: joias, frascos, adaga e armas longas apresentam proporções distintas', () => {
  const ring = size('ring-of-protection');
  const potion = size('potion-of-healing');
  const dagger = size('dagger');
  const sword = size('longsword');
  const greatsword = size('greatsword');
  const staff = size('staff-of-the-magi');
  const bow = size('longbow');
  assert.ok(ring < potion && potion < dagger && dagger < sword);
  assert.ok(sword < greatsword && greatsword < staff && staff <= bow);
  assert.ok(potion < 0.85 && ring < 0.65 && bow >= 1.6);
  assert.equal(size('ball-bearings'), size('cigar'));
  assert.ok(size('ball-bearings') < ring);
  assert.ok(size('crystal-ball') < size('dragon-orb'));
  assert.ok(size('dragon-orb') < size('backpack'));
});

test('balcão: volumes embalados e cosméticos conservam sua forma física', () => {
  assert.ok(size('chest') > size('backpack'));
  assert.ok(size('tent') > size('bedroll'));
  assert.ok(size('plate-armor') > size('cloak-of-protection'));
  assert.ok(size('shield') > size('breastplate'));
  assert.equal(size('cosmetic-cape'), size('cloak-of-protection'));
  assert.equal(size('cosmetic-boots'), size('boots-of-elvenkind'));
  assert.ok(size('cosmetic-necklace') < size('cosmetic-gloves'));
  assert.ok(size('cosmetic-tiara') < size('cosmetic-boots'));
  assert.ok(size('chain') < size('longbow'), 'peso de metal não torna a corrente maior que o arco');
  assert.ok(size('hunting-trap') < size('quarterstaff'));
});

test('balcão: mercadorias futuras recebem escala segura sem confundir chaves de objeto', () => {
  assert.equal(shopItemScale(), 1);
  assert.equal(size('future-item'), 1);
  assert.equal(size('constructor', 'constructor'), 1);
  assert.ok(size('future-potion', 'Poções') < size('future-armor', 'Armaduras'));
  assert.ok(size('future-armor', 'Armaduras') < size('future-weapon', 'Armas'));
});
