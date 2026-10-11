import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newScene, sceneSchema } from '../shared/vtt';
import { atmosphereSchema, weatherModes, weatherPresets, dayModes } from '../shared/vtt-atmosphere';
import { atmosphereAnimated, createDayTransition } from '../src/vtt-atmosphere';
test('cenas antigas mantêm aparência; catálogo e limites do clima são validados', () => {
  const scene = newScene('00000000-0000-4000-8000-000000000001', 'Mapa');
  assert.deepEqual(scene.atmosphere, atmosphereSchema.parse({}));
  const legacy = { ...scene };
  delete (legacy as Partial<typeof scene>).atmosphere;
  assert.equal(sceneSchema.parse(legacy).atmosphere.enabled, false);
  assert.deepEqual(
    weatherPresets.map((p) => p[0]),
    [...weatherModes],
  );
  assert.equal(new Set(weatherModes).size, weatherModes.length);
  for (const day of dayModes)
    for (const weather of weatherModes)
      assert(atmosphereSchema.safeParse({ day, weather }).success);
  for (const input of [
    { intensity: 2 },
    { intensity: NaN },
    { wind: 361 },
    { speed: 0 },
    { weather: 'unknown' },
    { day: 'moon' },
    { private: true },
  ])
    assert(!atmosphereSchema.safeParse(input).success);
});
test('clima desativado ou intensidade zero não mantém animação ativa', () => {
  const a = atmosphereSchema.parse({ enabled: true, weather: 'fog' });
  assert(atmosphereAnimated(a));
  assert(!atmosphereAnimated({ ...a, enabled: false }));
  assert(!atmosphereAnimated({ ...a, intensity: 0 }));
  assert(!atmosphereAnimated({ ...a, weather: 'clear', day: 'night' }));
  assert(!atmosphereAnimated({ ...a, weather: 'clear', day: 'afternoon' }));
});
test('horário interpola sem salto, pode ser interrompido e respeita movimento reduzido', () => {
  const light = [255, 255, 255, 0],
    night = [60, 80, 140, 0.7],
    dusk = [180, 115, 120, 0.4];
  const transition = createDayTransition(light);
  assert.deepEqual(transition.sample(night, 100, false), light);
  const middle = transition.sample(night, 1000, false);
  assert(middle[0] > night[0] && middle[0] < light[0]);
  assert(transition.active(1000));
  assert.deepEqual(transition.sample(dusk, 1000, false), middle);
  assert.deepEqual(transition.sample(dusk, 2800, false), dusk);
  assert(!transition.active(2800));
  assert.deepEqual(transition.sample(night, 2900, true), night);
  assert(!transition.active(2900));
});
