import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from 'cannon-es';
import { shape } from '../src/vtt-dice-geometry.js';
import { diceHull, DicePhysics } from '../src/vtt-dice-physics.js';
import { attackFormula, attackOutcome, criticalDamage } from '../shared/vtt-attack.js';
import { hpCommand } from '../shared/vtt-hp.js';
import { bossStyles, tokenSchema, visibleBossStyle } from '../shared/vtt.js';
import { monsterArt } from '../shared/vtt-monster-art.js';
const rng = () => {
  let n = 42;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
};
test('Every die collider matches the planar geometry and has outward faces', () => {
  for (const sides of [4, 6, 8, 10, 12, 20]) {
    const { geometry } = shape(sides),
      h = diceHull(geometry, 0.8);
    assert.equal(h.faces.length, sides);
    assert.ok(h.faceNormals.every((normal, i) => normal.dot(h.vertices[h.faces[i][0]]) > 0));
    geometry.dispose();
  }
});
test('Dice travel, collide, land above the floor and settle without intersecting', () => {
  const geometries = [6, 6, 8, 10, 12, 20].map((n) => shape(n).geometry),
    p = new DicePhysics(geometries, 16, 10, 0.7, rng()),
    starts = p.bodies.map((b) => b.position.clone());
  let collisions = 0;
  for (const b of p.bodies)
    b.addEventListener('collide', (e: { body: C.Body }) => {
      if (p.bodies.includes(e.body)) collisions++;
    });
  for (let i = 0; i < 600 && !p.settled; i++) p.step();
  assert.ok(collisions > 0, 'dice must contact each other');
  assert.ok(p.settled, 'all dice must sleep after energy dissipates');
  assert.ok(
    p.bodies.some((b, i) => Math.hypot(b.position.x - starts[i].x, b.position.y - starts[i].y) > 6),
    'must cross a substantial part of screen',
  );
  for (const b of p.bodies) {
    const h = b.shapes[0] as C.ConvexPolyhedron;
    for (const v of h.vertices) {
      const world = b.quaternion.vmult(v).vadd(b.position);
      assert.ok(world.z > -0.02, 'no vertex beneath the floor');
    }
  }
  const axis = new C.Vec3();
  for (let i = 0; i < p.bodies.length; i++)
    for (let j = i + 1; j < p.bodies.length; j++) {
      const a = p.bodies[i],
        b = p.bodies[j];
      assert.equal(
        (a.shapes[0] as C.ConvexPolyhedron).findSeparatingAxis(
          b.shapes[0] as C.ConvexPolyhedron,
          a.position,
          a.quaternion,
          b.position,
          b.quaternion,
          axis,
        ),
        false,
        'resting dice must not overlap',
      );
    }
  geometries.forEach((g) => g.dispose());
});
test('Attack equality hits AC, natural one misses and natural twenty hits', () => {
  const roll = (dice: number[], total: number, formula = '1d20+3') => ({ dice, total, formula });
  assert.equal(attackOutcome(roll([12], 15), 15).hit, true);
  assert.equal(attackOutcome(roll([11], 14), 15).hit, false);
  assert.equal(attackOutcome(roll([1], 101), 15).hit, false);
  assert.equal(attackOutcome(roll([20], 20), 99).hit, true);
  assert.equal(attackOutcome(roll([1, 20], 23, '2d20kh1+3'), 99).critical, true);
  assert.equal(attackOutcome(roll([1, 20], 4, '2d20kl1+3'), 3).hit, false);
});

test('Critical damage doubles dice without doubling the modifier', () => {
  assert.deepEqual(criticalDamage('2d6+3'), ['4d6+3']);
  assert.deepEqual(criticalDamage('60d4-2'), ['60d4-2', '60d4']);
});
test('Attack mode keeps the modifier and rejects non-attack formulas', () => {
  assert.equal(attackFormula('1d20+7', 'advantage'), '2d20kh1+7');
  assert.equal(attackFormula('1d20-2', 'disadvantage'), '2d20kl1-2');
  assert.equal(attackFormula('2d20kh1+3', 'normal'), '1d20+3');
  assert.throws(() => attackFormula('3d6', 'advantage'));
});
test('PV commands distinguish setting, healing and damage, with bounds', () => {
  assert.equal(hpCommand('+4', 5, 11), 9);
  assert.equal(hpCommand('-3', 5, 11), 2);
  assert.equal(hpCommand('4', 5, 11), 4);
  assert.equal(hpCommand('+99', 5, 11), 11);
  assert.equal(hpCommand('-99', 5, 11), 0);
  for (const value of ['', '+', '1.5', '1e3', 'foo']) assert.throws(() => hpCommand(value, 5, 11));
});
test('Boss choices omit obsolete styles while older rooms retain compatibility', () => {
  assert.deepEqual(bossStyles, [
    'classic-red',
    'classic-ice',
    'classic-grass',
    'classic-oak',
    'evil',
  ]);
  assert.equal(tokenSchema.shape.bossStyle.parse('royal'), 'royal');
  assert.equal(visibleBossStyle('royal'), 'classic-red');
  assert.equal(visibleBossStyle('classic-ice'), 'classic-ice');
  assert.match(monsterArt('monster-goblin-warrior', ''), /^\/vtt\/monsters\//);
  assert.equal(monsterArt('', ' Goblin Warrior '), monsterArt('monster-goblin-warrior', ''));
});
