import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { squareTokenCanvas } from '../server/token-canvas';

test('token retangular ganha só margem transparente, sem recorte ou mudança nos pixels', async () => {
  for (const [width, height] of [
    [1312, 1199],
    [513, 800],
  ]) {
    const original = await sharp({
      create: { width, height, channels: 4, background: { r: 120, g: 80, b: 30, alpha: 0.75 } },
    })
      .png()
      .toBuffer();
    const copy = Buffer.from(original),
      fixed = await squareTokenCanvas(original),
      side = Math.max(width, height);
    const meta = await sharp(fixed).metadata();
    assert.equal(meta.width, side);
    assert.equal(meta.height, side);
    assert.equal((await sharp(fixed).stats()).isOpaque, false);
    assert.deepEqual(original, copy);
    const inside = await sharp(fixed)
      .extract({
        left: Math.floor((side - width) / 2),
        top: Math.floor((side - height) / 2),
        width,
        height,
      })
      .raw()
      .toBuffer();
    assert.deepEqual(inside, await sharp(original).raw().toBuffer());
    assert.deepEqual(await squareTokenCanvas(fixed), fixed);
  }
});

test('canvas quadrado é preservado e fundo opaco continua sujeito à reprovação', async () => {
  const square = await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.5 } },
  })
    .png()
    .toBuffer();
  assert.deepEqual(await squareTokenCanvas(square), square);
  const opaque = await sharp({
    create: { width: 600, height: 512, channels: 3, background: '#8899aa' },
  })
    .png()
    .toBuffer();
  assert.deepEqual(await squareTokenCanvas(opaque), opaque);
  const opaqueAlpha = await sharp(opaque).ensureAlpha().png().toBuffer();
  assert.deepEqual(await squareTokenCanvas(opaqueAlpha), opaqueAlpha);
});
