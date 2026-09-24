import type { AtlasMarker } from './atlas-types';

/** All coordinates are two-dimensional. The ground is an affine painted plane;
 * upright illustrations use one of eight independently drawn viewing directions. */
// O master quadrado é projetado sem distorção no chão do reino.
export const KINGDOM_WIDTH = 15000;
export const KINGDOM_HEIGHT = 15000;
export const KINGDOM_TILT = 0.58;
export const KINGDOM_CAMERA_Y = 0.57;
export const KINGDOM_MIN_ZOOM = 1;
export const KINGDOM_MAX_ZOOM = 1.3;

export type KingdomView = { x: number; y: number; zoom: number; angle: number };
export type KingdomViewport = { width: number; height: number; scale: number };
export type KingdomSpriteKind =
  | 'fortress'
  | 'tower'
  | 'inn'
  | 'pine'
  | 'oak'
  | 'rock'
  | 'harbor'
  | 'totem'
  | 'cottage'
  | 'shop'
  | 'chapel'
  | 'townhouse'
  | 'stable'
  | 'townhall'
  | 'warehouse'
  | 'sailboat'
  | 'forge'
  | 'granary'
  | 'tavern'
  | 'ranger'
  | 'stoneCircle'
  | 'barracks';
export type KingdomSprite = {
  id: string;
  kind: KingdomSpriteKind;
  x: number;
  y: number;
  height: number;
  direction: number;
  marker?: AtlasMarker;
};
export type KingdomAssets = Record<
  | 'ground'
  | 'structures'
  | 'nature'
  | 'landmarks'
  | 'settlements'
  | 'town'
  | 'seaport'
  | 'craft'
  | 'frontier',
  HTMLImageElement
>;

export function kingdomPoint(u: number, v: number) {
  return { x: (u - 0.5) * KINGDOM_WIDTH, y: (v - 0.5) * KINGDOM_HEIGHT };
}

// Visual anchors follow the clearings in this painting. They do not modify the
// authoritative atlas coordinates or any location/mission records in SQL.
export const KINGDOM_VISUAL_ANCHORS: Record<string, readonly [number, number]> = {
  vigilia: [0.53, 0.44],
  'passo-da-geada': [0.12, 0.16],
  'estrada-do-ferro': [0.74, 0.75],
  'porto-das-brumas': [0.78, 0.38],
  'bosque-dos-sussurros': [0.13, 0.5],
  'floresta-negra': [0.18, 0.75],
};

export function kingdomMarkerPoint(marker: AtlasMarker) {
  const [u, v] = KINGDOM_VISUAL_ANCHORS[marker.id] ?? [marker.x, marker.y];
  return kingdomPoint(u, v);
}

export function projectKingdom(x: number, y: number, view: KingdomView, viewport: KingdomViewport) {
  const cos = Math.cos(view.angle),
    sin = Math.sin(view.angle);
  const dx = x - view.x,
    dy = y - view.y;
  const scale = view.zoom * viewport.scale;
  return {
    x: viewport.width * 0.5 + (dx * cos - dy * sin) * scale,
    y: viewport.height * KINGDOM_CAMERA_Y + (dx * sin + dy * cos) * scale * KINGDOM_TILT,
  };
}

export function unprojectKingdom(
  x: number,
  y: number,
  view: KingdomView,
  viewport: KingdomViewport,
) {
  const scale = view.zoom * viewport.scale;
  const dx = (x - viewport.width * 0.5) / scale;
  const dy = (y - viewport.height * KINGDOM_CAMERA_Y) / (scale * KINGDOM_TILT);
  const cos = Math.cos(view.angle),
    sin = Math.sin(view.angle);
  return { x: view.x + dx * cos + dy * sin, y: view.y - dx * sin + dy * cos };
}

export function kingdomDirection(angle: number) {
  return ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
}

const spriteKinds: Record<string, { kind: KingdomSpriteKind; height: number }> = {
  vigilia: { kind: 'townhall', height: 360 },
  'passo-da-geada': { kind: 'tower', height: 310 },
  'estrada-do-ferro': { kind: 'inn', height: 290 },
  'porto-das-brumas': { kind: 'harbor', height: 310 },
  'bosque-dos-sussurros': { kind: 'totem', height: 265 },
  'floresta-negra': { kind: 'stoneCircle', height: 320 },
};

type HamletPiece = readonly [number, number, KingdomSpriteKind, number, number];
// Each place is a settlement: the focal landmark plus surrounding buildings.
// All pieces retain the same SQL location through marker.id.
const hamlets: Record<string, readonly HamletPiece[]> = {
  vigilia: [
    [-340, -260, 'fortress', 330, 1],
    [-110, -330, 'townhouse', 230, 0],
    [170, -310, 'chapel', 215, 6],
    [390, -240, 'forge', 215, 2],
    [-420, -55, 'townhouse', 225, 1],
    [440, -20, 'tavern', 240, 7],
    [-350, 210, 'stable', 205, 3],
    [-120, 280, 'cottage', 175, 4],
    [220, 280, 'shop', 185, 6],
    [480, 225, 'granary', 190, 2],
    [-580, -280, 'barracks', 240, 4],
    [610, -170, 'townhouse', 200, 5],
  ],
  'passo-da-geada': [
    [-280, -215, 'cottage', 175, 2],
    [130, -240, 'townhouse', 205, 5],
    [-280, 180, 'stable', 190, 6],
    [185, 205, 'barracks', 225, 1],
    [420, -30, 'forge', 185, 4],
  ],
  'estrada-do-ferro': [
    [-260, -190, 'stable', 220, 0],
    [220, -200, 'townhouse', 205, 4],
    [-300, 170, 'granary', 180, 6],
    [210, 210, 'cottage', 175, 2],
    [420, 125, 'shop', 180, 7],
    [510, -150, 'forge', 200, 3],
  ],
  'porto-das-brumas': [
    [-300, -245, 'warehouse', 240, 1],
    [100, -255, 'townhouse', 185, 5],
    [-325, 205, 'tavern', 235, 0],
    [110, 225, 'cottage', 175, 6],
    [510, -90, 'granary', 190, 7],
    [790, 150, 'sailboat', 260, 0],
  ],
  'bosque-dos-sussurros': [
    [-260, -195, 'cottage', 160, 2],
    [235, -170, 'townhouse', 180, 5],
    [-260, 190, 'ranger', 200, 1],
    [245, 195, 'chapel', 185, 6],
  ],
  'floresta-negra': [
    [-260, -170, 'ranger', 220, 1],
    [240, -170, 'cottage', 170, 6],
    [-240, 190, 'chapel', 185, 3],
    [265, 210, 'ranger', 180, 5],
  ],
};

export function kingdomBuildings(markers: AtlasMarker[]): KingdomSprite[] {
  return markers.flatMap((marker) => [
    {
      id: marker.id,
      marker,
      ...kingdomMarkerPoint(marker),
      ...(spriteKinds[marker.id] ?? { kind: 'inn', height: 230 }),
      direction: 0,
    },
    ...(hamlets[marker.id] ?? []).map(([dx, dy, kind, height, direction], index) => ({
      id: `${marker.id}-house-${index}`,
      marker,
      x: kingdomMarkerPoint(marker).x + dx,
      y: kingdomMarkerPoint(marker).y + dy,
      kind,
      height,
      direction,
    })),
  ]);
}

function seededRandom(seed: number) {
  return () => {
    seed = Math.imul(1664525, seed) + 1013904223;
    return (seed >>> 0) / 4294967296;
  };
}

/** Compact groves placed over the four woodland areas marked on the 6×6 master. */
export function kingdomTreeGrovesOnTerrain(ground: HTMLImageElement): KingdomSprite[] {
  const sampleSize = 1440;
  const canvas = document.createElement('canvas');
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(ground, 0, 0, sampleSize, sampleSize);
  const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data;
  const random = seededRandom(62481);
  const trees: KingdomSprite[] = [];
  // Coordinates follow the painted terrain, so the groves move with the map.
  // Neighboring ellipses form groups rather than scattering trees everywhere.
  const groves: readonly (readonly [number, number, number, number, number])[] = [
    [0.269, 0.339, 0.023, 0.034, 20],
    [0.285, 0.365, 0.018, 0.026, 16],
    [0.387, 0.372, 0.031, 0.028, 22],
    [0.444, 0.383, 0.039, 0.031, 28],
    [0.515, 0.374, 0.027, 0.027, 20],
    [0.309, 0.679, 0.022, 0.032, 20],
    [0.326, 0.73, 0.022, 0.034, 20],
    [0.615, 0.557, 0.035, 0.037, 24],
    [0.633, 0.632, 0.031, 0.043, 26],
  ];
  // Painted rocks, fallen trunks and reserved clearings inside the marked areas.
  const scenery: readonly (readonly [number, number, number, number])[] = [
    [0.253, 0.3, 0.026, 0.024],
    [0.48, 0.32, 0.026, 0.02],
    [0.296, 0.578, 0.026, 0.025],
    [0.574, 0.644, 0.029, 0.021],
    [0.673, 0.621, 0.028, 0.027],
  ];
  const groundIsClear = (u: number, v: number) => {
    const px = Math.floor(u * sampleSize);
    const py = Math.floor(v * sampleSize);
    if (px < 0 || py < 0 || px >= sampleSize || py >= sampleSize) return false;
    const index = (py * sampleSize + px) * 4;
    const r = pixels[index],
      g = pixels[index + 1],
      b = pixels[index + 2];
    const road = r > 190 && g > 130 && b > 65 && r > g * 1.12;
    const water = b > r * 1.11 && b > g * 1.04;
    const stone = Math.max(r, g, b) - Math.min(r, g, b) < 18 && r > 110;
    const clearing = r > 205 && g > 165 && b > 90;
    return !(road || water || stone || clearing);
  };
  const clearFootprint = (u: number, v: number) => {
    const radius = 0.009;
    if (scenery.some(([cx, cy, rx, ry]) => ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 < 1))
      return false;
    return [
      [0, 0],
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
      [radius * 0.7, radius * 0.7],
      [-radius * 0.7, -radius * 0.7],
    ].every(([du, dv]) => groundIsClear(u + du, v + dv));
  };
  for (const [cu, cv, ru, rv, count] of groves) {
    let placed = 0;
    for (let attempt = 0; attempt < count * 70 && placed < count; attempt++) {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random());
      const u = cu + Math.cos(angle) * ru * distance;
      const v = cv + Math.sin(angle) * rv * distance;
      if (!clearFootprint(u, v)) continue;
      const { x, y } = kingdomPoint(u, v);
      if (trees.some((tree) => Math.hypot(tree.x - x, tree.y - y) < 85)) continue;
      trees.push({
        id: `grove-tree-${trees.length}`,
        kind: random() < 0.74 ? 'pine' : 'oak',
        x,
        y,
        height: 450 + random() * 140,
        direction: Math.floor(random() * 8),
      });
      placed++;
    }
  }
  return trees;
}

/** Terrain-aware placement keeps paths, bridges, water and all settlements clear. */
export function kingdomDecorationsOnTerrain(
  markers: AtlasMarker[],
  assets: KingdomAssets,
): KingdomSprite[] {
  const canvas = document.createElement('canvas');
  canvas.width = assets.ground.naturalWidth;
  canvas.height = assets.ground.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(assets.ground, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const occupied = kingdomBuildings(markers);
  const random = seededRandom(198204);
  const result: KingdomSprite[] = [];
  const readableGround = (x: number, y: number) => {
    const px = Math.floor((x / KINGDOM_WIDTH + 0.5) * canvas.width);
    const py = Math.floor((y / KINGDOM_HEIGHT + 0.5) * canvas.height);
    if (px < 0 || px >= canvas.width || py < 0 || py >= canvas.height) return false;
    const index = (py * canvas.width + px) * 4;
    const r = pixels[index],
      g = pixels[index + 1],
      b = pixels[index + 2];
    const road = r > 82 && r > g * 1.12 && g > b * 1.1;
    const water = b > r * 1.11 && b > g * 1.04;
    const paving = Math.max(r, g, b) - Math.min(r, g, b) < 18 && r > 110;
    return !(road || water || paving);
  };
  const clear = (x: number, y: number, radius: number) =>
    [
      [0, 0],
      [-radius, 0],
      [radius, 0],
      [0, -radius],
      [0, radius],
    ].every(([dx, dy]) => readableGround(x + dx, y + dy));
  const pockets: readonly (readonly [number, number, number, number, number])[] = [
    [-3260, -1480, 290, 200, 19],
    [-2830, -540, 240, 240, 16],
    [-2850, 450, 270, 200, 18],
    [-2860, 1600, 280, 230, 23],
    [-2300, 1920, 290, 180, 20],
    [-1450, 1470, 280, 260, 18],
    [-420, 1740, 340, 230, 17],
    [350, 1520, 340, 270, 16],
    [920, -1550, 320, 200, 18],
    [1570, -520, 260, 240, 15],
    [2570, -440, 220, 180, 14],
    [2400, 1580, 220, 180, 15],
    [50, -1780, 290, 170, 12],
  ];
  for (const [cx, cy, rx, ry, count] of pockets) {
    let placed = 0;
    for (let attempt = 0; attempt < count * 25 && placed < count; attempt++) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random());
      const x = cx + Math.cos(angle) * rx * radius;
      const y = cy + Math.sin(angle) * ry * radius;
      if (!clear(x, y, 68)) continue;
      if (occupied.some((sprite) => Math.hypot(sprite.x - x, sprite.y - y) < 230)) continue;
      if (result.some((sprite) => Math.hypot(sprite.x - x, sprite.y - y) < 65)) continue;
      result.push({
        id: `wood-${result.length}`,
        kind: random() > 0.35 ? 'pine' : 'oak',
        x,
        y,
        height: 115 + random() * 75,
        direction: Math.floor(random() * 8),
      });
      placed++;
    }
  }
  for (let i = 0; i < 50; i++) {
    const pocket = pockets[i % pockets.length];
    const x = pocket[0] + (random() - 0.5) * pocket[2] * 2;
    const y = pocket[1] + (random() - 0.5) * pocket[3] * 2;
    if (!clear(x, y, 50) || occupied.some((s) => Math.hypot(s.x - x, s.y - y) < 180)) continue;
    result.push({
      id: `boulder-${i}`,
      kind: 'rock',
      x,
      y,
      height: 45 + random() * 55,
      direction: i % 8,
    });
  }
  return result;
}

// The hand-drawn sheets have generous, nonuniform row spacing. These measured
// bands deliberately do not divide image height by three (which cuts pine roots).
export const frames: Record<
  KingdomSpriteKind,
  {
    sheet: Exclude<keyof KingdomAssets, 'ground'>;
    y: number;
    height: number;
    pivot: number;
    columns: readonly number[];
  }
> = {
  fortress: {
    sheet: 'structures',
    y: 0,
    height: 334,
    pivot: 0.974,
    columns: [0, 198, 400, 598, 793, 991, 1184, 1380, 1586],
  },
  tower: {
    sheet: 'structures',
    y: 334,
    height: 334,
    pivot: 0.952,
    columns: [0, 198, 398, 595, 793, 991, 1181, 1388, 1586],
  },
  inn: {
    sheet: 'structures',
    y: 668,
    height: 324,
    pivot: 0.87,
    columns: [0, 200, 409, 596, 793, 988, 1190, 1376, 1586],
  },
  pine: {
    sheet: 'nature',
    y: 0,
    height: 380,
    pivot: 0.97,
    columns: [0, 202, 396, 595, 793, 992, 1190, 1388, 1586],
  },
  oak: {
    sheet: 'nature',
    y: 380,
    height: 340,
    pivot: 0.932,
    columns: [0, 210, 396, 600, 793, 996, 1190, 1378, 1586],
  },
  rock: {
    sheet: 'nature',
    y: 720,
    height: 272,
    pivot: 0.84,
    columns: [0, 208, 396, 595, 793, 991, 1190, 1388, 1586],
  },
  harbor: {
    sheet: 'landmarks',
    y: 0,
    height: 380,
    pivot: 0.95,
    columns: [0, 249, 491, 728, 971, 1214, 1456, 1695, 1942],
  },
  totem: {
    sheet: 'landmarks',
    y: 380,
    height: 429,
    pivot: 0.86,
    columns: [0, 255, 492, 728, 971, 1214, 1456, 1690, 1942],
  },
  cottage: {
    sheet: 'settlements',
    y: 0,
    height: 250,
    pivot: 0.94,
    columns: [0, 256, 512, 768, 1024, 1280, 1536, 1792, 2048],
  },
  shop: {
    sheet: 'settlements',
    y: 250,
    height: 250,
    pivot: 0.94,
    columns: [0, 256, 512, 768, 1024, 1280, 1536, 1792, 2048],
  },
  chapel: {
    sheet: 'settlements',
    y: 500,
    height: 268,
    pivot: 0.96,
    columns: [0, 256, 512, 768, 1024, 1280, 1536, 1792, 2048],
  },
  townhouse: {
    sheet: 'town',
    y: 0,
    height: 350,
    pivot: 0.94,
    columns: [0, 198, 396, 594, 792, 990, 1188, 1386, 1585],
  },
  stable: {
    sheet: 'town',
    y: 350,
    height: 265,
    pivot: 0.95,
    columns: [0, 198, 396, 594, 792, 990, 1188, 1386, 1585],
  },
  townhall: {
    sheet: 'town',
    y: 615,
    height: 377,
    pivot: 0.96,
    columns: [0, 198, 396, 594, 792, 990, 1188, 1386, 1585],
  },
  warehouse: {
    sheet: 'seaport',
    y: 0,
    height: 355,
    pivot: 0.96,
    columns: [0, 270, 541, 811, 1082, 1352, 1623, 1893, 2164],
  },
  sailboat: {
    sheet: 'seaport',
    y: 355,
    height: 372,
    pivot: 0.98,
    columns: [0, 270, 541, 811, 1082, 1352, 1623, 1893, 2164],
  },
  forge: {
    sheet: 'craft',
    y: 0,
    height: 350,
    pivot: 0.96,
    columns: [0, 198, 396, 594, 792, 990, 1188, 1386, 1584],
  },
  granary: {
    sheet: 'craft',
    y: 350,
    height: 290,
    pivot: 0.96,
    columns: [0, 198, 396, 594, 792, 990, 1188, 1386, 1584],
  },
  tavern: {
    sheet: 'craft',
    y: 640,
    height: 353,
    pivot: 0.96,
    columns: [0, 198, 396, 594, 792, 990, 1188, 1386, 1584],
  },
  ranger: {
    sheet: 'frontier',
    y: 0,
    height: 340,
    pivot: 0.95,
    columns: [0, 198, 396, 594, 792, 990, 1188, 1386, 1586],
  },
  stoneCircle: {
    sheet: 'frontier',
    y: 340,
    height: 280,
    pivot: 0.91,
    columns: [0, 198, 396, 594, 792, 990, 1188, 1386, 1586],
  },
  barracks: {
    sheet: 'frontier',
    y: 620,
    height: 372,
    pivot: 0.96,
    columns: [0, 198, 396, 594, 792, 990, 1188, 1386, 1586],
  },
};

export function spriteSize(
  sprite: KingdomSprite,
  _assets: KingdomAssets,
  scale: number,
  direction = 0,
) {
  const definition = frames[sprite.kind];
  const frame = (direction + sprite.direction) % 8;
  const aspect = (definition.columns[frame + 1] - definition.columns[frame]) / definition.height;
  return { width: sprite.height * aspect * scale, height: sprite.height * scale };
}

export function paintKingdom(
  ctx: CanvasRenderingContext2D,
  assets: KingdomAssets,
  sprites: KingdomSprite[],
  view: KingdomView,
  viewport: KingdomViewport,
  selected: string | null,
  hovered: string | null,
  seconds: number,
) {
  const { width, height } = viewport;
  const scale = viewport.scale * view.zoom;
  const cos = Math.cos(view.angle),
    sin = Math.sin(view.angle);
  const origin = projectKingdom(0, 0, view, viewport);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#e1e4e5';
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.transform(
    cos * scale,
    sin * scale * KINGDOM_TILT,
    -sin * scale,
    cos * scale * KINGDOM_TILT,
    origin.x,
    origin.y,
  );
  // Trinta e seis regiões detalhadas foram reunidas em um terreno contínuo.
  const left = -KINGDOM_WIDTH / 2;
  const top = -KINGDOM_HEIGHT / 2;
  ctx.drawImage(assets.ground, left, top, KINGDOM_WIDTH, KINGDOM_HEIGHT);
  ctx.restore();

  const ordered = sprites
    .map((sprite) => ({ sprite, at: projectKingdom(sprite.x, sprite.y, view, viewport) }))
    .sort((a, b) => a.at.y - b.at.y);
  const direction = kingdomDirection(view.angle);
  for (const { sprite, at } of ordered) {
    const definition = frames[sprite.kind],
      image = assets[definition.sheet];
    const size = spriteSize(sprite, assets, scale, direction);
    if (
      at.x + size.width < -40 ||
      at.x - size.width > width + 40 ||
      at.y < -40 ||
      at.y - size.height > height + 40
    )
      continue;
    const active =
      sprite.id === selected ||
      sprite.id === hovered ||
      sprite.marker?.id === selected ||
      sprite.marker?.id === hovered;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.translate(at.x, at.y - size.height * 0.035);
    ctx.scale(1, 0.3);
    // The shadow uses local coordinates after transforming to a ground ellipse.
    const localShadow = ctx.createRadialGradient(0, 0, 0, 0, 0, size.width * 0.42);
    localShadow.addColorStop(0, '#121b18a0');
    localShadow.addColorStop(1, '#121b1800');
    ctx.fillStyle = localShadow;
    ctx.beginPath();
    ctx.arc(0, 0, size.width * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (active || sprite.kind === 'totem') {
      const radius = size.width * (active ? 0.9 : 0.6);
      const glow = ctx.createRadialGradient(
        at.x,
        at.y - size.height * 0.1,
        0,
        at.x,
        at.y - size.height * 0.1,
        radius,
      );
      glow.addColorStop(0, active ? '#e1b86945' : '#8edcc923');
      glow.addColorStop(1, '#c4dabe00');
      ctx.fillStyle = glow;
      ctx.fillRect(at.x - radius, at.y - radius - size.height * 0.1, radius * 2, radius * 2);
    }
    const frame = (direction + sprite.direction) % 8;
    ctx.save();
    if (active) ctx.filter = 'brightness(1.2) saturate(1.08) drop-shadow(0 0 5px #f6d68977)';
    const sourceX = definition.columns[frame];
    const fw = definition.columns[frame + 1] - sourceX,
      fh = definition.height;
    ctx.drawImage(
      image,
      sourceX,
      definition.y,
      fw,
      fh,
      at.x - size.width / 2,
      at.y - size.height * definition.pivot,
      size.width,
      size.height,
    );
    ctx.restore();
    if (sprite.kind === 'totem') {
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const phase = seconds * 0.55 + i * 2.1 + sprite.x;
        ctx.globalAlpha = 0.3 + (Math.sin(phase * 1.2) + 1) * 0.25;
        ctx.fillStyle = '#c2eee0';
        ctx.beginPath();
        ctx.arc(
          at.x + Math.sin(phase) * size.width * 0.24,
          at.y - size.height * (0.35 + i * 0.1) + Math.cos(phase) * 7,
          Math.max(0.7, scale * 1.5),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
