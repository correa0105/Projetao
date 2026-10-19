import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estateOpeningsSchema,
  guildEstateCanSee,
  guildEstateVisionPolygon,
} from '../shared/guild-estate-vision';
import { crestSchema } from '../shared/guilds';
import { crestArtBanners, crestArtFrames, crestArtSigils } from '../shared/guild-crest-art';

test('paredes e portas fechadas bloqueiam visão; vãos abertos transmitem visão', () => {
  const closed = estateOpeningsSchema.parse({});
  assert(!guildEstateCanSee({ x: 26, y: 20 }, { x: 34, y: 20 }, closed));
  assert(guildEstateCanSee({ x: 26, y: 20 }, { x: 34, y: 20 }, { ...closed, 'main-forge': true }));
  assert(!guildEstateCanSee({ x: 25.4, y: 20 }, { x: 25.4, y: 27 }, closed));
  assert(
    guildEstateCanSee({ x: 25.4, y: 20 }, { x: 25.4, y: 27 }, { ...closed, 'main-lounge': true }),
  );
  assert(
    !guildEstateCanSee({ x: 28, y: 20 }, { x: 28, y: 27 }, { ...closed, 'main-lounge': true }),
  );
  assert(guildEstateCanSee({ x: 30, y: 33 }, { x: 30, y: 29 }, closed));
  assert(!guildEstateCanSee({ x: 30, y: 33 }, { x: 30, y: 29 }, { ...closed, entry: false }));
});
test('fechar veneziana impede visão e polígono percorre ângulos sem voltar sobre si', () => {
  const opened = estateOpeningsSchema.parse({});
  const at = { x: 25, y: 20 };
  assert(guildEstateCanSee(at, { x: 25, y: 15 }, opened));
  assert(!guildEstateCanSee(at, { x: 25, y: 15 }, { ...opened, 'west-window': false }));
  const polygon = guildEstateVisionPolygon(at, opened);
  assert(!polygon.includes('NaN'));
  const angles = [...polygon.matchAll(/(-?\d+\.\d+) (-?\d+\.\d+)/g)].map(
    (m) => (Math.atan2(+m[2] - at.y, +m[1] - at.x) + Math.PI * 2) % (Math.PI * 2),
  );
  for (let i = 1; i < angles.length; i++) assert(angles[i] >= angles[i - 1] - 0.0002);
});
test('brasões antigos conservam estilo e ilustrados validam camadas e transformações', () => {
  for (const choices of [crestArtBanners, crestArtFrames, crestArtSigils]) {
    assert.equal(choices.length, 20);
    assert.equal(new Set(choices).size, 20);
  }
  assert.equal(crestSchema.parse({ icon: 'wolf' }).art, undefined);
  const crest = crestSchema.parse({
    art: {
      symbol: 'raven-blades',
      order: ['symbol', 'banner', 'frame'],
      symbolRotation: 47,
      symbolX: 12,
    },
  });
  assert.equal(crest.art?.symbolRotation, 47);
  assert.deepEqual(crest.art?.order, ['symbol', 'banner', 'frame']);
  for (const art of [
    { order: ['banner', 'banner', 'frame'] },
    { symbolScale: 6 },
    { symbolX: 30 },
    { symbol: 'unknown' },
    { showBanner: 'yes' },
  ])
    assert(!crestSchema.safeParse({ art }).success);
});
