import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newScene, newToken, documentSchema, newDocument } from '../shared/vtt';
import { applyTokenBlood, injury, isBloodied, MAX_BLOOD_DECALS } from '../shared/vtt-blood';

function fixture() {
  const scene = newScene(randomUUID());
  const token = newToken(randomUUID(), scene);
  token.hp = token.maxHp = 100;
  token.x = token.y = 200;
  scene.tokens.push(token);
  const change = (hp: number, x = token.x, path?: { x: number; y: number }[]) => {
    const old = structuredClone(token);
    token.hp = hp;
    token.x = x;
    applyTokenBlood(scene, token, old, path, 10000);
  };
  return { scene, token, change };
}
test('each applied hit adds a wound, partial healing fades existing wounds and full healing clears the token', () => {
  const { scene, token, change } = fixture();
  change(99);
  change(90);
  change(50);
  assert.equal(token.blood?.wounds.length, 3);
  assert.equal(scene.blood.length, 3);
  const wounds = structuredClone(token.blood!.wounds);
  change(75);
  assert.deepEqual(
    token.blood!.wounds.map((w) => w.seed),
    wounds.map((w) => w.seed),
  );
  for (let i = 0; i < wounds.length; i++)
    assert.ok(Math.abs(token.blood!.wounds[i].strength - wounds[i].strength / 2) < 1e-10);
  change(100);
  assert.deepEqual(token.blood!.wounds, []);
  assert.equal(scene.blood.length, 3, 'healing does not erase blood already spilled on the ground');
  change(100, 300);
  assert.equal(scene.blood.length, 3);
});
test('half health is inclusive, wounded creatures drip and bloodied creatures leave denser tracks', () => {
  assert.equal(isBloodied({ hp: 50, maxHp: 100 }), true);
  assert.equal(isBloodied({ hp: 51, maxHp: 100 }), false);
  assert.equal(isBloodied({ hp: 6, maxHp: 13 }), true);
  const mild = fixture(),
    severe = fixture();
  mild.change(75);
  severe.change(50);
  mild.change(75, 600);
  severe.change(50, 600);
  assert.ok(mild.scene.blood.some((d) => d.kind === 'drop'));
  assert.ok(
    severe.scene.blood.filter((d) => d.kind === 'trail').length >
      mild.scene.blood.filter((d) => d.kind === 'drop').length * 3,
  );
  assert.equal(mild.token.hp, 75);
  assert.equal(severe.token.hp, 50, 'the visual adds no ongoing damage');
});
test('accepted paths turn around corners and distance sampling is independent of pointer frequency', () => {
  const once = fixture(),
    split = fixture();
  once.change(50);
  split.change(50);
  once.change(50, 400, [
    { x: 200, y: 400 },
    { x: 400, y: 400 },
  ]);
  const old = structuredClone(split.token);
  split.token.y = 400;
  applyTokenBlood(split.scene, split.token, old, [{ x: 200, y: 400 }], 10000);
  split.change(50, 400);
  const positions = (scene: typeof once.scene) =>
    scene.blood.filter((d) => d.kind === 'trail').map((d) => [+d.x.toFixed(6), +d.y.toFixed(6)]);
  assert.deepEqual(positions(once.scene), positions(split.scene));
  assert.ok(positions(once.scene).every(([x, y]) => x === 200 || y === 400));
});
test('reloads, healing, rotation and forged scar metadata never create extra floor marks', () => {
  const { scene, token, change } = fixture();
  change(60);
  const old = structuredClone(token);
  token.blood = { serial: 99, distance: 0, wounds: [{ seed: 1, strength: 1 }] };
  token.rotation = 90;
  applyTokenBlood(scene, token, old);
  assert.deepEqual(token.blood, old.blood);
  assert.equal(scene.blood.length, 1);
  change(70);
  assert.equal(scene.blood.length, 1);
});
test('hidden layers stay private, decal storage is bounded and old rooms need no destructive migration', () => {
  const { scene, token, change } = fixture();
  token.hidden = true;
  change(50, 300);
  assert.ok(scene.blood.every((d) => d.private));
  for (let i = 0; i < 45; i++) change(50, i % 2 ? 1500 : 200);
  assert.equal(scene.blood.length, MAX_BLOOD_DECALS);
  assert.equal(injury({ hp: -2, maxHp: 100 }), 1);
  const doc = newDocument(randomUUID());
  delete (doc.scenes[0] as any).blood;
  const parsed = documentSchema.parse(doc);
  assert.deepEqual(parsed.scenes[0].blood, []);
});
