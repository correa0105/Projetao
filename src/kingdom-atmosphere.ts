// Moving mist is sampled in map coordinates so it stays attached to the border.
import {
  KINGDOM_HEIGHT,
  KINGDOM_WIDTH,
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

export function kingdomEdgeMistDepth(width: number, height: number) {
  return Math.min(KINGDOM_EDGE_MIST_MAX_PX, width * 0.16, height * 0.16);
}

export function createKingdomEdgeMist() {
  const fogRaster = document.createElement('canvas');
  const fogContext = fogRaster.getContext('2d')!;
  let fogPixels: ImageData | null = null;
  return {
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
