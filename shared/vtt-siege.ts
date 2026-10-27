import type { Point, VttToken, VttScene } from './vtt';
export const siegeKinds = ['cannon', 'harpoon'] as const;
export type SiegeKind = (typeof siegeKinds)[number];
export const siegeDefinitions = {
  cannon: {
    name: 'Canhão',
    damage: '8d10',
    damageType: 'concussão',
    range: 600,
    longRange: 2400,
    ac: 19,
    hp: 75,
    ammunition: 'Bala e pólvora',
    description: 'Canhão de cerco · D&D 5e (2014).',
    source: 'https://www.dndbeyond.com/posts/1142-monster-spotlight-lay-siege-to-your-enemies-with',
  },
  harpoon: {
    name: 'Arpão naval',
    damage: '3d10',
    damageType: 'perfuração',
    range: 120,
    longRange: 480,
    ac: 15,
    hp: 50,
    ammunition: 'Arpão',
    description: 'Lançador de arpão com perfil de balista · D&D 5e (2014).',
    source: 'https://www.dndbeyond.com/vehicles/sailing-ship',
  },
} as const;
export const siegeImage = (kind: SiegeKind, loaded = false) =>
  `/vtt/siege-20261026/${kind === 'cannon' ? 'cannon-v1' : loaded ? 'harpoon-loaded-v1' : 'harpoon-empty-v1'}.png`;
export type SiegeAim = Point & {
  targetId: string | null;
  origin: Point;
  rotation: number;
  mode: 'normal' | 'advantage' | 'disadvantage';
  surface?: 'auto' | 'ground' | 'water';
};
export type SiegeLoad = { id: string; at: number; private: boolean; muted: boolean };
export type SiegeImpact = {
  id: string;
  shotId: string;
  sceneId: string;
  weaponId: string;
  kind: SiegeKind;
  point: Point;
  rotation: number;
  at: number;
  private: boolean;
  surface: 'ground' | 'solid';
  targetId: string | null;
  local?: Point & { rotation: number };
  // Null deliberately hides a source that is outside the viewer's permission.
  ropeOrigin?: Point | null;
  ropeCutAt?: number;
};
export type SiegeShot = {
  id: string;
  at: number;
  sceneId: string;
  kind: SiegeKind;
  from: Point;
  to: Point;
  hit: boolean;
  critical: boolean;
  targetId: string | null;
  damage: number | null;
  attack: number;
  private: boolean;
  muted: boolean;
};
export type SiegeWeapon = {
  id: string;
  kind: SiegeKind;
  sceneId: string;
  stage: 'empty' | 'loaded' | 'aimed';
  ammo: number;
  revision: number;
  aim: SiegeAim | null;
  lastShot: SiegeShot | null;
  lastLoad?: SiegeLoad | null;
  muted: boolean;
  ropeAttached?: boolean;
};
export type SiegeSnapshot = {
  roomId: string;
  sceneId: string;
  serverTime: number;
  weapons: SiegeWeapon[];
  impacts?: SiegeImpact[];
  turn: {
    active: boolean;
    actorId: string | null;
    actions: { actorId: string; used: number; budget: number }[];
  };
};
export type SiegeCommand =
  | { kind: 'create'; weaponKind: SiegeKind; position?: Point }
  | { kind: 'load' | 'fire'; weaponId: string; revision: number; actorId: string }
  | {
      kind: 'aim';
      weaponId: string;
      revision: number;
      actorId: string;
      point: Point;
      mode: 'normal' | 'advantage' | 'disadvantage';
      surface?: 'auto' | 'ground' | 'water';
    }
  | { kind: 'settings'; weaponId: string; revision: number; ammunition: number; muted: boolean }
  | { kind: 'cutRope'; weaponId: string; revision: number; actorId?: string }
  | { kind: 'extraAction'; actorId: string }
  | SiegeImpactCommand;
export type SiegeImpactCommand = { kind: 'removeImpact'; impactId: string };
export const siegeAimStale = (token: VttToken, aim: SiegeAim) =>
  Math.hypot(token.x - aim.origin.x, token.y - aim.origin.y) > 0.1 ||
  Math.abs(((((token.rotation - aim.rotation) % 360) + 540) % 360) - 180) > 0.1 ||
  token.flipX ||
  token.flipY;
export const siegeStageNames = {
  empty: 'Sem carga',
  loaded: 'Carregado',
  aimed: 'Pronto para disparar',
};
export const siegeDistance = (a: Point, b: Point, s: VttScene) =>
  (Math.hypot(a.x - b.x, a.y - b.y) / s.grid.size) * s.grid.scale;
export const siegeBearing = (from: Point, to: Point) =>
  ((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI + 450) % 360;
export function siegeAdjacent(actor: VttToken, weapon: VttToken, s: VttScene) {
  const dx = Math.max(0, Math.abs(actor.x - weapon.x) - (actor.width + weapon.width) / 2),
    dy = Math.max(0, Math.abs(actor.y - weapon.y) - (actor.height + weapon.height) / 2);
  return (Math.hypot(dx, dy) / s.grid.size) * s.grid.scale <= 5.01;
}
export function siegePointInToken(p: Point, t: VttToken) {
  const a = (-t.rotation * Math.PI) / 180,
    x = p.x - t.x,
    y = p.y - t.y;
  return (
    Math.abs(x * Math.cos(a) - y * Math.sin(a)) <= t.width / 2 + 1 &&
    Math.abs(x * Math.sin(a) + y * Math.cos(a)) <= t.height / 2 + 1
  );
}
export function siegeImpactPosition(impact: SiegeImpact, scene: VttScene) {
  const t = impact.targetId && scene.tokens.find((t) => t.id === impact.targetId);
  if (!t || !impact.local) return { point: impact.point, rotation: impact.rotation };
  const a = (t.rotation * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a),
    x = impact.local.x * t.width * (t.flipX ? -1 : 1),
    y = impact.local.y * t.height * (t.flipY ? -1 : 1);
  const direction = (impact.local.rotation * Math.PI) / 180;
  return {
    point: { x: t.x + x * c - y * s, y: t.y + x * s + y * c },
    rotation:
      (Math.atan2(
        Math.sin(direction) * (t.flipY ? -1 : 1),
        Math.cos(direction) * (t.flipX ? -1 : 1),
      ) *
        180) /
        Math.PI +
      t.rotation,
  };
}
export function siegeRopeOrigin(impact: SiegeImpact, scene: VttScene): Point | null {
  if (impact.kind !== 'harpoon' || impact.ropeCutAt || impact.ropeOrigin === null) return null;
  const weapon = scene.tokens.find((t) => t.id === impact.weaponId);
  if (!weapon) return impact.ropeOrigin || null;
  const angle = ((weapon.rotation - 90 + (weapon.flipY ? 180 : 0)) * Math.PI) / 180;
  return {
    x: weapon.x + Math.cos(angle) * weapon.height * 0.34,
    y: weapon.y + Math.sin(angle) * weapon.height * 0.34,
  };
}
