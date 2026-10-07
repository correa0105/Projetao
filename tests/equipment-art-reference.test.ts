import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  equipmentArtReference,
  trustedEquipmentPath,
  rasterizeEquipmentArt,
} from '../server/equipment-art-reference.js';
test('referências: skins SVG locais viram PNG, partes usam seu modelo, conteúdo externo é recusado', async () => {
  const path = '/shop/magic-skins/magic-armor.svg';
  assert.equal(trustedEquipmentPath(path), true);
  for (const forbidden of [
    '/shop/other/item.svg',
    '/shop/magic-skins/../../item.svg',
    'https://example.test/item.svg',
  ])
    assert.equal(trustedEquipmentPath(forbidden), false);
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="96"><defs><clipPath id="piece"><rect width="32" height="96"/></clipPath></defs><rect width="64" height="96" fill="#123456" clip-path="url( '#piece' )"/></svg>`,
  );
  const image = await rasterizeEquipmentArt(svg, path);
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 64);
  assert.equal(metadata.height, 96);
  assert.equal(metadata.hasAlpha, true);
  const child = {
    name: 'Proteção da cabeça',
    image_path: '/shop/equipment/armor-piece-head.svg',
    raw_data: { armor_bundle_model_image: path, piece_slot: 'head' },
  };
  const ref = equipmentArtReference(child);
  assert.equal(ref.path, path);
  assert.match(ref.name, /somente a peça.*head/);
  assert.equal(equipmentArtReference({ name: 'Modelo completo', image_path: path }).path, path);
  for (const forbidden of [
    '<image href="https://example.test/art.png"/>',
    '<image href="file:///etc/passwd"/>',
    '<script>alert(1)</script>',
    '<foreignObject width="100" height="100"/>',
    '<rect fill="url(https://example.test/color.svg)"/>',
    '<!DOCTYPE svg [<!ENTITY art SYSTEM "file:///etc/passwd">]>',
  ])
    await assert.rejects(
      rasterizeEquipmentArt(
        Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="96">${forbidden}</svg>`,
        ),
        path,
      ),
    );
  await assert.rejects(rasterizeEquipmentArt(svg, '/shop/other/item.svg'));
});
