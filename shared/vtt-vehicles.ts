import { z } from 'zod';
import type { VttScene, VttToken, Point } from './vtt.js';
import { canopyActor, canopyTokenSamples } from './vtt-canopies.js';
import art from './vtt-vehicle-art.json';
export const vehicleIds = [
  'carriage',
  'cart',
  'chariot',
  'sled',
  'wagon',
  'airship',
  'galley',
  'keelboat',
  'longship',
  'rowboat',
  'sailing-ship',
  'warship',
] as const;
export const vehicleSourceSchema = z
  .object({
    characterId: z.string().uuid(),
    itemId: z.enum(vehicleIds),
    copy: z.number().int().min(0).max(9999),
  })
  .strict();
export const vehicleMime = 'application/x-alvorada-vehicle';
export type VehicleId = (typeof vehicleIds)[number];
export type VehicleArt = {
  base: number[];
  cover?: number[];
  coverTarget?: number[];
  coverImage?: string;
  coverPieces?: { source: number[]; target: number[] }[];
};
export const vehicleDefinitions: Record<
  VehicleId,
  { name: string; widthFt: number; lengthFt: number; baseWidth: number; covered: boolean }
> = {
  carriage: { name: 'Carruagem', widthFt: 8, lengthFt: 15, baseWidth: 1, covered: true },
  cart: { name: 'Carroça pequena', widthFt: 6, lengthFt: 12, baseWidth: 1, covered: false },
  chariot: { name: 'Biga', widthFt: 8, lengthFt: 12, baseWidth: 1, covered: false },
  sled: { name: 'Trenó', widthFt: 6, lengthFt: 10, baseWidth: 1, covered: false },
  wagon: { name: 'Carroça', widthFt: 8, lengthFt: 16, baseWidth: 1, covered: false },
  airship: { name: 'Dirigível', widthFt: 30, lengthFt: 80, baseWidth: 0.83, covered: true },
  galley: { name: 'Galé', widthFt: 50, lengthFt: 130, baseWidth: 1, covered: true },
  keelboat: { name: 'Barco de quilha', widthFt: 30, lengthFt: 60, baseWidth: 0.67, covered: true },
  longship: { name: 'Drácar', widthFt: 40, lengthFt: 70, baseWidth: 1, covered: true },
  rowboat: { name: 'Barco a remo', widthFt: 5, lengthFt: 10, baseWidth: 1, covered: false },
  'sailing-ship': {
    name: 'Navio à vela',
    widthFt: 30,
    lengthFt: 100,
    baseWidth: 2 / 3,
    covered: true,
  },
  warship: {
    name: 'Navio de guerra',
    widthFt: 35,
    lengthFt: 100,
    baseWidth: 20 / 35,
    covered: true,
  },
};
export function vehicleImage(id: VehicleId) {
  return `/vtt/vehicles-20261026/${id}-v1.png`;
}
export function vehicleCoverImage(id: VehicleId) {
  return (art[id] as VehicleArt).coverImage ?? vehicleImage(id);
}
export function vehicleDrawParts(id: VehicleId, part: 'base' | 'cover') {
  const a: VehicleArt = art[id];
  if (part === 'cover' && a.coverPieces) return a.coverPieces;
  const source = a[part];
  if (!source) return [];
  const width = part === 'base' ? vehicleDefinitions[id].baseWidth : 1;
  return [
    {
      source,
      target: part === 'cover' && a.coverTarget ? a.coverTarget : [(1 - width) / 2, 0, width, 1],
    },
  ];
}
export function vehicleCoverImages(tokens: VttToken[]) {
  return [
    ...new Set(
      tokens.filter((t) => !!vehicleArt(t)?.cover).map((t) => vehicleCoverImage(t.vehicle!.itemId)),
    ),
  ];
}
export function vehicleArt(t: VttToken) {
  return t.vehicle && t.image === vehicleImage(t.vehicle.itemId)
    ? (art[t.vehicle.itemId] as VehicleArt)
    : null;
}
export function vehicleSize(id: VehicleId, scene: Pick<VttScene, 'grid'>) {
  const d = vehicleDefinitions[id],
    pixels = (scene.grid.size * (scene.grid.unit === 'm' ? 0.3048 : 1)) / scene.grid.scale,
    w = d.widthFt * pixels,
    h = d.lengthFt * pixels,
    factor = Math.max(8 / Math.min(w, h), Math.min(1, 8000 / Math.max(w, h)));
  return {
    width: Math.max(8, Math.min(8000, w * factor)),
    height: Math.max(8, Math.min(8000, h * factor)),
  };
}
export function vehiclePoint(t: VttToken, p: Point) {
  const a = (-t.rotation * Math.PI) / 180,
    x = p.x - t.x,
    y = p.y - t.y;
  return {
    x: ((x * Math.cos(a) - y * Math.sin(a)) * (t.flipX ? -1 : 1)) / t.width + 0.5,
    y: ((x * Math.sin(a) + y * Math.cos(a)) * (t.flipY ? -1 : 1)) / t.height + 0.5,
  };
}
export function vehicleOccupied(
  t: VttToken,
  actors: VttToken[],
  opaque: (x: number, y: number) => boolean,
) {
  return actors.some(
    (actor) =>
      actor.id !== t.id &&
      canopyActor(actor) &&
      canopyTokenSamples(actor).some((p) => {
        const q = vehiclePoint(t, p);
        return q.x >= 0 && q.x < 1 && q.y >= 0 && q.y < 1 && opaque(q.x, q.y);
      }),
  );
}
export type OwnedVttVehicle = {
  characterId: string;
  characterName: string;
  ownerName: string;
  itemId: VehicleId;
  quantity: number;
};
