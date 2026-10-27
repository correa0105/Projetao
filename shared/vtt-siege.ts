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
  muted: boolean;
};
export type SiegeSnapshot = {
  roomId: string;
  sceneId: string;
  serverTime: number;
  weapons: SiegeWeapon[];
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
    }
  | { kind: 'settings'; weaponId: string; revision: number; ammunition: number; muted: boolean }
  | { kind: 'extraAction'; actorId: string };
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
