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
import {
  effectFrame,
  effectGeometry,
  renderEffect,
  drawTokenEffects,
} from '../src/vtt-effects-canvas.js';
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
// This unit harness checks geometry and state isolation without browser media.
// Visible atlas pixels are checked by the real-browser VFX review harness.
Object.defineProperty(globalThis, 'Image', {
  configurable: true,
  value: class {
    src = '';
    complete = false;
    naturalWidth = 0;
    naturalHeight = 0;
    decode() {
      return Promise.reject(new Error('No media in unit canvas'));
    }
  },
});
Object.defineProperty(globalThis, 'document', {
  value: { createElement: () => ({ getContext: () => textureContext.c, width: 0, height: 0 }) },
  configurable: true,
});
const id = '55555555-5555-4555-8555-555555555555';
const base = { id, color: '#ad7654', scale: 1, duration: 5, at: 1000 };

test('personagens, monstros e imagens customizadas usam a mesma versão de todos os efeitos', () => {
  const oldNow = Date.now;
  const oldMedia = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
  Date.now = () => 2800;
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false }),
  });
  try {
    for (const e of effectLibrary.filter((e) => e.kind !== 'death'))
      for (const pass of ['behind', 'front'] as const) {
        const traces = [
          '/api/vtt/premium-art/monster-knight',
          '/api/vtt/assets/11111111-1111-4111-8111-111111111111/top-down',
          '/api/characters/profile.png',
          'https://custom.test/token.webp',
        ].map((image) => {
          const state = context();
          drawTokenEffects(
            state.c,
            {
              id,
              image,
              layer: 'tokens',
              width: 90,
              height: 150,
              flipX: false,
              flipY: false,
              effects: [{ ...base, kind: e.kind, color: e.color }],
            } as VttToken,
            pass,
          );
          return { draws: state.draws, transforms: state.transforms, depth: state.depth };
        });
        for (const trace of traces)
          assert.deepEqual(
            trace,
            traces[0],
            e.kind + ' rendering must not depend on the image URL',
          );
      }
    const state = context();
    drawTokenEffects(state.c, {
      id,
      image: '/map.png',
      layer: 'map',
      width: 90,
      height: 150,
      effects: [{ ...base, kind: 'frost' }],
    } as VttToken);
    assert.equal(state.draws, 0);
  } finally {
    Date.now = oldNow;
    if (oldMedia) Object.defineProperty(globalThis, 'matchMedia', oldMedia);
    else Reflect.deleteProperty(globalThis, 'matchMedia');
  }
});

test('prismas preservam a forma; descargas variam sem tremor dentro do clarão', () => {
  for (const size of [5, 10, 20, 30]) {
    const v = crystalOutline(size);
    assert.equal(v[0][1], v[1][1]);
    assert.equal(v[3][1], v[4][1]);
    assert.ok((v[3][1] - v[1][1]) / (v[2][0] - v[0][0]) > 0.4);
  }
  const footprint = effectFootprint(100, 180, 65, 117),
    random = seededRandom('branches');
  for (const sparks of [true, false]) {
    const counts = new Set<number>(),
      origins = new Set<string>(),
      lengths: number[] = [];
    let stable = 0;
    for (let i = 0; i < 240; i++) {
      const phase = i / 30,
        bursts = electricBursts(footprint, phase, random, sparks),
        next = electricBursts(footprint, phase + 0.001, random, sparks);
      counts.add(bursts.length);
      assert(bursts.length <= 24);
      for (const b of bursts) {
        assert(Number.isFinite(b.q.x + b.q.y));
        assert(b.strength >= 0 && b.strength <= 1);
        origins.add(b.p.x + ',' + b.p.y);
        lengths.push(Math.hypot(b.q.x - b.p.x, b.q.y - b.p.y));
        const same = next.find((n) => n.seed === b.seed);
        if (same) {
          assert.deepEqual(same.p, b.p);
          assert.deepEqual(same.q, b.q);
          stable++;
        }
      }
    }
    assert(counts.size > 4, 'discharge density remains fixed');
    assert(origins.size > 15, 'origins remain pinned');
    assert(Math.max(...lengths) > Math.min(...lengths) * 2, 'uniform reach');
    assert(stable > 100, 'no stable discharge samples');
    assert.notDeepEqual(
      electricBursts(footprint, 1.25, random, sparks),
      electricBursts(footprint, 1.25, seededRandom('other token'), sparks),
    );
  }
});

test('biblioteca mantém IDs legados e 147 modelos com metadata validada', () => {
  assert.deepEqual(effectKinds.slice(0, 6), ['death', 'fire', 'frost', 'poison', 'heal', 'sparks']);
  assert.equal(effectKinds.length, 147);
  assert.equal(new Set(effectKinds).size, 147);
  assert.equal(effectLibrary.length, 147);
  assert.equal(effectNames.length, 147);
  assert.equal(effectColors.length, 147);
  for (const [i, e] of effectLibrary.entries()) {
    assert.equal(e.kind, effectKinds[i]);
    assert.equal(e.name, effectNames[i]);
    assert.equal(e.color, effectColors[i]);
    assert.ok(e.description.trim().length > 0, e.kind + ' has a description');
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
