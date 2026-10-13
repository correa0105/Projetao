import test from 'node:test';
import assert from 'node:assert/strict';
import {
  guildFitPerspective,
  guildPerspectiveCorners,
  guildPerspectiveSchema,
  guildMovePerspectiveCorner,
} from '../shared/guild-perspective';
import { guildDocumentSchema } from '../shared/guilds';
function lineIntersection(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number },
) {
  const cross = (u: { x: number; y: number }, v: { x: number; y: number }) =>
    u.x * v.y - u.y * v.x;
  const r = { x: b.x - a.x, y: b.y - a.y },
    s = { x: d.x - c.x, y: d.y - c.y };
  const t = cross({ x: c.x - a.x, y: c.y - a.y }, s) / cross(r, s);
  return { x: a.x + t * r.x, y: a.y + t * r.y };
}
test('bordas superior e inferior convergem na fuga escolhida em ambos os lados', () => {
  const base = { left: 100, top: 200, width: 100, height: 100 };
  for (const vanishing of [
    { x: -500, y: 100 },
    { x: 800, y: 100 },
  ]) {
    const perspective = guildFitPerspective(base, vanishing);
    assert(guildPerspectiveSchema.safeParse(perspective).success);
    const [tl, tr, br, bl] = guildPerspectiveCorners(perspective).map((p) => ({
      x: base.left + p.x * base.width,
      y: base.top + p.y * base.height,
    }));
    const actual = lineIntersection(tl, tr, bl, br);
    assert(Math.abs(actual.x - vanishing.x) < 1e-6);
    assert(Math.abs(actual.y - vanishing.y) < 1e-6);
  }
});
test('cantos não cruzam, valores não finitos são rejeitados e limites são respeitados', () => {
  const crossed = [
    { x: 0.4, y: 0.4 },
    { x: -0.4, y: -0.4 },
    { x: -0.4, y: -0.4 },
    { x: -0.4, y: -0.4 },
  ];
  assert(!guildPerspectiveSchema.safeParse(crossed).success);
  assert(
    !guildPerspectiveSchema.safeParse([
      { x: Infinity, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]).success,
  );
  const moved = guildMovePerspectiveCorner(undefined, 0, 10, -10);
  assert(guildPerspectiveSchema.safeParse(moved).success);
  assert(moved[0].x <= 0.4 && moved[0].y >= -0.4);
});
test('sede antiga mantém os mesmos dados; guias e ajuste são opcionais', () => {
  const original = {
    name: 'Antiga Companhia',
    description: '',
    crest: {
      icon: 'book',
      field: 'quartered',
      border: 'shield',
      ornament: 'beveled',
      iconColor: '#e5c681',
      fieldColor: '#283b36',
      fieldColor2: '#17272d',
      borderColor: '#b28a4c',
    },
    ambience: 'natural',
    placements: [],
  };
  assert.deepEqual(guildDocumentSchema.parse(original), original);
  assert(
    !guildDocumentSchema.safeParse({
      ...original,
      perspectives: { fake: { horizon: 0.5, left: -1, right: 2 } },
    }).success,
  );
});
