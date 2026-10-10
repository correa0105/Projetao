import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newScene, newToken, documentSchema, newDocument, applyTokenDeath } from '../shared/vtt';
import { applyTokenBlood, injury, isBloodied, MAX_BLOOD_DECALS } from '../shared/vtt-blood';
function fixture() {
  const scene = newScene(randomUUID()),
    token = newToken(randomUUID(), scene);
  token.hp = token.maxHp = 100;
  token.x = token.y = 200;
  scene.tokens.push(token);
  const change = (hp: number, x = token.x, enabled = true) => {
    const old = structuredClone(token);
    token.hp = hp;
    token.x = x;
    applyTokenBlood(scene, token, old, [], 10000, enabled);
  };
  return { scene, token, change };
}
test('hits add small separated splashes, partial healing fades the same wounds and full healing clears the body', () => {
  const { scene, token, change } = fixture();
  change(99);
  change(90);
  change(50);
  assert.equal(token.blood!.wounds.length, 3);
  assert.equal(scene.blood.length, 3);
  assert.ok(scene.blood.every((d) => d.kind === 'splash' && d.size <= scene.grid.size * 0.103));
  const wounds = structuredClone(token.blood!.wounds);
  change(75);
  assert.deepEqual(
    token.blood!.wounds.map((w) => w.seed),
    wounds.map((w) => w.seed),
  );
  wounds.forEach((w, i) =>
    assert.ok(Math.abs(token.blood!.wounds[i].strength - w.strength / 2) < 1e-10),
  );
  change(100);
  assert.deepEqual(token.blood!.wounds, []);
  assert.equal(scene.blood.length, 3);
  change(100);
  assert.equal(scene.blood.length, 3);
});
test('small pools accumulate per 15 ft only at half HP or below, with no idle/replay spam', () => {
  const { scene, token, change } = fixture();
  scene.grid.size = 70; scene.grid.scale = 5; scene.grid.unit = 'ft';
  change(75, 200); change(75, 410);
  assert.equal(scene.blood.filter(d=>d.kind==='trail').length, 0);
  change(50);
  change(50, 480); change(50, 550);
  assert.equal(scene.blood.filter(d=>d.kind==='trail').length, 0);
  change(50, 620);
  assert.equal(scene.blood.filter(d=>d.kind==='trail').length, 1);
  assert.equal(scene.blood.at(-1)!.x, 620);
  for(let i=0;i<50;i++) change(50);
  assert.equal(scene.blood.filter(d=>d.kind==='trail').length, 1);
  change(50, 1040);
  assert.equal(scene.blood.filter(d=>d.kind==='trail').length, 3);
  assert.equal(token.hp, 50);
  change(80, 1110); change(50); change(50, 1250);
  assert.equal(scene.blood.filter(d=>d.kind==='trail').length, 3);
  token.bleeds=false; change(20, 1400);
  assert.equal(token.blood,null);
  assert.equal(scene.blood.filter(d=>d.kind==='trail').length,3);
  assert.ok(isBloodied({ hp: 50, maxHp: 100 }));
  assert.ok(!isBloodied({ hp: 51, maxHp: 100 }));
});

test('metric grids and corner paths put pools at the accepted 15 ft position', () => {
  const {scene,token,change}=fixture();
  scene.grid.size=70;scene.grid.scale=1.524;scene.grid.unit='m';scene.grid.diagonal='euclidean';
  change(50);
  const old=structuredClone(token);token.x=340;token.y=270;
  applyTokenBlood(scene,token,old,[{x:270,y:200},{x:270,y:270},{x:340,y:270}]);
  const pool=scene.blood.find(d=>d.kind==='trail')!;
  assert.equal(pool.x,340);assert.equal(pool.y,270);
  assert.ok(pool.size<scene.grid.size*.2);
});
test('room can disable blood entirely without changing HP', () => {
  const { scene, token, change } = fixture();
  change(75);
  const before = scene.blood.length;
  change(50, 500, false);
  assert.equal(token.hp, 50);
  assert.equal(token.blood, null);
  assert.equal(scene.blood.length, before);
  change(30, 500, true);
  assert.equal(scene.blood.length, before + 1);
});
test('replays, rotation, healing and forged scars cannot add floor marks', () => {
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
test('private splashes remain private, storage bounded, older rooms default on and manual off survives parsing', () => {
  const { scene, token, change } = fixture();
  token.hidden = true;
  for (let i = 0; i < 810; i++) {
    change(100);
    change(50);
  }
  assert.equal(scene.blood.length, MAX_BLOOD_DECALS);
  assert.ok(scene.blood.every((d) => d.private));
  assert.equal(injury({ hp: -2, maxHp: 100 }), 1);
  const doc = newDocument(randomUUID());
  delete (doc as any).bloodEnabled;
  delete (doc as any).automaticDeath;
  delete (doc.scenes[0] as any).blood;
  const parsed = documentSchema.parse(doc);
  assert.ok(parsed.bloodEnabled);
  assert.ok(parsed.automaticDeath);
  assert.deepEqual(parsed.scenes[0].blood, []);
  parsed.bloodEnabled = parsed.automaticDeath = false;
  assert.equal(documentSchema.parse(parsed).automaticDeath, false);
  token.hp = 0;
  token.deathAt = null;
  applyTokenDeath(token, 50, 123, parsed.automaticDeath);
  assert.equal(token.deathAt, null);
  applyTokenDeath(token, 50, 123, true);
  assert.equal(token.deathAt, 123);
});
