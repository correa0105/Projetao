import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import tierArt from '../shared/armor-tier-art.json';
import { armorPieceImage } from '../shared/armor-piece-art';
import { armorBundle } from '../shared/armor-bundles';

test('os treze modelos +1/+2/+3 compartilham artes e conservam itens, níveis e peças separados', async () => {
  const files = ['data/emporium-expansion.json', 'data/shop-magic-completion-20261009/catalog.json'];
  const items = new Map<string, any>();
  for (const path of files)
    for (const row of JSON.parse(await readFile(path, 'utf8')).items) items.set(row.id, row);
  const canonical = [...new Set(Object.values(tierArt))];
  assert.equal(canonical.length, 13);
  const modelImages = new Set<string>();
  for (const id of canonical) {
    const ids = [id, ...Object.entries(tierArt).filter(([, to]) => to === id).map(([from]) => from)];
    const rows = ids.map(key => items.get(key));
    assert.deepEqual(rows.map(row => row.raw_data.enhancement).sort(), [1, 2, 3]);
    assert.equal(new Set(rows.map(row => row.id)).size, 3);
    assert.equal(new Set(rows.map(row => row.image_path)).size, 1);
    assert.equal(new Set(rows.map(row => row.raw_data.base_item)).size, 1);
    assert(!modelImages.has(rows[0].image_path));
    modelImages.add(rows[0].image_path);
    const pieceIds = new Set<string>();
    for (const key of ids) {
      const bundle = armorBundle(key)!; assert(bundle, key);
      for (const piece of bundle.pieces) { assert(!pieceIds.has(piece.id)); pieceIds.add(piece.id); }
    }
    assert.equal(pieceIds.size, 18);
    for (const slot of ['head', 'bracers', 'legs', 'feet', 'shoulders'] as const) {
      const paths = ids.map(key => armorPieceImage(key, slot));
      assert.equal(new Set(paths).size, 1);
      assert((await readFile('public' + paths[0])).length > 0);
    }
  }
  assert.notEqual(armorPieceImage('hide-armor', 'head'), armorPieceImage('leather-armor', 'head'));
  assert.notEqual(armorPieceImage('mithral-armor-chain-mail', 'head'), armorPieceImage('magic-armor-chain-mail-plus-1', 'head'));
});
