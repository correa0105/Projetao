import * as THREE from 'three';
import { createWorldOcean } from './world-ocean';
import {
  landTerritory,
  seaTerritory,
  WORLD_TERRITORIES,
  TERRITORY_GLSL,
} from './world-territories';

export const WORLD_WIDTH = 36;
export const WORLD_HEIGHT = 20.25;

type Point = readonly [number, number];
type Ridge = { path: Point[]; width: number; height: number };
type River = { path: Point[]; width: number };
type Segment = {
  ax: number;
  ay: number;
  dx: number;
  dy: number;
  lengthSquared: number;
  length: number;
  offset: number;
};
const NX = 960;
const NY = 540;
const STRIDE = NX + 1;
const GRID_COUNT = STRIDE * (NY + 1);
const CELL = WORLD_WIDTH / NX;
const clamp = THREE.MathUtils.clamp;
const smooth = THREE.MathUtils.smoothstep;

// Geographic paths are authored independently from the painted shading. The
// input illustration supplies only coastlines and coarse biome categories.
const RIDGES: Ridge[] = [
  {
    path: [
      [0.292, 0.038],
      [0.321, 0.116],
      [0.345, 0.231],
      [0.365, 0.32],
      [0.392, 0.382],
      [0.376, 0.429],
    ],
    width: 0.72,
    height: 1.42,
  },
  {
    path: [
      [0.135, 0.208],
      [0.171, 0.156],
      [0.208, 0.117],
      [0.245, 0.07],
    ],
    width: 0.43,
    height: 0.98,
  },
  {
    path: [
      [0.151, 0.338],
      [0.192, 0.39],
      [0.234, 0.452],
      [0.286, 0.456],
      [0.326, 0.419],
    ],
    width: 0.51,
    height: 0.94,
  },
  {
    path: [
      [0.217, 0.554],
      [0.263, 0.59],
      [0.324, 0.635],
      [0.369, 0.625],
      [0.408, 0.584],
    ],
    width: 0.51,
    height: 0.85,
  },
  {
    path: [
      [0.412, 0.123],
      [0.451, 0.142],
      [0.488, 0.178],
    ],
    width: 0.5,
    height: 1.0,
  },
  {
    path: [
      [0.603, 0.211],
      [0.646, 0.165],
      [0.686, 0.106],
      [0.729, 0.151],
      [0.758, 0.203],
    ],
    width: 0.82,
    height: 1.45,
  },
  {
    path: [
      [0.505, 0.348],
      [0.529, 0.411],
      [0.572, 0.482],
      [0.637, 0.521],
      [0.699, 0.506],
      [0.725, 0.456],
    ],
    width: 0.7,
    height: 1.17,
  },
  {
    path: [
      [0.725, 0.375],
      [0.768, 0.323],
      [0.804, 0.267],
      [0.848, 0.277],
      [0.889, 0.353],
      [0.906, 0.477],
    ],
    width: 0.58,
    height: 1.15,
  },
  {
    path: [
      [0.84, 0.565],
      [0.819, 0.636],
      [0.788, 0.716],
      [0.757, 0.801],
    ],
    width: 0.63,
    height: 1.18,
  },
];

const RIVERS: River[] = [
  {
    path: [
      [0.335, 0.222],
      [0.32, 0.237],
      [0.307, 0.267],
      [0.301, 0.298],
      [0.316, 0.329],
      [0.312, 0.363],
      [0.333, 0.383],
      [0.354, 0.407],
      [0.369, 0.452],
    ],
    width: 0.067,
  },
  {
    path: [
      [0.365, 0.367],
      [0.342, 0.393],
      [0.323, 0.421],
      [0.316, 0.469],
      [0.306, 0.496],
      [0.321, 0.536],
      [0.355, 0.551],
      [0.389, 0.541],
      [0.421, 0.531],
    ],
    width: 0.073,
  },
  {
    path: [
      [0.257, 0.467],
      [0.271, 0.49],
      [0.284, 0.501],
      [0.294, 0.525],
      [0.321, 0.536],
    ],
    width: 0.043,
  },
  {
    path: [
      [0.355, 0.599],
      [0.361, 0.58],
      [0.354, 0.551],
    ],
    width: 0.037,
  },
  {
    path: [
      [0.663, 0.159],
      [0.67, 0.191],
      [0.689, 0.212],
      [0.689, 0.239],
      [0.71, 0.263],
      [0.717, 0.289],
    ],
    width: 0.06,
  },
  {
    path: [
      [0.731, 0.184],
      [0.717, 0.204],
      [0.704, 0.207],
      [0.689, 0.212],
    ],
    width: 0.035,
  },
  {
    path: [
      [0.606, 0.496],
      [0.588, 0.466],
      [0.579, 0.433],
      [0.583, 0.401],
      [0.584, 0.369],
      [0.573, 0.333],
      [0.56, 0.319],
    ],
    width: 0.065,
  },
  {
    path: [
      [0.538, 0.41],
      [0.551, 0.424],
      [0.565, 0.427],
      [0.579, 0.433],
    ],
    width: 0.037,
  },
  {
    path: [
      [0.651, 0.501],
      [0.638, 0.475],
      [0.607, 0.459],
      [0.589, 0.455],
    ],
    width: 0.04,
  },
  {
    path: [
      [0.816, 0.321],
      [0.823, 0.347],
      [0.818, 0.373],
      [0.812, 0.405],
      [0.825, 0.428],
    ],
    width: 0.055,
  },
  {
    path: [
      [0.806, 0.627],
      [0.786, 0.647],
      [0.769, 0.661],
      [0.743, 0.654],
      [0.73, 0.674],
    ],
    width: 0.054,
  },
];

function hash(x: number, y: number) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}
function noise(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), sx),
    THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), sx),
    sy,
  );
}
function fbm(x: number, y: number) {
  return (
    noise(x, y) * 0.59 +
    noise(x * 2.17 + 8.1, y * 2.17 - 4.3) * 0.28 +
    noise(x * 4.39 - 3.2, y * 4.39 + 9.7) * 0.13
  );
}
function toWorld([u, v]: Point): Point {
  return [(u - 0.5) * WORLD_WIDTH, (0.5 - v) * WORLD_HEIGHT];
}
function segments(points: readonly Point[]): Segment[] {
  let offset = 0;
  return points.slice(1).map((point, i) => {
    const a = points[i];
    const dx = point[0] - a[0],
      dy = point[1] - a[1];
    const length = Math.hypot(dx, dy);
    const segment = { ax: a[0], ay: a[1], dx, dy, lengthSquared: length * length, length, offset };
    offset += length;
    return segment;
  });
}

function ridgeHeight(x: number, y: number, ridge: Ridge & { lines: Segment[] }, variation: number) {
  // Domain warping keeps a chain from becoming a straight, roof-like crest.
  const warpedX = x + (noise(x * 1.8 + 17.3, y * 1.8 - 2.1) - 0.5) * 0.32;
  const warpedY = y + (noise(x * 1.6 - 8.3, y * 1.6 + 14.7) - 0.5) * 0.32;
  let nearest = Infinity,
    side = 0,
    along = 0;
  for (const s of ridge.lines) {
    const t = clamp(
      ((warpedX - s.ax) * s.dx + (warpedY - s.ay) * s.dy) / (s.lengthSquared || 1),
      0,
      1,
    );
    const dx = warpedX - s.ax - s.dx * t,
      dy = warpedY - s.ay - s.dy * t;
    const distance = dx * dx + dy * dy;
    if (distance < nearest) {
      nearest = distance;
      side = (s.dx * dy - s.dy * dx) / (s.length || 1);
      along = s.offset + t * s.length;
    }
  }
  if (nearest > ridge.width ** 2 * 8) return 0;
  const width = ridge.width * (side > 0 ? 1.08 : 0.82) * (0.88 + variation * 0.24);
  const distance = Math.sqrt(nearest) / width;
  // Irregular saddles split the backbone into groups of peaks. Short, noisy
  // side ridges die inside the foothills instead of corrugating the plains.
  const seed = ridge.lines[0].ax * 0.31;
  const peak = noise(along * 1.8 + seed, seed + 4.3);
  const crag = noise(along * 4.1 + seed, 18.7 - seed);
  const pulse = 0.4 + peak * 0.72 + crag * 0.23;
  const spine = Math.exp(-Math.pow(distance, 1.08) * 2.18);
  const skirt = Math.exp(-distance * distance * 1.9);
  const branchField = fbm(along * 3.3 + side * 1.9 + seed, side * 4.4 + variation * 1.7);
  const branchRidge = Math.pow(1 - Math.abs(branchField * 2 - 1), 3);
  const spurs =
    branchRidge * smooth(distance, 0.04, 0.28) * (1 - smooth(distance, 0.48, 1.22)) * 0.26;
  const influence = 1 - smooth(distance, 0.85, 1.9);
  return ((spine * 0.84 + skirt * 0.16) * pulse + spurs) * influence * ridge.height;
}

/** Separable coverage blur; also smooths signed shores before creating geometry. */
function blurGrid(source: ArrayLike<number>, radius: number) {
  const temp = new Float32Array(GRID_COUNT),
    output = new Float32Array(GRID_COUNT);
  const size = radius * 2 + 1;
  for (let y = 0; y <= NY; y++) {
    const start = y * STRIDE;
    let sum = 0;
    for (let x = -radius; x <= radius; x++) sum += source[start + clamp(x, 0, NX)];
    for (let x = 0; x <= NX; x++) {
      temp[start + x] = sum / size;
      sum += source[start + Math.min(NX, x + radius + 1)] - source[start + Math.max(0, x - radius)];
    }
  }
  for (let x = 0; x <= NX; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) sum += temp[clamp(y, 0, NY) * STRIDE + x];
    for (let y = 0; y <= NY; y++) {
      output[y * STRIDE + x] = sum / size;
      sum +=
        temp[Math.min(NY, y + radius + 1) * STRIDE + x] -
        temp[Math.max(0, y - radius) * STRIDE + x];
    }
  }
  return output;
}
function distanceToPath(x: number, y: number, path: Segment[]) {
  let nearest = Infinity;
  for (const s of path) {
    const t = clamp(((x - s.ax) * s.dx + (y - s.ay) * s.dy) / (s.lengthSquared || 1), 0, 1);
    const dx = x - s.ax - s.dx * t,
      dy = y - s.ay - s.dy * t;
    nearest = Math.min(nearest, dx * dx + dy * dy);
  }
  return Math.sqrt(nearest);
}

function coastlineDistance(mask: Uint8Array, land: boolean) {
  const field = Float32Array.from(mask, (value) => (Boolean(value) === land ? 10_000 : 0));
  const diagonal = Math.SQRT2;
  for (let y = 0; y <= NY; y++)
    for (let x = 0; x <= NX; x++) {
      const i = y * STRIDE + x;
      if (x) field[i] = Math.min(field[i], field[i - 1] + 1);
      if (y) field[i] = Math.min(field[i], field[i - STRIDE] + 1);
      if (x && y) field[i] = Math.min(field[i], field[i - STRIDE - 1] + diagonal);
      if (x < NX && y) field[i] = Math.min(field[i], field[i - STRIDE + 1] + diagonal);
    }
  for (let y = NY; y >= 0; y--)
    for (let x = NX; x >= 0; x--) {
      const i = y * STRIDE + x;
      if (x < NX) field[i] = Math.min(field[i], field[i + 1] + 1);
      if (y < NY) field[i] = Math.min(field[i], field[i + STRIDE] + 1);
      if (x < NX && y < NY) field[i] = Math.min(field[i], field[i + STRIDE + 1] + diagonal);
      if (x && y < NY) field[i] = Math.min(field[i], field[i + STRIDE - 1] + diagonal);
    }
  return field;
}

async function readGeography() {
  const source = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(() => {
      image.onload = image.onerror = null;
      reject(new Error('O contorno do Mundo demorou para carregar.'));
    }, 20_000);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Não foi possível carregar o contorno do Mundo.'));
    };
    image.src = '/atlas-world-v2.png';
  });
  const canvas = document.createElement('canvas');
  canvas.width = STRIDE;
  canvas.height = NY + 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Não foi possível ler a geografia do Mundo.');
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const land = new Uint8Array(GRID_COUNT);
  const biome = new Uint8Array(GRID_COUNT);
  for (let i = 0; i < GRID_COUNT; i++) {
    const r = pixels[i * 4],
      g = pixels[i * 4 + 1],
      b = pixels[i * 4 + 2];
    const ocean = b > r * 1.1 + 3 && b > g * 0.96;
    land[i] = ocean ? 0 : 1;
    const v = Math.floor(i / STRIDE) / NY;
    // Categorical colours only, never the source RGB/shading as a surface map.
    biome[i] =
      r > 157 && g > 158 && b > 149 && (v < 0.24 || v > 0.72)
        ? 3
        : r > g * 1.055 && g > b * 1.1 && r > 100
          ? 2
          : g >= r * 0.96 && g > b * 1.12
            ? 1
            : 0;
  }
  // Thin painted river strokes are not coastlines. Close only tiny gaps well
  // inside a continent; bays, major straits and the offshore ring remain water.
  const broadLand = blurGrid(land, 12);
  const localLand = blurGrid(land, 3);
  for (let i = 0; i < GRID_COUNT; i++) {
    if (!land[i] && broadLand[i] > 0.83 && localLand[i] > 0.48) land[i] = 1;
  }
  canvas.width = canvas.height = 1;
  return { land, biome };
}

function detailNoise() {
  const data = new Uint8Array(128 * 128 * 4);
  for (let i = 0; i < data.length; i++) data[i] = Math.floor(hash(i % 128, i / 128) * 255);
  const texture = new THREE.DataTexture(data, 128, 128);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Optional CC0 surface detail: timeout/failure keeps the procedural material. */
function loadSurfaceTexture(path: string): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      settled = true;
      texture.dispose();
      resolve(null);
    }, 8_000);
    const texture = new THREE.TextureLoader().load(
      path,
      (loaded) => {
        if (settled) {
          loaded.dispose();
          return;
        }
        settled = true;
        clearTimeout(timer);
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.wrapS = loaded.wrapT = THREE.RepeatWrapping;
        loaded.minFilter = THREE.LinearMipmapLinearFilter;
        loaded.magFilter = THREE.LinearFilter;
        loaded.anisotropy = 4;
        resolve(loaded);
      },
      undefined,
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        texture.dispose();
        resolve(null);
      },
    );
  });
}

/** Actual geometry; the reference PNG is decoded for a land mask/biomes, never uploaded as map. */
export async function createWorldRelief(): Promise<{
  group: THREE.Group;
  sampleHeight: (u: number, v: number) => number;
  territoryAt: (u: number, v: number) => string | null;
  setHovered: (id: string | null) => void;
  update: (time: number) => void;
  dispose: () => void;
  vertexCount: number;
}> {
  const { land, biome } = await readGeography();
  // Reuse the regional CC0 photographs, not the illustration. Loading overlaps
  // terrain generation; the returned scene is ready for its first complete frame.
  const surfaceTextures = Promise.all([
    loadSurfaceTexture('/atlas-materials/ground-color.jpg'),
    loadSurfaceTexture('/atlas-materials/rock-color.jpg'),
  ]);
  const inland = coastlineDistance(land, true);
  const offshore = coastlineDistance(land, false);
  const shore = blurGrid(
    Float32Array.from(land, (value, i) => (value ? inland[i] : -offshore[i]) * CELL),
    1,
  );
  const landWeight = blurGrid(land, 11);
  const forestWeight = blurGrid(
    Float32Array.from(biome, (value, i) => (land[i] && value === 1 ? 1 : 0)),
    11,
  );
  const desertWeight = blurGrid(
    Float32Array.from(biome, (value, i) => (land[i] && value === 2 ? 1 : 0)),
    11,
  );
  const snowWeight = blurGrid(
    Float32Array.from(biome, (value, i) => (land[i] && value === 3 ? 1 : 0)),
    7,
  );
  const heightField = new Float32Array(GRID_COUNT);
  const terrainColors = new Float32Array(GRID_COUNT * 3);
  const ridgePaths = RIDGES.map((ridge) => ({
    ...ridge,
    lines: segments(ridge.path.map(toWorld)),
  }));
  const riverCurves = RIVERS.map((river) => {
    const curve = new THREE.CatmullRomCurve3(
      river.path.map((p) => {
        const [x, y] = toWorld(p);
        return new THREE.Vector3(x, y, 0);
      }),
      false,
      'centripetal',
    );
    return { ...river, points: curve.getPoints(220) };
  });
  const riverPaths = riverCurves.map((river) => ({
    width: river.width,
    lines: segments(river.points.filter((_, i) => i % 5 === 0).map((p) => [p.x, p.y] as Point)),
  }));
  const meadow = new THREE.Color('#7c8d50').multiplyScalar(0.94);
  const forest = new THREE.Color('#3f663d').multiplyScalar(0.94);
  const sand = new THREE.Color('#d7b76e');
  const dune = new THREE.Color('#c3a05e');
  const stone = new THREE.Color('#96999d');
  const paleStone = new THREE.Color('#b5b8ba');
  const snow = new THREE.Color('#dde0d8');
  const coast = new THREE.Color('#85846a');
  const color = new THREE.Color();

  for (let y = 0; y <= NY; y++) {
    for (let x = 0; x <= NX; x++) {
      const i = y * STRIDE + x;
      const wx = (x / NX - 0.5) * WORLD_WIDTH,
        wy = (0.5 - y / NY) * WORLD_HEIGHT;
      if (shore[i] <= 0) {
        heightField[i] = Math.max(-0.18, shore[i] * 0.86);
        coast.toArray(terrainColors, i * 3);
        continue;
      }
      const edge = smooth(shore[i], 0, 0.48);
      const broad = fbm(wx * 0.22 + 7.7, wy * 0.22 - 4.1);
      const reliefNoise = fbm(wx * 1.45 + 9.1, wy * 1.45 - 6.2);
      const normalizedLand = Math.max(0.05, landWeight[i]);
      const forestAmount = forestWeight[i] / normalizedLand;
      const snowAmount = clamp(snowWeight[i] / normalizedLand, 0, 1);
      const u = x / NX,
        v = y / NY;
      const desertBasin = Math.max(
        Math.exp(-(((u - 0.318) / 0.109) ** 2 + ((v - 0.547) / 0.069) ** 2) * 0.8),
        Math.exp(-(((u - 0.586) / 0.101) ** 2 + ((v - 0.41) / 0.098) ** 2) * 0.7),
        Math.exp(-(((u - 0.76) / 0.045) ** 2 + ((v - 0.682) / 0.088) ** 2)),
      );
      const desertAmount = clamp((desertWeight[i] / normalizedLand) * desertBasin * 1.5, 0, 1);
      let mountain = 0;
      for (const ridge of ridgePaths)
        mountain = Math.max(mountain, ridgeHeight(wx, wy, ridge, reliefNoise));
      let riverDistance = 100;
      for (const river of riverPaths)
        riverDistance = Math.min(riverDistance, distanceToPath(wx, wy, river.lines));
      const channel = 1 - smooth(riverDistance, 0.035, 0.18);
      const valley = 1 - smooth(riverDistance, 0.08, 0.4);
      const rolling = fbm(wx * 0.53 + 16, wy * 0.53 - 8);
      const foothill = broad * 0.15 + rolling * 0.1 + reliefNoise * 0.025;
      let elevation =
        Math.min(0.06, shore[i] * 0.86) + edge * (foothill + mountain * (1 - valley * 0.46));
      const calmPlain =
        smooth(shore[i], 0.25, 0.85) *
        smooth(riverDistance, 0.22, 0.65) *
        (1 - smooth(mountain, 0.025, 0.2));
      const undulation = (fbm(wx * 0.72 + 28.6, wy * 0.72 - 19.3) - 0.5) * 0.11;
      elevation += undulation * calmPlain;
      elevation += desertAmount * edge * (0.025 * Math.sin(wx * 3.6 + Math.sin(wy * 2)) + 0.025);
      elevation -= channel * Math.min(0.07, elevation * 0.25);
      heightField[i] = clamp(elevation, 0, 1.7);
      color.copy(meadow).lerp(forest, forestAmount * (0.75 + broad * 0.2));
      color.lerp(dune, desertAmount).lerp(sand, desertAmount * broad * 0.52);
      const rocky = smooth(mountain, 0.34, 0.93);
      color.lerp(stone, rocky * 0.92);
      if (mountain > 0.94) color.lerp(paleStone, smooth(mountain, 0.94, 1.48));
      color.lerp(snow, smooth(snowAmount, 0.04, 0.76) * 0.88);
      if ((y / NY < 0.24 || y / NY > 0.76) && mountain > 0.8)
        color.lerp(snow, smooth(mountain, 0.8, 1.42) * 0.78);
      color.lerp(coast, (1 - smooth(shore[i], 0.015, 0.13)) * 0.45);
      color.multiplyScalar(0.9 + broad * 0.18 + reliefNoise * 0.06);
      color.toArray(terrainColors, i * 3);
    }
    if (y % 48 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  // Match the exact indexed terrain triangles, so river ribbons do not clip
  // through slopes as they would with unrelated analytic or bilinear heights.
  function sampleHeight(u: number, v: number) {
    if (u < 0 || u > 1 || v < 0 || v > 1) return -0.18;
    const px = clamp(u, 0, 1) * NX,
      py = clamp(v, 0, 1) * NY;
    const ix = Math.min(NX - 1, Math.floor(px)),
      iy = Math.min(NY - 1, Math.floor(py));
    const tx = px - ix,
      ty = py - iy,
      i = iy * STRIDE + ix;
    const a = heightField[i],
      b = heightField[i + STRIDE],
      c = heightField[i + STRIDE + 1],
      d = heightField[i + 1];
    return tx + ty <= 1
      ? a + (d - a) * tx + (b - a) * ty
      : c + (b - c) * (1 - tx) + (d - c) * (1 - ty);
  }
  const group = new THREE.Group();
  group.name = 'world-cartographic-relief';
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const noiseTexture = detailNoise();
  const [groundPhoto, rockPhoto] = await surfaceTextures;
  const timeUniform = { value: 0 };
  const hoveredTerritory = { value: 0 };
  function territoryAt(u: number, v: number) {
    const sea = seaTerritory(u, v);
    if (sea) return sea;
    if (u < 0 || u > 1 || v < 0 || v > 1 || sampleHeight(u, v) <= 0) return null;
    const id = landTerritory(u, v);
    return WORLD_TERRITORIES[id - 1]?.id ?? null;
  }
  const trackGeometry = <T extends THREE.BufferGeometry>(value: T) => {
    geometries.push(value);
    return value;
  };
  const trackMaterial = <T extends THREE.Material>(value: T) => {
    materials.push(value);
    return value;
  };
  const terrainGeometry = trackGeometry(new THREE.PlaneGeometry(WORLD_WIDTH, WORLD_HEIGHT, NX, NY));
  for (let i = 0; i < GRID_COUNT; i++) terrainGeometry.attributes.position.setZ(i, heightField[i]);
  terrainGeometry.setAttribute('color', new THREE.BufferAttribute(terrainColors, 3));
  terrainGeometry.computeVertexNormals();
  // Exposed slopes show neutral gray rock even below the summit; calm plains retain
  // their biome colour. This uses actual geometry, not painted elevation cues.
  const normalAttribute = terrainGeometry.attributes.normal;
  const weatheredStone = new THREE.Color('#8e9193');
  for (let i = 0; i < GRID_COUNT; i++) {
    if (heightField[i] < 0.23) continue;
    const slope = 1 - Math.abs(normalAttribute.getZ(i));
    const exposure = smooth(slope, 0.16, 0.53) * 0.67;
    color.fromArray(terrainColors, i * 3).lerp(weatheredStone, exposure);
    color.toArray(terrainColors, i * 3);
  }
  const terrainMaterial = trackMaterial(
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
      flatShading: false,
    }),
  );
  terrainMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.worldHovered = hoveredTerritory;
    shader.uniforms.worldReliefNoise = { value: noiseTexture };
    shader.uniforms.worldGroundPhoto = { value: groundPhoto ?? noiseTexture };
    shader.uniforms.worldRockPhoto = { value: rockPhoto ?? noiseTexture };
    shader.uniforms.worldPhotoAvailable = {
      value: new THREE.Vector2(groundPhoto ? 1 : 0, rockPhoto ? 1 : 0),
    };
    shader.vertexShader =
      'varying vec3 vWorldRelief;\nvarying vec3 vWorldReliefNormal;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nvWorldRelief = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWorldReliefNormal = normalize(mat3(modelMatrix) * objectNormal);',
    );
    shader.fragmentShader =
      /* glsl */ `
      varying vec3 vWorldRelief;
      varying vec3 vWorldReliefNormal;
      uniform sampler2D worldReliefNoise;
      uniform sampler2D worldGroundPhoto;
      uniform sampler2D worldRockPhoto;
      uniform vec2 worldPhotoAvailable;
      uniform float worldHovered;
      ${TERRITORY_GLSL}
      float worldPhotoLuma(sampler2D photograph, vec3 position, vec3 weights) {
        vec3 surface = texture2D(photograph, position.yz).rgb * weights.x
          + texture2D(photograph, position.xz).rgb * weights.y
          + texture2D(photograph, position.xy).rgb * weights.z;
        return dot(surface, vec3(0.2126, 0.7152, 0.0722));
      }
      ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      /* glsl */ `
      #include <color_fragment>
      float worldGrain = texture2D(worldReliefNoise, vWorldRelief.xy * 0.19).r * 0.55
        + texture2D(worldReliefNoise, vWorldRelief.xy * 0.73 + 0.3).g * 0.3
        + texture2D(worldReliefNoise, vWorldRelief.yz * 0.37).b * 0.15;
      float worldMacro = texture2D(worldReliefNoise, vWorldRelief.xy * 0.012 + 0.19).a;
      vec3 worldBlend = pow(abs(normalize(vWorldReliefNormal)), vec3(4.0));
      worldBlend /= max(dot(worldBlend, vec3(1.0)), 0.0001);
      float worldSlope = 1.0 - abs(normalize(vWorldReliefNormal).z);
      float worldRockDetail = max(smoothstep(0.35, 1.05, vWorldRelief.z),
        smoothstep(0.13, 0.45, worldSlope) * 0.85);
      float worldGroundGrain = worldPhotoLuma(worldGroundPhoto, vWorldRelief * 0.48, worldBlend) * 0.65
        + worldPhotoLuma(worldGroundPhoto, vWorldRelief * 0.105 + 0.17, worldBlend) * 0.35;
      float worldRockGrain = worldPhotoLuma(worldRockPhoto, vWorldRelief * 0.66, worldBlend) * 0.74
        + worldPhotoLuma(worldRockPhoto, vWorldRelief * 0.23 + 0.31, worldBlend) * 0.26;
      // Only neutral luminance contributes: no brown photo tint over moss or
      // green tint over rock. Two scales break repetition on large exposed faces.
      float worldGroundFinish = mix(1.0, clamp(0.65 + worldGroundGrain * 1.45, 0.7, 1.34), worldPhotoAvailable.x);
      float worldRockFinish = mix(1.0, clamp(0.58 + worldRockGrain * 1.7, 0.68, 1.38), worldPhotoAvailable.y);
      diffuseColor.rgb *= (0.88 + worldGrain * 0.15 + worldMacro * 0.10)
        * mix(worldGroundFinish, worldRockFinish, worldRockDetail);
      vec2 territoryUv = vec2(vWorldRelief.x / 36.0 + 0.5, 0.5 - vWorldRelief.y / 20.25);
      vec3 division = worldDivision(territoryUv);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.65, 0.48, 0.23), division.y * 0.4);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.5 + vec3(0.13, 0.09, 0.035), division.z * 0.55);
    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      /* glsl */ `
      #include <normal_fragment_maps>
      vec3 worldDx = dFdx(-vViewPosition), worldDy = dFdy(-vViewPosition);
      vec3 worldBx = cross(worldDy, normal), worldBy = cross(normal, worldDx);
      float worldDet = dot(worldDx, worldBx);
      float worldPhotoHeight = mix(worldGroundGrain * worldPhotoAvailable.x,
        worldRockGrain * worldPhotoAvailable.y, worldRockDetail);
      float worldDetailHeight = worldGrain * mix(0.002, 0.006, worldRockDetail)
        + worldPhotoHeight * mix(0.016, 0.042, worldRockDetail);
      vec3 worldGradient = sign(worldDet) * (dFdx(worldDetailHeight) * worldBx + dFdy(worldDetailHeight) * worldBy);
      normal = normalize(abs(worldDet) * normal - worldGradient);
    `,
    );
  };
  terrainMaterial.customProgramCacheKey = () => 'world-real-relief-v7-surface-detail';
  const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
  terrain.name = 'world-land-geometry';
  terrain.castShadow = terrain.receiveShadow = true;
  group.add(terrain);

  const ocean = createWorldOcean(shore, NX, NY, timeUniform);
  group.add(ocean.mesh);

  const riverMaterial = trackMaterial(
    new THREE.MeshStandardMaterial({
      color: '#326671',
      roughness: 0.67,
      metalness: 0,
      flatShading: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  for (const river of riverCurves) {
    const vertices: number[] = [];
    const indices: number[] = [];
    const connects = (point: THREE.Vector3) =>
      riverCurves.some(
        (other) =>
          other !== river &&
          other.points.some((p) => Math.hypot(p.x - point.x, p.y - point.y) < 0.12),
      );
    const startJoins = connects(river.points[0]);
    const endJoins = connects(river.points[river.points.length - 1]);
    for (let i = 0; i < river.points.length; i++) {
      const point = river.points[i];
      const before = river.points[Math.max(0, i - 1)],
        after = river.points[Math.min(river.points.length - 1, i + 1)];
      const tangent = new THREE.Vector2(after.x - before.x, after.y - before.y).normalize();
      const progress = i / (river.points.length - 1);
      const sourceTaper = startJoins ? 1 : smooth(progress, 0, 0.09);
      const mouthTaper = endJoins ? 1 : smooth(1 - progress, 0, 0.1);
      const halfWidth = river.width * 0.44 * (0.26 + progress * 0.35) * sourceTaper * mouthTaper;
      for (const side of [-1, 1]) {
        const x = point.x - tangent.y * halfWidth * side,
          y = point.y + tangent.x * halfWidth * side;
        const z = Math.max(0, sampleHeight(x / WORLD_WIDTH + 0.5, 0.5 - y / WORLD_HEIGHT)) + 0.012;
        vertices.push(x, y, z);
      }
      if (i) {
        const a = (i - 1) * 2,
          b = i * 2;
        const centerHeight = sampleHeight(
          point.x / WORLD_WIDTH + 0.5,
          0.5 - point.y / WORLD_HEIGHT,
        );
        if (centerHeight > -0.05) indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geometry = trackGeometry(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, riverMaterial);
    mesh.name = 'world-river';
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  let disposed = false;
  return {
    group,
    sampleHeight,
    territoryAt,
    setHovered(id) {
      hoveredTerritory.value = WORLD_TERRITORIES.findIndex((t) => t.id === id) + 1;
    },
    vertexCount: GRID_COUNT,
    update(time) {
      if (!disposed && Number.isFinite(time)) timeUniform.value = time;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      ocean.dispose();
      noiseTexture.dispose();
      groundPhoto?.dispose();
      rockPhoto?.dispose();
      group.clear();
    },
  };
}
