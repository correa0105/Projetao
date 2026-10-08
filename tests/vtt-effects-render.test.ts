import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  effectColors,
  effectKinds,
  effectLibrary,
  effectNames,
  effectPresetSchema,
  tokenEffectSchema,
} from '../shared/vtt-effects.js';
import { effectFrame, effectGeometry, renderEffect } from '../src/vtt-effects-canvas.js';
import {
  clearEffectTextureCache,
  effectTextureCacheSize,
  EFFECT_TEXTURE_LIMIT,
  plume,
} from '../src/vtt-effects-primitives.js';
import { drawDeath } from '../src/vtt-death.js';
import type { VttToken } from '../shared/vtt.js';
import { crystalOutline, electricBursts } from '../src/vtt-effects-overhead-magic.js';
import { effectFootprint } from '../src/vtt-effect-footprint.js';
import { seededRandom } from '../src/vtt-effects-primitives.js';

function context() {
  let depth = 0,
    draws = 0;
  const transforms: number[][] = [],
    stack: Record<string, unknown>[] = [],
    props: Record<string, unknown> = {
      globalAlpha: 0.6,
      globalCompositeOperation: 'source-over',
      lineWidth: 2,
      fillStyle: '#123456',
      strokeStyle: '#654321',
    };
  const methods: Record<string, unknown> = {
    save: () => {
      depth++;
      stack.push({ ...props });
    },
    restore: () => {
      assert.ok(depth > 0);
      depth--;
      for (const key of Object.keys(props)) delete props[key];
      Object.assign(props, stack.pop());
    },
    scale: (x: number, y: number) => {
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
      transforms.push([x, y]);
    },
    createRadialGradient: (...args: number[]) => {
      assert.ok(args.every(Number.isFinite));
      return {
        addColorStop: (stop: number, color: string) => {
          assert.ok(stop >= 0 && stop <= 1);
          assert.match(color, /^#[\da-f]{6}([\da-f]{2})?$/i);
        },
      };
    },
    createLinearGradient: (...args: number[]) => {
      assert.ok(args.every(Number.isFinite));
      return {
        addColorStop: (stop: number, color: string) => {
          assert.ok(stop >= 0 && stop <= 1);
          assert.match(color, /^#[\da-f]{6}([\da-f]{2})?$/i);
        },
      };
    },
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: () => {},
  };
  const c = new Proxy(props, {
    get: (target, key: string) =>
      key in methods
        ? methods[key]
        : key in target
          ? target[key]
          : (...args: unknown[]) => {
              for (const arg of args)
                if (typeof arg === 'number')
                  assert.ok(Number.isFinite(arg), 'no invalid drawing geometry');
              if (['fill', 'stroke', 'drawImage', 'fillRect'].includes(key)) draws++;
            },
    set: (target, key: string, value) => {
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return {
    c,
    props,
    transforms,
    get depth() {
      return depth;
    },
    get draws() {
      return draws;
    },
  };
}
const textureContext = context();
Object.defineProperty(globalThis, 'document', {
  value: { createElement: () => ({ getContext: () => textureContext.c, width: 0, height: 0 }) },
  configurable: true,
});
const id = '55555555-5555-4555-8555-555555555555';
const base = { id, color: '#ad7654', scale: 1, duration: 5, at: 1000 };
test('prismas mantêm paredes largas e proporção em 0,5–3; eletricidade usa três fontes simultâneas', () => {
  for (const size of [5, 10, 20, 30]) {
    const v = crystalOutline(size);
    assert.equal(v[0][1], v[1][1]);
    assert.equal(v[3][1], v[4][1]);
    assert.ok((v[3][1] - v[1][1]) / (v[2][0] - v[0][0]) > 0.4);
    assert.ok((v[2][0] - v[1][0]) / (v[2][0] - v[0][0]) < 0.25, 'only cap tapers');
  }
  for (const sparks of [true, false])
    for (const phase of [0, 0.2, 0.6, 1.01, 9.2]) {
      const bursts = electricBursts(
        effectFootprint(100, 180, 65, 117),
        phase,
        seededRandom('branches'),
        sparks,
      );
      assert.equal(bursts.length, 9);
      assert.equal(new Set(bursts.map((b) => b.p.x + ',' + b.p.y)).size, 3);
      assert.ok(bursts.every((b) => Math.hypot(b.p.x, b.p.y) > 15 && b.strength >= 0.2));
      assert.equal(new Set(bursts.map((b) => b.q.x + ',' + b.q.y)).size, 9);
    }
});

test('biblioteca mantém IDs legados e 36 modelos com metadata validada', () => {
  assert.deepEqual(effectKinds.slice(0, 6), ['death', 'fire', 'frost', 'poison', 'heal', 'sparks']);
  assert.equal(effectKinds.length, 36);
  assert.equal(new Set(effectKinds).size, 36);
  assert.equal(effectLibrary.length, 36);
  assert.equal(effectNames.length, 36);
  assert.equal(effectColors.length, 36);
  for (const [i, e] of effectLibrary.entries()) {
    assert.equal(e.kind, effectKinds[i]);
    assert.equal(e.name, effectNames[i]);
    assert.equal(e.color, effectColors[i]);
    assert.ok(e.description.length > 40);
    const { at: _at, ...appearance } = base;
    effectPresetSchema.parse({ ...appearance, name: e.name, kind: e.kind, color: e.color });
  }
});
test('três tamanhos e formatos seguem geometria do token e restauram o contexto em ambos passes', () => {
  for (const [width, height, scale] of [
    [24, 24, 0.5],
    [90, 150, 1],
    [320, 170, 3],
  ]) {
    const geometry = effectGeometry(width, height, scale)!;
    assert.equal(geometry.rx / geometry.ry, width / height);
    for (const overhead of [false, true])
      for (const e of effectLibrary)
        for (const pass of ['behind', 'front'] as const) {
          const state = context(),
            before = { ...state.props };
          if (e.kind === 'death')
            drawDeath(state.c, { id, layer: 'tokens', width, height, deathAt: 1000 } as VttToken, {
              now: 2800,
              reducedMotion: false,
            });
          else {
            assert.equal(
              renderEffect(
                state.c,
                { ...base, kind: e.kind, color: e.color, scale },
                width,
                height,
                {
                  now: 2800,
                  reducedMotion: false,
                  pass,
                  overhead,
                  flipX: true,
                  flipY: true,
                },
              ),
              true,
            );
            assert.deepEqual(state.transforms[0], [geometry.rx / 100, geometry.ry / 100]);
          }
          assert.ok(state.draws > 0, e.kind + ' must have visible layers');
          assert.equal(state.depth, 0, e.kind + ' save/restore balance');
          assert.deepEqual(
            state.props,
            before,
            e.kind + ' must not leak blend/opacity/transform styles',
          );
        }
  }
});
test('expiração não desenha, duração infinita permanece, movimento reduzido congela a animação', () => {
  const effect = tokenEffectSchema.parse({ ...base, kind: 'fire' });
  assert.equal(effectFrame(effect, 999, false), null);
  assert.equal(effectFrame(effect, 6000, false), null);
  assert.deepEqual(effectFrame(effect, 2000, true), effectFrame(effect, 4000, true));
  assert.notEqual(effectFrame(effect, 2000, false)!.t, effectFrame(effect, 4000, false)!.t);
  const state = context();
  assert.equal(renderEffect(state.c, effect, 90, 90, { now: 6000, reducedMotion: false }), false);
  assert.equal(state.draws, 0);
  assert.equal(state.depth, 0);
  assert.ok(effectFrame({ ...effect, duration: 0 }, 1_000_000, false));
  assert.equal(effectGeometry(0, 90, 1), null);
  assert.equal(effectGeometry(90, NaN, 1), null);
});
test('cache de materiais é limitado e permite liberar suas superfícies', () => {
  clearEffectTextureCache();
  const first = plume('#ad7654', 'fire');
  assert.equal(plume('#ad7654', 'fire'), first);
  for (let i = 0; i < 30; i++) plume('#' + (i * 7219).toString(16).padStart(6, '0'), 'smoke');
  assert.equal(effectTextureCacheSize(), EFFECT_TEXTURE_LIMIT);
  clearEffectTextureCache();
  assert.equal(effectTextureCacheSize(), 0);
});
