import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectFootprint, footprintPoint } from '../src/vtt-effect-footprint.js';

test('emisores seguem alpha irregular, preservam contain e são amostrados uma vez por imagem', () => {
  const pixels = new Uint8ClampedArray(64 * 64 * 4);
  for (let y = 12; y < 51; y++)
    for (let x = 9; x < 55; x++) if (x < 23 || y > 38) pixels[(y * 64 + x) * 4 + 3] = 255;
  let reads = 0;
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage() {},
          fillRect() {},
          getImageData() {
            reads++;
            return { data: pixels };
          },
        }),
      }),
    },
  });
  const image = { complete: true, naturalWidth: 200, naturalHeight: 100 } as HTMLImageElement;
  const first = effectFootprint(100, 100, 65, 65, image);
  assert.equal(first.sx / first.sy, 2);
  assert.ok(first.body.length > 20 && first.edge.length > 10);
  for (const p of [...first.body, ...first.edge]) {
    const x = Math.floor((p.x + 0.5) * 64),
      y = Math.floor((p.y + 0.5) * 64);
    assert.equal(pixels[(y * 64 + x) * 4 + 3], 255, 'emitter must lie on the actual sprite');
  }
  const second = effectFootprint(400, 120, 260, 78, image);
  assert.equal(reads, 1, 'resizing does not reread alpha per frame');
  assert.equal(second.body, first.body);
  assert.ok(
    Math.abs((second.sx * 260) / (second.sy * 78) - 2) < 1e-10,
    'world-space sprite aspect stays intact',
  );
  assert.deepEqual(footprintPoint(first, first.body.length), footprintPoint(first, 0));
});

test('imagem não carregada ou canvas bloqueado não impede efeitos', () => {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => ({
        getContext: () => ({
          drawImage() {
            throw Error('tainted canvas');
          },
        }),
      }),
    },
  });
  const image = { complete: true, naturalWidth: 100, naturalHeight: 200 } as HTMLImageElement;
  const fallback = effectFootprint(120, 120, 78, 78, image);
  assert.equal(fallback.sx / fallback.sy, 0.5);
  assert.ok(fallback.body.length && fallback.edge.length);
  assert.ok(effectFootprint(90, 90, 58.5, 58.5).body.length);
});
