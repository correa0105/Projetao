import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { merchantComment } from '../src/shop-presentation.js';
import type { Item } from '../src/types.js';

type CatalogItem = Item & { active?: boolean };
async function activeCatalog() {
  const original = JSON.parse(
    await readFile(new URL('../data/shop-export/loja.json', import.meta.url), 'utf8'),
  ) as { items: CatalogItem[] };
  const equipment = JSON.parse(
    await readFile(new URL('../data/equipment-catalog.json', import.meta.url), 'utf8'),
  ) as CatalogItem[];
  // The seed publishes every item from the supplied shop export, then only active extensions.
  return [...original.items, ...equipment.filter((item) => item.active)];
}

test('mercador: os 71 itens ativos, inclusive cosméticos e artefato sem preço, têm falas próprias', async () => {
  const items = await activeCatalog();
  assert.equal(items.length, 71);
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  assert.ok(items.some((item) => item.id === 'dragon-orb' && item.price_cp === null));
  const lines = items.map((item) => merchantComment(item));
  for (const [index, item] of items.entries()) {
    const line = lines[index];
    assert.ok(line.trim().length >= 30, `${item.id}: falta um comentário completo`);
    assert.ok(line.length <= 240, `${item.id}: comentário longo demais para o balão`);
    assert.doesNotMatch(
      line,
      /Examine à vontade antes de decidir/,
      `${item.id}: caiu no texto genérico`,
    );
    assert.equal(
      merchantComment({
        ...item,
        name: 'Outro nome',
        merchant_comment: 'Texto genérico recebido da API.',
      }),
      line,
      `${item.id}: a fala depende do nome ou do comentário genérico do catálogo`,
    );
  }
  assert.equal(new Set(lines).size, items.length, 'Cada produto deve ter um comentário diferente.');
});

test('mercador: itens novos fora do catálogo ainda podem ser examinados sem erro', () => {
  const line = merchantComment({ id: 'future-item', name: 'Mercadoria nova' } as Item);
  assert.equal(typeof line, 'string');
  assert.ok(line.includes('Mercadoria nova'));
});
