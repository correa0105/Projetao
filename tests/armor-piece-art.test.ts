import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { armorBundles } from '../shared/armor-bundles';
import { armorPieceImage } from '../shared/armor-piece-art';
import { equipmentArtReference } from '../server/equipment-art-reference';

test('cada peça humana ou de mascote possui imagem própria; placas anteriores e bardas inteiras permanecem', async () => {
  const files = new Set<string>();
  for (const bundle of armorBundles()) {
    if (bundle.target === 'mount') { assert.equal(bundle.pieces.length, 1); continue; }
    const paths = bundle.pieces.slice(1).map(piece => armorPieceImage(bundle.id, piece.slot));
    assert.equal(new Set(paths).size, 5, bundle.id);
    for (const path of paths) {
      assert(path && /^\/shop\/[a-z0-9/_-]+\.(png|webp)$/.test(path), bundle.id);
      assert.equal(equipmentArtReference({ name: 'Peça', image_path: path }).path, path);
      files.add(path);
    }
  }
  for (const path of files) {
    const bytes = await readFile('public' + path), metadata = await sharp(bytes).metadata();
    assert(metadata.hasAlpha, path);
    assert(metadata.width! >= 500 && metadata.height! >= 500, path);
    assert.equal((await sharp(bytes).extractChannel('alpha').stats()).channels[0].min, 0, path);
  }
  assert.equal(armorPieceImage('plate-armor', 'head'), '/shop/equipment/plate-helmet.png');
  assert.notEqual(armorPieceImage('hide-armor', 'head'), armorPieceImage('leather-armor', 'head'));
  assert.notEqual(armorPieceImage('magic-armor', 'head'), armorPieceImage('magic-armor-plate-armor-plus-2', 'head'));
});
