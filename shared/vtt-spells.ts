import { z } from 'zod';
import catalog from './vtt-spell-profiles.json';
import { distance, type Point, type VttScene, type VttToken } from './vtt';
export type SpellShape = 'sphere' | 'cone' | 'cube' | 'line' | 'wall' | 'ring';
export type SpellProfile = {
  id: string;
  name: string;
  level: number;
  mode: 'self' | 'targets' | 'point' | 'area';
  range: number;
  shape: SpellShape | null;
  size: number;
  width: number;
  origin: string;
  count: number;
  increment: number;
  repeat: boolean;
  areas: number;
  concentration: boolean;
  duration: number | null;
  follow: boolean;
  movable: boolean;
  higher: string;
  visual: {
    family: string;
    color: string;
    light: string;
    motifs: string[];
    signature: number;
    arms: number;
    twist: number;
    pulse: number;
    delivery: string;
  };
  sizeIncrement?: number;
  chain?: number;
  chainFromLast?: boolean;
  areaFromTargets?: boolean;
  conditional?: boolean;
  cantripBeams?: boolean;
  contiguous?: boolean;
  exactAreas?: boolean;
  includeSelf?: boolean;
  undead?: boolean;
  ethereal?: boolean;
  objectBudget?: boolean;
  destinationRange?: number;
  breath?: { shape: SpellShape; size: number };
  alternatives?: {
    label: string;
    count?: number;
    size?: number;
    shape?: SpellShape;
    width?: number;
    areas?: number;
    minSlot?: number;
    element?: string;
  }[];
};
export const spellProfiles = catalog as SpellProfile[];
export function spellProfile(idOrName: string) {
  const id = idOrName.toLowerCase();
  return spellProfiles.find(
    (s) => s.id === id || s.id === 'spell-' + id || s.name.toLowerCase() === id,
  );
}
export type SpellPlacement = { x: number; y: number; angle: number };
const placement = z
  .object({
    x: z.number().finite().min(-50000).max(50000),
    y: z.number().finite().min(-50000).max(50000),
    angle: z
      .number()
      .finite()
      .min(-Math.PI * 2)
      .max(Math.PI * 2),
  })
  .strict();
export const spellCastSchema = z
  .object({
    actor_id: z.string().uuid(),
    scene_id: z.string().uuid(),
    spell_id: z.string().max(120).optional(),
    action_id: z.string().max(120).optional(),
    effect_id: z.string().uuid().optional(),
    slot: z.number().int().min(0).max(9),
    variant: z.number().int().min(0).max(10).default(0),
    targets: z.array(z.string().uuid()).max(100),
    points: z.array(placement).max(50),
    free: z.boolean().default(false),
    idempotency_key: z.string().uuid(),
  })
  .strict()
  .refine(
    (s) => [s.spell_id, s.action_id, s.effect_id].filter(Boolean).length === 1,
    'Escolha uma magia ou habilidade.',
  );
export const spellMoveSchema = z
  .object({ scene_id: z.string().uuid(), points: z.array(placement).min(1).max(50) })
  .strict();
export type SpellCastCommand = z.infer<typeof spellCastSchema>;
export type SpellEffect = {
  id: string;
  sceneId: string;
  actorId: string;
  spellId: string;
  name: string;
  slot: number;
  variant: number;
  targets: string[];
  points: SpellPlacement[];
  profile: SpellProfile;
  started: number;
  expires: number | null;
  concentration: boolean;
  persistent: boolean;
  characterId?: string;
};
export function preparedSpell(
  base: SpellProfile,
  slot: number,
  level = 1,
  variant = 0,
): SpellProfile {
  const delta = Math.max(0, slot - base.level),
    p = {
      ...base,
      count: base.count + (base.increment || 0) * delta,
      size: base.size + (base.sizeIncrement || 0) * delta,
    };
  if (base.cantripBeams) p.count = level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1;
  if (base.id === 'spell-spare-the-dying')
    p.range = 15 * (level >= 17 ? 8 : level >= 11 ? 4 : level >= 5 ? 2 : 1);
  if (base.undead) p.count = slot >= 9 ? 6 : slot >= 8 ? 5 : slot >= 7 ? 4 : 3;
  // Animate Objects is set to the actual spellcasting modifier by the caller.
  if (base.objectBudget) p.count = base.count;
  if (base.ethereal && slot > 7) {
    p.mode = 'targets';
    p.range = 10;
    p.count = 3 * (slot - 7);
    p.includeSelf = false;
  }
  const option = base.alternatives?.[variant];
  if (option) {
    if (option.count !== undefined)
      p.count =
        base.undead && variant === 0 ? p.count : option.count + (base.increment || 0) * delta;
    if (option.shape) p.shape = option.shape;
    if (option.size !== undefined) p.size = option.size + (base.sizeIncrement || 0) * delta;
    if (option.width !== undefined) p.width = option.width;
    if (option.areas !== undefined) p.areas = option.areas;
    if (option.element) p.visual = elementalVisual(option.element, base.visual);
  }
  if (base.id === 'spell-bestow-curse') {
    p.concentration = slot < 5;
    p.duration = slot >= 9 ? null : slot >= 7 ? 86400 : slot >= 5 ? 28800 : slot === 4 ? 600 : 60;
  }
  if (base.id === 'spell-major-image' && slot >= 4) {
    p.concentration = false;
    p.duration = null;
  }
  if (base.id === 'spell-hex')
    p.duration = slot >= 5 ? 86400 : slot >= 3 ? 28800 : slot >= 2 ? 14400 : 3600;
  if (base.name === "Hunter's Mark") p.duration = slot >= 5 ? 86400 : slot >= 3 ? 28800 : 3600;
  if (base.id === 'spell-dominate-beast')
    p.duration = slot >= 7 ? 28800 : slot >= 6 ? 3600 : slot >= 5 ? 600 : 60;
  if (base.id === 'spell-dominate-person')
    p.duration = slot >= 8 ? 28800 : slot >= 7 ? 3600 : slot >= 6 ? 600 : 60;
  if (base.id === 'spell-dominate-monster' && slot === 9) p.duration = 28800;
  if (base.id === 'spell-animal-messenger') p.duration = 86400 + delta * 172800;
  if (base.id === 'spell-magic-circle') p.duration = 3600 * (delta + 1);
  if (base.id === 'spell-mass-suggestion')
    p.duration = slot >= 9 ? 366 * 86400 : slot >= 8 ? 30 * 86400 : slot >= 7 ? 10 * 86400 : 86400;
  return p;
}
export function elementalVisual(element: string, base: SpellProfile['visual']) {
  const palettes: Record<string, [string, string, string[]]> = {
    fire: ['#e77929', '#ffe0a2', ['flame', 'ember']],
    frost: ['#8fd6e9', '#e9fcff', ['crystal', 'mist']],
    lightning: ['#7dbaed', '#e4f6ff', ['bolt', 'branch']],
    acid: ['#9eae47', '#d9e8a0', ['droplet', 'splash']],
    poison: ['#81966b', '#c9d8a7', ['mist', 'filament']],
  };
  const [color, light, motifs] = palettes[element] || palettes.fire;
  return { ...base, family: element, color, light, motifs };
}
export function grantedBreath(effect: SpellEffect): SpellProfile | null {
  const breath = effect.profile.breath;
  if (!breath) return null;
  return {
    ...effect.profile,
    id: effect.spellId + '-exhalation',
    name: effect.name + ' · baforada',
    level: 0,
    mode: 'area',
    range: 0,
    shape: breath.shape,
    size: breath.size,
    width: 5,
    origin: 'caster-face',
    count: 1,
    increment: 0,
    areas: 1,
    concentration: false,
    duration: 0,
    follow: false,
    movable: false,
    higher: '',
    alternatives: undefined,
    breath: undefined,
  };
}
export const shapeNames: Record<SpellShape, string> = {
  sphere: 'Raio',
  cone: 'Cone',
  cube: 'Quadrado',
  line: 'Linha',
  wall: 'Parede',
  ring: 'Anel',
};
export function pixelsPerFoot(grid: VttScene['grid']) {
  return grid.size / (grid.scale * (grid.unit === 'm' ? 1 / 0.3048 : 1));
}
export function feetDistance(a: Point, b: Point, grid: VttScene['grid']) {
  return distance(a, b, grid) * (grid.unit === 'm' ? 1 / 0.3048 : 1);
}
export function spellOrigin(p: SpellProfile, actor: VttToken, point: SpellPlacement) {
  if (p.follow || p.origin === 'caster') return { ...point, x: actor.x, y: actor.y };
  if (p.origin === 'caster-face') {
    const offset =
      (Math.abs(Math.cos(point.angle)) * actor.width +
        Math.abs(Math.sin(point.angle)) * actor.height) /
      2;
    return {
      ...point,
      x: actor.x + Math.cos(point.angle) * offset,
      y: actor.y + Math.sin(point.angle) * offset,
    };
  }
  return point;
}
export function insideSpell(
  point: Point,
  p: SpellProfile,
  at: SpellPlacement,
  grid: VttScene['grid'],
) {
  if (!p.shape) return false;
  const f = pixelsPerFoot(grid),
    size = p.size * f,
    width = p.width * f,
    dx = point.x - at.x,
    dy = point.y - at.y;
  const x = dx * Math.cos(at.angle) + dy * Math.sin(at.angle),
    y = -dx * Math.sin(at.angle) + dy * Math.cos(at.angle);
  if (p.shape === 'sphere') return dx * dx + dy * dy <= size * size;
  if (p.shape === 'ring') {
    const d = Math.hypot(dx, dy);
    return Math.abs(d - size) <= width / 2;
  }
  if (p.shape === 'cone') return x >= 0 && x <= size && Math.abs(y) <= x / 2;
  if (p.shape === 'line') return x >= 0 && x <= size && Math.abs(y) <= width / 2;
  if (p.shape === 'wall') return Math.abs(x) <= size / 2 && Math.abs(y) <= Math.max(width, 1) / 2;
  return p.origin === 'caster-face'
    ? x >= 0 && x <= size && Math.abs(y) <= size / 2
    : Math.abs(x) <= size / 2 && Math.abs(y) <= size / 2;
}
export function spellCells(
  p: SpellProfile,
  at: SpellPlacement,
  scene: VttScene,
  viewport?: { left: number; top: number; right: number; bottom: number },
) {
  const g = scene.grid,
    reach = (p.size + p.width) * pixelsPerFoot(g) + g.size;
  const left = Math.max(0, at.x - reach, viewport?.left ?? 0),
    right = Math.min(scene.width, at.x + reach, viewport?.right ?? scene.width);
  const top = Math.max(0, at.y - reach, viewport?.top ?? 0),
    bottom = Math.min(scene.height, at.y + reach, viewport?.bottom ?? scene.height);
  const cells: Point[] = [];
  for (let y = Math.floor((top - g.offsetY) / g.size) * g.size + g.offsetY; y < bottom; y += g.size)
    for (
      let x = Math.floor((left - g.offsetX) / g.size) * g.size + g.offsetX;
      x < right;
      x += g.size
    ) {
      // Half of a cell is the table's standard inclusion rule: sample a 3×3 lattice,
      // counting four of nine samples. Exact shape outlines remain visible as well.
      let n = 0;
      for (const fy of [0.15, 0.5, 0.85])
        for (const fx of [0.15, 0.5, 0.85])
          if (insideSpell({ x: x + g.size * fx, y: y + g.size * fy }, p, at, g)) n++;
      if (n >= 4 || ((p.shape === 'line' || p.shape === 'wall' || p.shape === 'ring') && n > 0))
        cells.push({ x, y });
      if (cells.length >= 12000) return cells;
    }
  return cells;
}
export function areaContainsToken(
  t: VttToken,
  p: SpellProfile,
  points: SpellPlacement[],
  s: VttScene,
) {
  return points.some(
    (at) =>
      insideSpell(t, p, at, s.grid) ||
      [-0.4, 0, 0.4].some((x) =>
        [-0.4, 0, 0.4].some((y) =>
          insideSpell({ x: t.x + x * t.width, y: t.y + y * t.height }, p, at, s.grid),
        ),
      ),
  );
}
export function breathProfile(action: {
  id: string;
  name: string;
  description: string;
}): SpellProfile | null {
  const text = action.description;
  const cone =
    text.match(/(\d+)[ -]*(?:foot|ft|p[eé]s?)[ -]*(?:Cone|cone)/i) ||
    text.match(/cone[^.]{0,25}?(\d+)\s*(?:p[eé]s|ft|feet)/i);
  const line =
    text.match(/(\d+)[ -]*(?:foot|ft|p[eé]s?)[ -]*long[^.\n]{0,40}?(?:Line|linha)/i) ||
    text.match(/(\d+)[ -]*(?:foot|ft|p[eé]s?)[ -]*(?:Line|linha)/i) ||
    text.match(/(?:Line|linha)[^.]{0,40}?(\d+)\s*(?:feet|ft|p[eé]s)/i);
  const radius =
    text.match(/(\d+)[ -]*(?:foot|ft|p[eé]s?)[ -]*(?:radius|raio)/i) ||
    text.match(/raio[^.]{0,15}?(\d+)\s*(?:feet|ft|p[eé]s)/i);
  if (!cone && !line && !radius) return null;
  const family = /acid|ácid/i.test(text)
    ? 'acid'
    : /cold|frio|gelo/i.test(text)
      ? 'frost'
      : /lightning|elétric/i.test(text)
        ? 'lightning'
        : /poison|veneno/i.test(text)
          ? 'poison'
          : 'fire';
  const base = spellProfiles.find((s) => s.visual.family === family)!;
  const size = Number((cone || line || radius)![1]);
  return {
    ...base,
    id: action.id,
    name: action.name,
    level: 0,
    mode: 'area',
    origin: radius ? 'point' : 'caster',
    shape: cone ? 'cone' : line ? 'line' : 'sphere',
    size,
    width: Number(text.match(/(\d+)[ -]*(?:foot|ft|p[eé]s?)[ -]*(?:wide|largura)/i)?.[1] || 5),
    range: radius ? size : size,
    areas: 1,
    duration: 0,
    concentration: false,
    follow: false,
    increment: 0,
    repeat: false,
    count: 1,
    higher: '',
    visual: {
      ...base.visual,
      motifs: cone ? ['dragon', ...base.visual.motifs] : base.visual.motifs,
    },
  };
}
export function validSpellSelection(p: SpellProfile, targets: string[], points: SpellPlacement[]) {
  if (p.mode === 'targets')
    return (
      targets.length > 0 &&
      targets.length <= p.count &&
      (!p.destinationRange || points.length === 1) &&
      (!p.repeat || targets.length === p.count) &&
      (p.repeat || new Set(targets).size === targets.length)
    );
  if (p.mode === 'area' || p.mode === 'point')
    return (
      points.length > 0 && points.length <= p.areas && (!p.exactAreas || points.length === p.areas)
    );
  return true;
}
