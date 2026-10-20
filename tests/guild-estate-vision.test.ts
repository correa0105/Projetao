import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estateOpeningsSchema,
  guildEstateCanSee,
  guildEstateMove,
  guildEstateVisionPolygon,
} from '../shared/guild-estate-vision';
import { crestSchema } from '../shared/guilds';
import { guildEstateCanSeeOpening } from '../shared/guild-estate-vision';
import { crestArtBanners, crestArtFrames, crestArtSigils } from '../shared/guild-crest-art';

test('movimento bloqueia paredes, janelas abertas e portas fechadas sem saltar obstáculos', () => {
  const state = estateOpeningsSchema.parse({});
  assert(guildEstateMove({x:28,y:33},{x:28,y:28},state).y > 30.7);
  assert(guildEstateMove({x:29.9,y:33},{x:29.9,y:29},{...state,entry:false}).y > 30.7);
  assert(guildEstateMove({x:29.9,y:33},{x:29.9,y:29},state).y === 29);
  assert(guildEstateMove({x:25,y:20},{x:25,y:15},state).y > 17.2);
  assert(guildEstateMove({x:26,y:20},{x:34,y:20},state).x < 30);
  assert(guildEstateMove({x:26,y:20},{x:34,y:20},{...state,'main-forge':true}).x === 34);
});

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

test('raios nos encontros da porta fechada não revelam faixas do interior', () => {
  const closed = estateOpeningsSchema.parse({ entry: false });
  for (const at of [
    { x: 27, y: 34.60999999999998 },
    { x: 27.519999999999996, y: 34.22999999999998 },
    { x: 28.689999999999987, y: 32.71 },
    { x: 29.079999999999984, y: 31.19 },
  ]) {
    const polygon = guildEstateVisionPolygon(at, closed);
    for (const point of polygon.matchAll(/(-?\d+\.\d+) (-?\d+\.\d+)/g)) {
      const x = +point[1],
        y = +point[2];
      assert(
        !(x > 21.13 && x < 38.87 && y > 17.21 && y < 30.69),
        `Visão atravessou a entrada fechada: ${x}, ${y}`,
      );
    }
  }
});
test('aberturas de outros cômodos ficam ocultas atrás da porta fechada', () => {
  const state = estateOpeningsSchema.parse({});
  const at = { x: 25.4, y: 27 };
  assert(guildEstateCanSeeOpening(at, 'main-lounge', state));
  for (const id of ['west-window', 'east-window', 'main-forge', 'forge-meeting'] as const)
    assert(!guildEstateCanSeeOpening(at, id, state), id);
  assert(guildEstateCanSeeOpening(at, 'west-window', { ...state, 'main-lounge': true }));
  assert(!guildEstateCanSeeOpening(at, 'east-window', { ...state, 'main-lounge': true }));
});
test('brasões antigos conservam estilo e ilustrados validam camadas e transformações', () => {
  for (const choices of [crestArtBanners, crestArtFrames, crestArtSigils]) {
    assert.equal(choices.length, 40);
    assert.equal(new Set(choices).size, 40);
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
