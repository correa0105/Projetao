import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAtmosphereQueue } from '../src/vtt-atmosphere-queue';
import { atmosphereSchema, type MapAtmosphere } from '../shared/vtt-atmosphere';
const tick = () => new Promise((resolve) => setImmediate(resolve));
test('seleção é imediata, gravações serializam e escolhas intermediárias cedem à última', async () => {
  const sent: MapAtmosphere[] = [],
    previews: (MapAtmosphere | null)[] = [],
    states: boolean[] = [],
    finish: (() => void)[] = [];
  const q = createAtmosphereQueue({
    send: async (v) => {
      sent.push(v);
      await new Promise<void>((r) => finish.push(r));
    },
    preview: (v) => previews.push(v),
    status: (v) => states.push(v),
  });
  const a = atmosphereSchema.parse({ enabled: true, weather: 'rain' }),
    b = { ...a, weather: 'snow' as const },
    c = { ...a, weather: 'fog' as const };
  q.select(a);
  q.select(b);
  q.select(c);
  assert.deepEqual(sent, [a]);
  assert.deepEqual(previews, [a, b, c]);
  finish.shift()!();
  await tick();
  assert.deepEqual(sent, [a, c]);
  assert.equal(previews.at(-1), c);
  finish.shift()!();
  await tick();
  assert.equal(previews.at(-1), null);
  assert.equal(states.at(-1), false);
  q.dispose();
});
test('falha retorna ao estado confirmado e troca de cena cancela escolhas pendentes', async () => {
  const previews: (MapAtmosphere | null)[] = [],
    errors: string[] = [],
    sent: MapAtmosphere[] = [],
    finish: ((v?: unknown) => void)[] = [];
  const a = atmosphereSchema.parse({ enabled: true, weather: 'fog' });
  const q = createAtmosphereQueue({
    send: async (v) => {
      sent.push(v);
      await new Promise((_r, reject) => finish.push(reject));
    },
    preview: (v) => previews.push(v),
    status: (_p, e) => {
      if (e) errors.push(e);
    },
  });
  q.select(a);
  finish.shift()!(Error('Sem conexão'));
  await tick();
  assert.equal(previews.at(-1), null);
  assert.deepEqual(errors, ['Sem conexão']);
  q.select(a);
  q.select({ ...a, weather: 'snow' });
  q.dispose();
  finish.shift()!(Error('Cena mudou'));
  await tick();
  assert.equal(sent.length, 2);
  assert.equal(errors.length, 1);
});
