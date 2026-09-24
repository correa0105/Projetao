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
export type KingdomViewport = {
  width: number;
  height: number;
  scale: number;
  tilt: number;
  mapWidth: number;
  mapHeight: number;
};
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

export function projectKingdom(x: number, y: number, view: KingdomView, viewport: KingdomViewport) {
  const cos = Math.cos(view.angle),
    sin = Math.sin(view.angle);
  const dx = x - view.x,
    dy = y - view.y;
  const scale = view.zoom * viewport.scale;
  return {
    x: viewport.width * 0.5 + (dx * cos - dy * sin) * scale,
    y: viewport.height * KINGDOM_CAMERA_Y + (dx * sin + dy * cos) * scale * viewport.tilt,
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
  const dy = (y - viewport.height * KINGDOM_CAMERA_Y) / (scale * viewport.tilt);
  const cos = Math.cos(view.angle),
    sin = Math.sin(view.angle);
  return { x: view.x + dx * cos + dy * sin, y: view.y - dx * sin + dy * cos };
}

export function kingdomDirection(angle: number) {
  return ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
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
  selected: readonly string[],
  hovered: string | null,
  seconds: number,
) {
  const { width, height } = viewport;
  const scale = viewport.scale * view.zoom;
  const cos = Math.cos(view.angle),
    sin = Math.sin(view.angle);
  const origin = projectKingdom(0, 0, view, viewport);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#202b29';
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.transform(
    cos * scale,
    sin * scale * viewport.tilt,
    -sin * scale,
    cos * scale * viewport.tilt,
    origin.x,
    origin.y,
  );
  const left = -viewport.mapWidth / 2;
  const top = -viewport.mapHeight / 2;
  ctx.drawImage(assets.ground, left, top, viewport.mapWidth, viewport.mapHeight);
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
      selected.includes(sprite.id) ||
      sprite.id === hovered ||
      (sprite.marker?.id != null && selected.includes(sprite.marker.id)) ||
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
