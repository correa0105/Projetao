// Canvas 2D counterpart of the moving FBM banks in world-clouds.ts.
// Both layers use the terrain's map transform, never the viewport as their frame.
import {
  KINGDOM_HEIGHT,
  KINGDOM_TILT,
  KINGDOM_WIDTH,
  projectKingdom,
  unprojectKingdom,
  type KingdomView,
  type KingdomViewport,
} from './kingdom-scene';

export const KINGDOM_EDGE_MIST_MAX_PX = 96;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (start: number, end: number, value: number) => {
  const t = clamp01((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};
const fract = (value: number) => value - Math.floor(value);
const hash = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);

function noise(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = smoothstep(0, 1, fract(x)),
    fy = smoothstep(0, 1, fract(y));
  const top = hash(ix, iy) * (1 - fx) + hash(ix + 1, iy) * fx;
  const bottom = hash(ix, iy + 1) * (1 - fx) + hash(ix + 1, iy + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}

function fbm(x: number, y: number) {
  let sum = 0,
    amplitude = 0.55;
  for (let i = 0; i < 5; i++) {
    sum += noise(x, y) * amplitude;
    [x, y] = [1.6 * x + 1.2 * y + 7.3, -1.2 * x + 1.6 * y + 7.3];
    amplitude *= 0.49;
  }
  return sum;
}

function makeTexture(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width,
        v = y / height;
      const px = u * 6,
        py = v * 4;
      const distortionX = fbm(px * 0.47, py * 0.47);
      const distortionY = fbm(px * 0.47 + 9.1, py * 0.47 + 9.1);
      const density = fbm(px + distortionX * 2.4, py + distortionY * 2.4);
      const shade = fbm(px - 0.24, py + 0.31);
      const shadeMix = smoothstep(0.29, 0.7, shade);
      const silhouette = Math.max(
        0,
        1 - smoothstep(0.32, 1, Math.hypot((u - 0.5) * 2, (v - 0.5) * 2)),
      );
      const densityAlpha = smoothstep(0.21, 0.65, density);
      const alpha = silhouette * (0.13 + densityAlpha * 0.52);
      const index = (y * width + x) * 4;
      image.data[index] = Math.round(173 + shadeMix * 73);
      image.data[index + 1] = Math.round(180 + shadeMix * 69);
      image.data[index + 2] = Math.round(185 + shadeMix * 66);
      image.data[index + 3] = Math.round(alpha * 255);
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

export function kingdomEdgeMistDepth(width: number, height: number) {
  return Math.min(KINGDOM_EDGE_MIST_MAX_PX, width * 0.16, height * 0.16);
}

export function createKingdomAtmosphere() {
  const bank = makeTexture(320, 256);
  const fogRaster = document.createElement('canvas');
  const fogContext = fogRaster.getContext('2d')!;
  let fogPixels: ImageData | null = null;
  const banks = [
    [0.02, 0.12, 0.22, 0.17, 0.25],
    [0.51, 0.03, 0.24, 0.19, 0.31],
    [0.29, 0.34, 0.19, 0.17, 0.19],
    [0.72, 0.4, 0.21, 0.16, 0.28],
    [0.06, 0.69, 0.23, 0.19, 0.23],
    [0.55, 0.79, 0.22, 0.18, 0.27],
  ] as const;
  function applyMapTransform(
    context: CanvasRenderingContext2D,
    view: KingdomView,
    viewport: KingdomViewport,
  ) {
    const scale = viewport.scale * view.zoom;
    const cos = Math.cos(view.angle),
      sin = Math.sin(view.angle);
    const origin = projectKingdom(0, 0, view, viewport);
    context.transform(
      cos * scale,
      sin * scale * KINGDOM_TILT,
      -sin * scale,
      cos * scale * KINGDOM_TILT,
      origin.x,
      origin.y,
    );
  }
  function onMap(context: CanvasRenderingContext2D, view: KingdomView, viewport: KingdomViewport) {
    applyMapTransform(context, view, viewport);
    const left = -KINGDOM_WIDTH / 2,
      top = -KINGDOM_HEIGHT / 2;
    context.beginPath();
    context.rect(left, top, KINGDOM_WIDTH, KINGDOM_HEIGHT);
    context.clip();
  }
  return {
    paintClouds(
      context: CanvasRenderingContext2D,
      view: KingdomView,
      viewport: KingdomViewport,
      time: number,
    ) {
      context.clearRect(0, 0, viewport.width, viewport.height);
      context.save();
      onMap(context, view, viewport);
      const left = -KINGDOM_WIDTH / 2,
        top = -KINGDOM_HEIGHT / 2;
      for (const [u, v, wu, hv, speed] of banks) {
        const bankWidth = KINGDOM_WIDTH * wu;
        const bankHeight = KINGDOM_HEIGHT * hv;
        const travel = KINGDOM_WIDTH + bankWidth;
        const x =
          left + ((u * KINGDOM_WIDTH + time * speed * 520 + bankWidth) % travel) - bankWidth;
        const y = top + v * KINGDOM_HEIGHT + Math.sin(time * 0.1 + u * 8) * 45;
        context.drawImage(bank, x, y, bankWidth, bankHeight);
      }
      context.restore();
    },
    paintEdgeMist(
      context: CanvasRenderingContext2D,
      view: KingdomView,
      viewport: KingdomViewport,
      time: number,
    ) {
      const width = Math.max(1, Math.ceil(viewport.width / 3));
      const height = Math.max(1, Math.ceil(viewport.height / 3));
      if (!fogPixels || fogRaster.width !== width || fogRaster.height !== height) {
        fogRaster.width = width;
        fogRaster.height = height;
        fogPixels = fogContext.createImageData(width, height);
      }
      const pixels = fogPixels.data;
      const topLeft = unprojectKingdom(0, 0, view, viewport);
      const topRight = unprojectKingdom(viewport.width, 0, view, viewport);
      const bottomLeft = unprojectKingdom(0, viewport.height, view, viewport);
      const stepXX = (topRight.x - topLeft.x) / width;
      const stepXY = (topRight.y - topLeft.y) / width;
      const stepYX = (bottomLeft.x - topLeft.x) / height;
      const stepYY = (bottomLeft.y - topLeft.y) / height;
      const depth =
        kingdomEdgeMistDepth(viewport.width, viewport.height) / (viewport.scale * view.zoom);
      // A single signed-distance field joins opaque exterior fog to the map.
      // Noise changes the inward reach continuously along each physical edge.
      for (let row = 0; row < height; row++) {
        let worldX = topLeft.x + (row + 0.5) * stepYX + stepXX * 0.5;
        let worldY = topLeft.y + (row + 0.5) * stepYY + stepXY * 0.5;
        for (let column = 0; column < width; column++) {
          const edgeX = KINGDOM_WIDTH / 2 - Math.abs(worldX);
          const edgeY = KINGDOM_HEIGHT / 2 - Math.abs(worldY);
          const inside = Math.min(edgeX, edgeY);
          const index = (row * width + column) * 4;
          let alpha = 0;
          let tone = 225;
          if (inside < depth) {
            // Two drifting scales keep the exterior textured while the wisps
            // crossing the edge remain part of the same continuous field.
            const broadHaze = fbm(worldX / 720 + time * 0.11, worldY / 720 - time * 0.025);
            const fineHaze = noise(worldX / 230 - time * 0.23, worldY / 230 + time * 0.045);
            const texture = broadHaze * 0.7 + fineHaze * 0.3;
            tone = Math.round(202 + texture * 67);
            if (inside <= 0) alpha = 1;
            else {
              const along = edgeX < edgeY ? worldY : worldX;
              const side = edgeX < edgeY ? (worldX < 0 ? 0 : 1) : worldY < 0 ? 2 : 3;
              const broad = fbm(along / 950 + side * 7.1 + time * 0.12, side * 11.3);
              const detail = noise(along / 290 - time * 0.25, side * 19.7 + 3.4);
              const contour = smoothstep(0.29, 0.7, broad * 0.76 + detail * 0.24);
              const reach = depth * (0.42 + contour * 0.58);
              const progress = clamp01(inside / reach);
              alpha = (1 - progress) ** 1.9;
              const wisp = smoothstep(
                0.27,
                0.68,
                fbm(along / 540 + side * 4.7 + time * 0.16, inside / 850 - time * 0.04),
              );
              alpha *= 1 - 0.48 * (1 - wisp) * Math.sin(Math.PI * progress);
            }
          }
          pixels[index] = tone;
          pixels[index + 1] = Math.min(255, tone + 3);
          pixels[index + 2] = Math.min(255, tone + 4);
          pixels[index + 3] = Math.round(alpha * 255);
          worldX += stepXX;
          worldY += stepXY;
        }
      }
      fogContext.putImageData(fogPixels, 0, 0);
      context.clearRect(0, 0, viewport.width, viewport.height);
      context.imageSmoothingEnabled = true;
      context.drawImage(fogRaster, 0, 0, viewport.width, viewport.height);
    },
  };
}
