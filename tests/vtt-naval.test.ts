import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { newScene, newToken, sceneSchema, tokenSchema } from '../shared/vtt';
import {
  navalAnimated,
  navalMotion,
  rowingPose,
  vehicleMotionSchema,
  oceanSchema,
  oceanAnimationEnabled,
} from '../shared/vtt-naval';
test('ocean playback follows master pause and local preferences with explicit reduced-motion opt-in', () => {
  const ocean = oceanSchema.parse({});
  assert.equal(oceanAnimationEnabled(ocean, true, 'system', false), true);
  assert.equal(oceanAnimationEnabled(ocean, true, 'system', true), false);
  assert.equal(oceanAnimationEnabled(ocean, true, 'on', true), true);
  assert.equal(oceanAnimationEnabled(ocean, true, 'off', false), false);
  assert.equal(oceanAnimationEnabled(ocean, false, 'on', false), false);
  assert.equal(oceanAnimationEnabled({ ...ocean, animated: false }, true, 'on', false), false);
  assert.equal(oceanAnimationEnabled(undefined, true, 'on', false), false);
});
test('ocean and ship options remain optional for saved rooms and accept independent switches', () => {
  const scene = newScene(randomUUID()),
    t = newToken(randomUUID(), scene);
  assert.equal(scene.ocean, undefined);
  assert.equal(t.vehicleMotion, undefined);
  assert.equal(navalAnimated(t), false);
  assert.deepEqual(navalMotion(t), vehicleMotionSchema.parse({}));
  scene.ocean = oceanSchema.parse({ animated: false, seaVolume: 0.4, windVolume: 0 });
  t.vehicle = { characterId: randomUUID(), itemId: 'galley', copy: 0 };
  t.vehicleMotion = vehicleMotionSchema.parse({
    sail: 'inflated',
    sailsAnimated: false,
    oarsAnimated: true,
    sailAngle: 90,
  });
  scene.tokens = [t];
  assert.equal(navalAnimated(t), true);
  assert.deepEqual(sceneSchema.parse(scene).ocean, scene.ocean);
  t.vehicleMotion.oarsAnimated = false;
  assert.equal(navalAnimated(t), false);
  t.vehicleMotion.sailsAnimated = true;
  assert.equal(navalAnimated(t), true);
  t.vehicleMotion.sail = 'furled';
  assert.equal(navalAnimated(t), false);
});
test('invalid volumes, angles, rhythms and unknown keys cannot enter the scene', () => {
  for (const patch of [
    { speed: 0 },
    { speed: Infinity },
    { sailAngle: 181 },
    { sail: 'flat' },
    { extra: true },
  ])
    assert.equal(vehicleMotionSchema.safeParse(patch).success, false);
  for (const patch of [
    { seaVolume: -1 },
    { windVolume: 2 },
    { speed: Infinity },
    { unknown: true },
  ])
    assert.equal(oceanSchema.safeParse(patch).success, false);
  const t = newToken(randomUUID(), newScene(randomUUID()));
  assert.equal(tokenSchema.safeParse({ ...t, vehicleMotion: { sailAngle: NaN } }).success, false);
});
test('paired oars sweep in mirror symmetry and return without jumping after a cycle', () => {
  for (const time of [0, 0.2, 0.7, 1.2]) {
    const left = rowingPose(time, 1, -1),
      right = rowingPose(time, 1, 1);
    assert.equal(left.angle === 0 ? 0 : left.angle, -right.angle === 0 ? 0 : -right.angle);
    assert.equal(left.lift, right.lift);
    assert.ok(left.lift >= 0.87 && left.lift <= 1);
  }
  const period = 2 / 0.9;
  assert.ok(Math.abs(rowingPose(period, 1, 1).angle - rowingPose(0, 1, 1).angle) < 1e-10);
});
test('original naval PNGs retain alpha and both sail clews sit below the billowing centre', async () => {
  const manifest = JSON.parse(await readFile('data/vtt/naval-art-20261026.json', 'utf8'));
  assert.equal(manifest.assets.length, 3);
  for (const a of manifest.assets) {
    const bytes = await readFile('public' + a.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), a.sha256);
    assert.equal(bytes[25], 6);
    if (a.file.startsWith('rowboat')) continue;
    const { data, info } = await sharp(bytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const top = (x: number) => {
      for (let y = 540; y < 1020; y++) if (data[(y * info.width + x) * 4 + 3] > 180) return y;
      return 1020;
    };
    assert.ok(top(50) > top(512) + 200, a.file + ' left corner');
    assert.ok(top(974) > top(512) + 200, a.file + ' right corner');
  }
});
