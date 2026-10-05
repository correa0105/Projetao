import { z } from 'zod';
import { effectPresetSchema, tokenEffectSchema } from './vtt-effects.js';
const id = z.string().uuid();
const coordinate = z.number().finite().min(-50000).max(50000);
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const media = z
  .string()
  .max(250)
  .refine(
    (p) =>
      p === '' ||
      /^\/api\/vtt\/assets\/[0-9a-f-]{36}$/.test(p) ||
      (/^\/vtt\/[\w/.-]+$/.test(p) && !p.includes('..')),
  );
export const pointSchema = z.object({ x: coordinate, y: coordinate }).strict();
export type Point = z.infer<typeof pointSchema>;
export const bossStyles = [
  'classic-red',
  'classic-ice',
  'classic-grass',
  'classic-oak',
  'evil',
] as const;
// Older rooms still load; obsolete looks are displayed as Classic Red.
const storedBossStyles = [
  ...bossStyles,
  'gears',
  'ooze',
  'royal',
  'segmented',
  'steampunk',
] as const;
export const bossStyleNames = [
  'Classic · Red',
  'Classic · Ice',
  'Classic · Grass',
  'Classic · Oak',
  'Evil',
];
export function visibleBossStyle(style: (typeof storedBossStyles)[number]) {
  return bossStyles.includes(style as (typeof bossStyles)[number]) ? style : 'classic-red';
}
export type BossBar = {
  tokenId: string;
  name: string;
  hp: number;
  maxHp: number;
  style: (typeof storedBossStyles)[number];
};
export const sheetSchema = z
  .object({
    source: z.string().max(100),
    race: z.string().max(100).default(''),
    class: z.string().max(100).default(''),
    level: z.number().int().min(0).max(100).default(1),
    stats: z.array(z.number().min(0).max(100)).length(6),
    speed: z.number().min(0).max(1000).default(30),
    biography: z.string().max(16000).default(''),
    details: z.string().max(40000).default(''),
  })
  .strict();
export const tokenSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(100),
    image: media.default(''),
    x: coordinate,
    y: coordinate,
    width: z.number().min(8).max(8000),
    height: z.number().min(8).max(8000),
    rotation: z.number().min(-360).max(360).default(0),
    level: z.number().finite().min(-10000).max(10000).default(0),
    flipX: z.boolean().default(false),
    flipY: z.boolean().default(false),
    color: color.default('#b98b4c'),
    layer: z.enum(['tokens', 'map', 'gm']).default('tokens'),
    locked: z.boolean().default(false),
    hidden: z.boolean().default(false),
    hp: z.number().min(-10000).max(100000).default(10),
    maxHp: z.number().min(1).max(100000).default(10),
    bossStyle: z.enum(storedBossStyles).nullable().default(null),
    deathAutomatic: z.boolean().default(false),
    deathAt: z.number().int().min(0).max(9999999999999).nullable().default(null),
    effects: z.array(tokenEffectSchema).max(10).default([]),
    ac: z.number().min(0).max(100).default(10),
    conditions: z.array(z.string().max(40)).max(30).default([]),
    notes: z.string().max(4000).default(''),
    vision: z.number().min(0).max(10000).default(60),
    light: z.number().min(0).max(10000).default(0),
    dimLight: z.number().min(0).max(10000).default(0),
    lightColor: color.default('#ffe0a0'),
    lightAngle: z.number().min(1).max(360).default(360),
    controller: z.string().max(100).nullable().default(null),
    characterId: id.nullable().default(null),
    sheet: sheetSchema.nullable().default(null),
  })
  .strict();
export type VttToken = z.infer<typeof tokenSchema>;
export const wallSchema = z
  .object({
    id,
    a: pointSchema,
    b: pointSchema,
    kind: z.enum(['wall', 'door', 'window']),
    open: z.boolean().default(false),
  })
  .strict();
export type VttWall = z.infer<typeof wallSchema>;
export const lightSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(100).default('Fonte de luz'),
    x: coordinate,
    y: coordinate,
    bright: z.number().min(0).max(10000).default(20),
    dim: z.number().min(0).max(10000).default(20),
    color: color.default('#ffe0a0'),
    rotation: z.number().min(-360).max(360).default(0),
    angle: z.number().min(1).max(360).default(360),
    enabled: z.boolean().default(true),
  })
  .strict();
export type VttLight = z.infer<typeof lightSchema>;
export const drawingSchema = z
  .object({
    id,
    kind: z.enum(['pen', 'rect', 'circle', 'cone', 'line', 'text']),
    points: z.array(pointSchema).min(1).max(1500),
    color: color,
    width: z.number().min(1).max(100),
    fill: z.boolean(),
    text: z.string().max(500).default(''),
    layer: z.enum(['map', 'tokens', 'gm']).default('tokens'),
  })
  .strict();
export type VttDrawing = z.infer<typeof drawingSchema>;
export const sceneSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(100),
    width: z.number().int().min(280).max(16000),
    height: z.number().int().min(280).max(16000),
    background: media,
    backgroundColor: color,
    backdropColor: color.default('#0e151d'),
    dominantBackdrop: z.boolean().default(false),
    folderId: id.nullable().default(null),
    archived: z.boolean().default(false),
    gmOpacity: z.number().min(0.05).max(1).default(0.45),
    gmDarkness: z.number().min(0).max(1).default(0.35),
    onLoadAudio: id.nullable().default(null),
    grid: z
      .object({
        type: z.enum(['square', 'hex-flat', 'hex-point', 'none']),
        size: z.number().min(10).max(500),
        scale: z.number().min(0.1).max(1000),
        unit: z.enum(['ft', 'm']),
        color,
        opacity: z.number().min(0).max(1),
        offsetX: z.number().min(-500).max(500),
        offsetY: z.number().min(-500).max(500),
        snap: z.boolean(),
        diagonal: z.enum(['euclidean', 'five', 'alternating', 'manhattan']),
      })
      .strict(),
    lighting: z.boolean(),
    ambient: z.number().min(0).max(1),
    fog: z.boolean(),
    fogMode: z.enum(['manual', 'vision']).default('manual'),
    restrictMovement: z.boolean(),
    reveals: z
      .array(
        z.object({ x: coordinate, y: coordinate, radius: z.number().min(5).max(30000) }).strict(),
      )
      .max(2000),
    fogAreas: z
      .array(
        z
          .object({ id, points: z.array(pointSchema).min(3).max(1000), reveal: z.boolean() })
          .strict(),
      )
      .max(3000)
      .default([]),
    tokens: z.array(tokenSchema).max(1000),
    walls: z.array(wallSchema).max(2000),
    lights: z.array(lightSchema).max(500).default([]),
    drawings: z.array(drawingSchema).max(2000),
  })
  .strict()
  .superRefine((scene, ctx) => {
    for (const key of ['tokens', 'walls', 'drawings', 'lights'] as const)
      if (new Set(scene[key].map((x) => x.id)).size !== scene[key].length)
        ctx.addIssue({ code: 'custom', message: 'Identificadores repetidos.', path: [key] });
  });
export type VttScene = z.infer<typeof sceneSchema>;
export const documentSchema = z
  .object({
    version: z.literal(1),
    effects: z.array(effectPresetSchema).max(100).default([]),
    folders: z
      .array(
        z.object({ id, name: z.string().trim().min(1).max(100), parentId: id.nullable() }).strict(),
      )
      .max(200)
      .default([]),
    custom: z
      .array(
        z
          .object({
            id: z.string().max(120),
            kind: z.enum(['monster', 'spell']),
            name: z.string().min(1).max(150),
            details: z.string().max(40000),
            hp: z.number().min(1).max(100000).default(10),
            ac: z.number().min(0).max(100).default(10),
            stats: z.array(z.number().min(0).max(100)).length(6).default([10, 10, 10, 10, 10, 10]),
            size: z.string().max(10).default('M'),
            level: z.number().int().min(0).max(20).default(0),
            type: z.string().max(100).default(''),
            cr: z.string().max(20).default('0'),
          })
          .strict(),
      )
      .max(2000)
      .default([]),
    name: z.string().trim().min(1).max(100),
    activeScene: id,
    scenes: z.array(sceneSchema).min(1).max(50),
    journal: z
      .array(
        z
          .object({
            id,
            title: z.string().min(1).max(100),
            text: z.string().max(40000),
            image: media,
            public: z.boolean(),
          })
          .strict(),
      )
      .max(200),
    macros: z
      .array(
        z.object({ id, name: z.string().min(1).max(60), formula: z.string().max(100) }).strict(),
      )
      .max(100),
    initiative: z
      .array(z.object({ tokenId: id, value: z.number().min(-100).max(1000) }).strict())
      .max(1000),
    round: z.number().int().min(1).max(10000),
    turn: z.number().int().min(0).max(999),
    music: z
      .object({
        assetId: id.nullable(),
        playing: z.boolean(),
        loop: z.boolean(),
        volume: z.number().min(0).max(1),
      })
      .strict(),
  })
  .strict()
  .superRefine((doc, ctx) => {
    if (!doc.scenes.some((s) => s.id === doc.activeScene))
      ctx.addIssue({ code: 'custom', message: 'Cena ativa inexistente.' });
    if (new Set(doc.scenes.map((s) => s.id)).size !== doc.scenes.length)
      ctx.addIssue({ code: 'custom', message: 'Cenas repetidas.' });
    if (new Set(doc.effects.map((e) => e.id)).size !== doc.effects.length)
      ctx.addIssue({ code: 'custom', message: 'Efeitos repetidos.' });
    const folders = new Map(doc.folders.map((f) => [f.id, f]));
    if (folders.size !== doc.folders.length)
      ctx.addIssue({ code: 'custom', message: 'Pastas repetidas.' });
    for (const folder of doc.folders) {
      const seen = new Set([folder.id]);
      let parent = folder.parentId;
      while (parent) {
        if (seen.has(parent) || !folders.has(parent) || seen.size > 12) {
          ctx.addIssue({ code: 'custom', message: 'A pasta tem um vínculo inválido ou circular.' });
          break;
        }
        seen.add(parent);
        parent = folders.get(parent)!.parentId;
      }
    }
    for (const scene of doc.scenes)
      if (scene.folderId && !folders.has(scene.folderId))
        ctx.addIssue({ code: 'custom', message: 'Pasta do mapa inexistente.' });
    if (doc.scenes.find((s) => s.id === doc.activeScene)?.archived)
      ctx.addIssue({ code: 'custom', message: 'O mapa ativo precisa estar fora do arquivo.' });
  });
export type VttDocument = z.infer<typeof documentSchema>;
export type VttAsset = {
  id: string;
  name: string;
  kind: 'image' | 'audio';
  path: string;
  width: number | null;
  height: number | null;
};
export type VttMessage = {
  id: string;
  author: string;
  text: string;
  roll: {
    formula: string;
    dice: number[];
    total: number;
    throws?: { sides: number; value: number }[];
    highlights?: { value: number; kind: 'surge' | 'mishap' | 'match' }[];
  } | null;
  spell?: {
    id: string;
    name: string;
    details: string;
    level?: number;
    school?: string;
    time?: string;
    range?: string;
    duration?: string;
    components?: string;
  } | null;
  private: boolean;
  created_at: string;
};
export type VttState = {
  id: string;
  revision: number;
  document: VttDocument;
  is_gm: boolean;
  role: 'master' | 'player' | 'spectator';
  viewingUser: string | null;
  viewpoints: { id: string; name: string }[];
  invite?: string;
  assets: VttAsset[];
  members: { id: string; name: string; role: 'master' | 'player' | 'spectator' }[];
  messages: VttMessage[];
  bossBars: BossBar[];
  focusSignal: VttFocusSignal | null;
};
export type VttFocusSignal = Point & { id: string; sceneId: string; at: number };
export function applyTokenDeath(token: VttToken, previousHp: number, now = Date.now()) {
  if (token.hp > 0 && previousHp <= 0) token.deathAt = null;
  if (token.deathAutomatic && previousHp > 0 && token.hp <= 0) token.deathAt = now;
}
export function sceneBossBars(scene: VttScene): BossBar[] {
  return scene.tokens
    .filter((t) => t.bossStyle !== null)
    .map((t) => ({ tokenId: t.id, name: t.name, hp: t.hp, maxHp: t.maxHp, style: t.bossStyle! }));
}
export const conditions = [
  'Cego',
  'Enfeitiçado',
  'Surdo',
  'Exausto',
  'Amedrontado',
  'Agarrado',
  'Incapacitado',
  'Invisível',
  'Paralisado',
  'Petrificado',
  'Envenenado',
  'Caído',
  'Impedido',
  'Atordoado',
  'Inconsciente',
  'Concentração',
];
export function newScene(id: string, name = 'Novo mapa'): VttScene {
  return sceneSchema.parse({
    id,
    name,
    width: 1750,
    height: 1750,
    background: '',
    backgroundColor: '#222a33',
    grid: {
      type: 'square',
      size: 70,
      scale: 5,
      unit: 'ft',
      color: '#8392a3',
      opacity: 0.18,
      offsetX: 0,
      offsetY: 0,
      snap: true,
      diagonal: 'five',
    },
    lighting: true,
    ambient: 0,
    fog: true,
    fogMode: 'vision',
    restrictMovement: true,
    reveals: [],
    tokens: [],
    walls: [],
    drawings: [],
  });
}
export function newDocument(id: string): VttDocument {
  const scene = newScene(id, 'Primeiro mapa');
  return {
    version: 1,
    effects: [],
    folders: [],
    custom: [],
    name: 'Mesa da Alvorada',
    activeScene: id,
    scenes: [scene],
    journal: [],
    macros: [],
    initiative: [],
    round: 1,
    turn: 0,
    music: { assetId: null, playing: false, loop: true, volume: 0.45 },
  };
}
/** Stable order within each layer; decimals and negative levels are intentional. */
export function orderedTokens(tokens: VttToken[]) {
  const layers = { map: 0, tokens: 1, gm: 2 };
  return [...tokens].sort((a, b) => layers[a.layer] - layers[b.layer] || a.level - b.level);
}
export function folderTrail(doc: VttDocument, id: string | null) {
  const trail: VttDocument['folders'] = [];
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const folder = doc.folders.find((f) => f.id === id);
    if (!folder) break;
    trail.unshift(folder);
    id = folder.parentId;
  }
  return trail;
}
export function activateScene(doc: VttDocument, id: string) {
  const scene = doc.scenes.find((s) => s.id === id);
  if (!scene || scene.archived) return;
  doc.activeScene = id;
  if (scene.onLoadAudio) doc.music = { ...doc.music, assetId: scene.onLoadAudio, playing: true };
}
export function newToken(id: string, scene: VttScene): VttToken {
  return tokenSchema.parse({
    id,
    name: 'Novo token',
    x: scene.width / 2,
    y: scene.height / 2,
    width: scene.grid.size,
    height: scene.grid.size,
  });
}
export function snapPoint(p: Point, grid: VttScene['grid']): Point {
  if (!grid.snap || grid.type === 'none') return p;
  if (grid.type === 'square')
    return {
      x: Math.round((p.x - grid.offsetX) / grid.size) * grid.size + grid.offsetX,
      y: Math.round((p.y - grid.offsetY) / grid.size) * grid.size + grid.offsetY,
    };
  const flat = grid.type === 'hex-flat',
    x = p.x - grid.offsetX,
    y = p.y - grid.offsetY,
    r = grid.size / Math.sqrt(3);
  let q = flat ? (2 * x) / (3 * r) : (Math.sqrt(3) * x - y) / (3 * r),
    s = flat ? (Math.sqrt(3) * y - x) / (3 * r) : (2 * y) / (3 * r);
  const cube = [q, -q - s, s],
    rounded = cube.map(Math.round),
    dif = cube.map((v, i) => Math.abs(v - rounded[i]));
  const max = dif.indexOf(Math.max(...dif));
  rounded[max] = -rounded[(max + 1) % 3] - rounded[(max + 2) % 3];
  q = rounded[0];
  s = rounded[2];
  return {
    x: (flat ? 1.5 * r * q : Math.sqrt(3) * r * (q + s / 2)) + grid.offsetX,
    y: (flat ? Math.sqrt(3) * r * (s + q / 2) : 1.5 * r * s) + grid.offsetY,
  };
}
export function distance(a: Point, b: Point, g: VttScene['grid']) {
  const x = Math.abs(a.x - b.x) / g.size,
    y = Math.abs(a.y - b.y) / g.size;
  if (g.type.startsWith('hex')) {
    const r = g.size / Math.sqrt(3),
      flat = g.type === 'hex-flat';
    const q = flat
        ? (2 * (b.x - a.x)) / (3 * r)
        : (Math.sqrt(3) * (b.x - a.x) - (b.y - a.y)) / (3 * r),
      s = flat ? (Math.sqrt(3) * (b.y - a.y) - (b.x - a.x)) / (3 * r) : (2 * (b.y - a.y)) / (3 * r);
    return ((Math.abs(q) + Math.abs(s) + Math.abs(q + s)) / 2) * g.scale;
  }
  return (
    (g.diagonal === 'five'
      ? Math.max(x, y)
      : g.diagonal === 'alternating'
        ? Math.max(x, y) + Math.floor(Math.min(x, y) / 2)
        : g.diagonal === 'manhattan'
          ? x + y
          : Math.hypot(x, y)) * g.scale
  );
}
export function intersection(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
  endpoints = false,
): Point | null {
  const rx = b.x - a.x,
    ry = b.y - a.y,
    sx = d.x - c.x,
    sy = d.y - c.y,
    cross = rx * sy - ry * sx;
  if (Math.abs(cross) < 1e-9) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / cross,
    u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / cross;
  return (endpoints ? t >= 0 && t <= 1 : t > 1e-5 && t < 1 - 1e-5) && u >= 0 && u <= 1
    ? { x: a.x + t * rx, y: a.y + t * ry }
    : null;
}
export function blockingWalls(s: VttScene, movement = false) {
  return s.walls.filter((w) => !w.open && (movement || w.kind !== 'window'));
}
/** Split a wall at a snapped opening; never remove unrelated wall sections. */
export function carveOpening(s: VttScene, opening: VttWall, createId: () => string) {
  if (opening.kind === 'wall') return;
  const p = opening.a,
    q = opening.b;
  const wall = s.walls.find((w) => {
    if (w.kind !== 'wall') return false;
    const dx = w.b.x - w.a.x,
      dy = w.b.y - w.a.y,
      length = Math.hypot(dx, dy);
    if (length < 1) return false;
    const onLine = (v: Point) => Math.abs((v.x - w.a.x) * dy - (v.y - w.a.y) * dx) / length <= 5;
    const projected = (v: Point) => ((v.x - w.a.x) * dx + (v.y - w.a.y) * dy) / (length * length);
    return (
      onLine(p) &&
      onLine(q) &&
      projected(p) >= -0.01 &&
      projected(p) <= 1.01 &&
      projected(q) >= -0.01 &&
      projected(q) <= 1.01
    );
  });
  if (!wall) return;
  const dx = wall.b.x - wall.a.x,
    dy = wall.b.y - wall.a.y,
    length2 = dx * dx + dy * dy;
  const project = (v: Point) =>
    Math.max(0, Math.min(1, ((v.x - wall.a.x) * dx + (v.y - wall.a.y) * dy) / length2));
  const [a, b] = [project(p), project(q)].sort((a, b) => a - b);
  opening.a = { x: wall.a.x + dx * a, y: wall.a.y + dy * a };
  opening.b = { x: wall.a.x + dx * b, y: wall.a.y + dy * b };
  s.walls = s.walls.filter((w) => w.id !== wall.id);
  if (a > 0.001) s.walls.push({ ...wall, b: { ...opening.a } });
  if (b < 0.999)
    s.walls.push({ ...wall, id: a > 0.001 ? createId() : wall.id, a: { ...opening.b } });
}
export function sceneLights(s: VttScene) {
  return [
    ...s.lights.filter((l) => l.enabled),
    ...s.tokens
      .filter((t) => !t.hidden && t.layer !== 'gm' && t.light + t.dimLight > 0)
      .map((t) => ({
        id: t.id,
        name: t.name,
        x: t.x,
        y: t.y,
        bright: t.light,
        dim: t.dimLight,
        color: t.lightColor,
        rotation: t.rotation,
        angle: t.lightAngle,
        enabled: true,
      })),
  ];
}
export function inLight(p: Point, s: VttScene) {
  return (
    s.ambient > 0.05 ||
    sceneLights(s).some(
      (l) =>
        visiblePoint(l, p, s, visionPixels(l.bright + l.dim, s)) &&
        (l.angle === 360 ||
          Math.abs(
            (((Math.atan2(p.y - l.y, p.x - l.x) * 180) / Math.PI - l.rotation + 540) % 360) - 180,
          ) <=
            l.angle / 2),
    )
  );
}
export function viewerSees(origin: VttToken, p: Point, s: VttScene) {
  if (!visiblePoint(origin, p, s, 50000)) return false;
  if (!s.lighting && !(s.fog && s.fogMode === 'vision')) return true;
  return inLight(p, s) || visiblePoint(origin, p, s, visionPixels(origin.vision, s));
}
export function visionPixels(feet: number, scene: VttScene) {
  return ((feet * (scene.grid.unit === 'm' ? 0.3048 : 1)) / scene.grid.scale) * scene.grid.size;
}
export function activateTokenVision(scene: VttScene) {
  if (!scene.lighting || scene.fogMode === 'manual') scene.ambient = 0;
  scene.lighting = true;
  scene.fog = true;
  scene.fogMode = 'vision';
}
export function manualFogSees(p: Point, scene: VttScene) {
  let visible = scene.reveals.some((r) => Math.hypot(r.x - p.x, r.y - p.y) <= r.radius);
  for (const area of scene.fogAreas) {
    let inside = false;
    for (let i = 0, j = area.points.length - 1; i < area.points.length; j = i++) {
      const a = area.points[i],
        b = area.points[j];
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
        inside = !inside;
    }
    if (inside) visible = area.reveal;
  }
  return visible;
}
export function visiblePoint(origin: Point, target: Point, s: VttScene, radius: number) {
  return (
    Math.hypot(origin.x - target.x, origin.y - target.y) <= radius &&
    !blockingWalls(s).some((w) => intersection(origin, target, w.a, w.b))
  );
}
export function sightPolygon(
  origin: Point,
  radius: number,
  s: VttScene,
  rotation = 0,
  cone = 360,
): Point[] {
  const walls = blockingWalls(s),
    angles: number[] = [],
    facing = (rotation * Math.PI) / 180,
    half = (cone * Math.PI) / 360;
  for (let i = 0; i <= 180; i++) angles.push(facing - half + (2 * half * i) / 180);
  for (const w of walls)
    for (const p of [w.a, w.b]) {
      let angle = Math.atan2(p.y - origin.y, p.x - origin.x);
      while (angle - facing > Math.PI) angle -= 2 * Math.PI;
      while (angle - facing < -Math.PI) angle += 2 * Math.PI;
      if (Math.abs(angle - facing) <= half) angles.push(angle - 0.0001, angle, angle + 0.0001);
    }
  angles.sort((a, b) => a - b);
  const vertices = angles.map((angle) => {
    let target = { x: origin.x + Math.cos(angle) * radius, y: origin.y + Math.sin(angle) * radius };
    for (const w of walls) {
      const hit = intersection(origin, target, w.a, w.b);
      if (hit) target = hit;
    }
    return target;
  });
  return cone < 360 ? [origin, ...vertices] : vertices;
}
