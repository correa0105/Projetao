import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import {
  spellProfiles,
  spellProfile,
  preparedSpell,
  insideSpell,
  spellCells,
  spellCastSchema,
  validSpellSelection,
  breathProfile,
  spellOrigin,
  feetDistance,
  grantedBreath,
} from '../shared/vtt-spells';
import { newDocument, newToken } from '../shared/vtt';
const base = (name: string) => {
  const p = spellProfile(name);
  assert.ok(p, name);
  return p;
};
const scene = newDocument(randomUUID()).scenes[0];
scene.grid = {
  ...scene.grid,
  type: 'square',
  size: 100,
  scale: 5,
  unit: 'ft',
  offsetX: 0,
  offsetY: 0,
  diagonal: 'euclidean',
};
test('all 339 SRD spells have individually assigned, distinct visual recipes', async () => {
  const source = JSON.parse(await fs.readFile('data/vtt/srd-2024.json', 'utf8'));
  assert.equal(spellProfiles.length, 339);
  assert.deepEqual(
    new Set(source.spells.map((s: { id: string }) => s.id)),
    new Set(spellProfiles.map((s) => s.id)),
  );
  assert.equal(new Set(spellProfiles.map((s) => JSON.stringify(s.visual))).size, 339);
  assert.ok(
    spellProfiles.every(
      (s) => s.visual.motifs.length >= 2 && s.visual.motifs.every((m) => m.length > 0),
    ),
  );
  const generator = await fs.readFile('scripts/prepare-vtt-spells.mjs', 'utf8');
  // All spells are assigned intentionally; no unnamed generic fallback is published.
  assert.match(generator, /remainingThemes/);
});
test('upcast targets come from the individual SRD rule, never generic damage scaling', () => {
  assert.equal(preparedSpell(base('Bless'), 4).count, 6);
  assert.equal(preparedSpell(base('Hold Person'), 5).count, 4);
  assert.equal(preparedSpell(base('Fly'), 5).count, 3);
  assert.equal(preparedSpell(base('Aid'), 6).count, 3);
  assert.equal(preparedSpell(base('Fireball'), 9).size, 20);
  assert.equal(preparedSpell(base('Burning Hands'), 9).size, 15);
  assert.equal(preparedSpell(base('Fog Cloud'), 4).size, 80);
  assert.equal(preparedSpell(base('Confusion'), 6).size, 20);
  assert.equal(preparedSpell(base('Private Sanctum'), 6).size, 300);
});
test('darts and rays assign every projectile and may repeat a target; ordinary targets remain unique', () => {
  const id = randomUUID(),
    other = randomUUID(),
    missiles = preparedSpell(base('Magic Missile'), 3);
  assert.equal(missiles.count, 5);
  assert.equal(validSpellSelection(missiles, [id, id, other, id, id], []), true);
  assert.equal(validSpellSelection(missiles, [id], []), false);
  assert.equal(validSpellSelection(base('Bless'), [id, id], []), false);
  assert.equal(validSpellSelection(base('Bless'), [id], []), true);
  assert.equal(preparedSpell(base('Eldritch Blast'), 0, 17).count, 4);
  assert.equal(preparedSpell(base('Scorching Ray'), 5).count, 6);
  assert.equal(preparedSpell(base('Chain Lightning'), 8).count, 6);
});
test('upcast changes concentration and duration where the spell says so', () => {
  assert.equal(preparedSpell(base('Bestow Curse'), 5).concentration, false);
  assert.equal(preparedSpell(base('Bestow Curse'), 9).duration, null);
  assert.equal(preparedSpell(base('Major Image'), 4).concentration, false);
  assert.equal(preparedSpell(base('Major Image'), 4).duration, null);
  assert.equal(preparedSpell(base("Hunter's Mark"), 5).duration, 86400);
  assert.equal(preparedSpell(base('Mass Suggestion'), 9).duration, 366 * 86400);
});
test('multi-area and wall choices change the geometry before confirmation', () => {
  assert.equal(base('Meteor Swarm').areas, 4);
  assert.equal(base('Fire Storm').areas, 10);
  assert.equal(validSpellSelection(base('Meteor Swarm'), [], [{ x: 0, y: 0, angle: 0 }]), false);
  const wall = preparedSpell(base('Wall of Fire'), 4, 1, 1);
  assert.equal(wall.shape, 'ring');
  assert.equal(wall.size, 10);
  assert.equal(preparedSpell(base('Wall of Force'), 5, 1, 1).areas, 1);
  assert.equal(preparedSpell(base('Forcecage'), 7, 1, 1).size, 10);
});
test('cone uses width equal to distance at the end and keeps its origin at the caster', () => {
  const p = base('Burning Hands'),
    at = { x: 200, y: 200, angle: 0 };
  assert.equal(insideSpell({ x: 450, y: 300 }, p, at, scene.grid), true);
  assert.equal(insideSpell({ x: 220, y: 300 }, p, at, scene.grid), false);
  assert.equal(insideSpell({ x: 100, y: 200 }, p, at, scene.grid), false);
  const t = { ...newToken(randomUUID(), scene), x: 500, y: 600 };
  assert.deepEqual(spellOrigin(p, t, at), { x: 500, y: 600, angle: 0 });
});
test('line width and rotation determine cells; circle geometry respects meter grids', () => {
  const p = base('Lightning Bolt'),
    at = { x: 300, y: 300, angle: Math.PI / 2 };
  assert.equal(insideSpell({ x: 300, y: 1000 }, p, at, scene.grid), true);
  assert.equal(insideSpell({ x: 400, y: 1000 }, p, at, scene.grid), false);
  const metric = { ...scene.grid, unit: 'm' as const, scale: 1.524 };
  assert.equal(
    insideSpell({ x: 550, y: 300 }, base('Fireball'), { x: 300, y: 300, angle: 0 }, metric),
    true,
  );
  assert.equal(Math.round(feetDistance({ x: 0, y: 0 }, { x: 100, y: 0 }, metric)), 5);
  assert.ok(spellCells(base('Fireball'), { x: 500, y: 500, angle: 0 }, scene).length > 30);
});
test('large fields only enumerate the visible viewport and remain bounded', () => {
  const p = { ...base('Storm of Vengeance'), size: 10000 },
    cells = spellCells(
      p,
      { x: 500, y: 500, angle: 0 },
      { ...scene, width: 16000, height: 16000 },
      { left: 100, top: 100, right: 500, bottom: 500 },
    );
  assert.equal(cells.length, 16);
});
test('monster breath descriptions use the same cone/line preparation', () => {
  const cone = breathProfile({
    id: 'action-1',
    name: 'Fire Breath',
    description: 'Dexterity Saving Throw: DC 21, each creature in a 60-foot Cone. Fire damage.',
  });
  assert.equal(cone?.shape, 'cone');
  assert.equal(cone?.size, 60);
  const line = breathProfile({
    id: 'action-2',
    name: 'Lightning Breath',
    description: 'Each creature in a 90-foot-long, 5-foot-wide Line. Lightning damage.',
  });
  assert.equal(line?.shape, 'line');
  assert.equal(line?.size, 90);
  assert.equal(line?.visual.family, 'lightning');
  assert.equal(
    breathProfile({ id: 'action-0', name: 'Bite', description: 'Melee Attack: +10 to hit.' }),
    null,
  );
});
test('cast schema rejects forged rules, impossible slots and missing source identity', () => {
  const request = {
    actor_id: randomUUID(),
    scene_id: randomUUID(),
    spell_id: 'spell-bless',
    slot: 1,
    targets: [randomUUID()],
    points: [],
    idempotency_key: randomUUID(),
  };
  assert.equal(spellCastSchema.safeParse(request).success, true);
  assert.equal(spellCastSchema.safeParse({ ...request, profile: { count: 99 } }).success, false);
  assert.equal(spellCastSchema.safeParse({ ...request, slot: 10 }).success, false);
  assert.equal(spellCastSchema.safeParse({ ...request, action_id: 'action-1' }).success, false);
});
test('target explosions, sequential leaps and bestowed breath preserve their specific rules', () => {
  assert.equal(base('Ice Knife').mode, 'targets');
  assert.equal(base('Ice Knife').areaFromTargets, true);
  assert.equal(base('Ice Knife').size, 5);
  assert.equal(base('Phantasmal Force').shape, null);
  assert.equal(base('Chromatic Orb').chainFromLast, true);
  const p = preparedSpell(base("Dragon's Breath"), 3, 1, 2);
  assert.equal(p.visual.family, 'lightning');
  const breath = grantedBreath({ profile: p, spellId: p.id, name: p.name } as any)!;
  assert.equal(breath.size, 15);
  assert.equal(breath.level, 0);
  assert.equal(breath.concentration, false);
  assert.equal(breath.duration, 0);
  assert.equal(breath.visual.family, 'lightning');
  assert.equal(breath.alternatives, undefined);
});
test('Dimension Door requires a destination as well as a caster/companion selection', () => {
  const p = base('Dimension Door'),
    caster = randomUUID();
  assert.equal(p.includeSelf, true);
  assert.equal(validSpellSelection(p, [caster], []), false);
  assert.equal(validSpellSelection(p, [caster], [{ x: 100, y: 100, angle: 0 }]), true);
});
