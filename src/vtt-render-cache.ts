import type { VttToken } from '../shared/vtt';

type Cache = {
  buffers: Map<string, HTMLCanvasElement>;
  lightingKey: string;
  fogKey: string;
  allocations: number;
  lightingBuilds: number;
};
const caches = new WeakMap<HTMLCanvasElement, Cache>();
export function renderWorkCache(target: HTMLCanvasElement): Cache {
  let cache = caches.get(target);
  if (!cache) {
    cache = { buffers: new Map(), lightingKey: '', fogKey: '', allocations: 0, lightingBuilds: 0 };
    caches.set(target, cache);
  }
  return cache;
}
export function renderBuffer(target: HTMLCanvasElement, name: string, clear = true) {
  const cache = renderWorkCache(target);
  let buffer = cache.buffers.get(name);
  if (!buffer) {
    buffer = document.createElement('canvas');
    cache.buffers.set(name, buffer);
    cache.allocations++;
  }
  if (buffer.width !== target.width || buffer.height !== target.height) {
    buffer.width = target.width;
    buffer.height = target.height;
  } else if (clear) {
    const context = buffer.getContext('2d')!;
    context.reset();
  }
  return buffer;
}
export function renderCacheStats(target: HTMLCanvasElement) {
  const cache = renderWorkCache(target);
  return { allocations: cache.allocations, lightingBuilds: cache.lightingBuilds,
    bytes: [...cache.buffers.values()].reduce((n, b) => n + b.width * b.height * 4, 0) };
}

// Keep the full native sprite, name, badges and generous effect envelope. Lights
// and vision still use every scene token, even when its sprite is offscreen.
export function tokenOnScreen(token: VttToken, view: {left:number;top:number;right:number;bottom:number}, zoom: number) {
  const scale = Math.max(1, ...token.effects.map(e => e.scale));
  const radius = Math.hypot(token.width, token.height) *
    (token.effects.length || token.animatedAsset || token.deathAt ? 8 * scale : .5) + 160 / zoom;
  return token.x + radius >= view.left && token.x - radius <= view.right &&
    token.y + radius >= view.top && token.y - radius <= view.bottom;
}
