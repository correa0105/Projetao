import { z } from 'zod';
import { house2Houses, house2World, type House2Plot } from './house-v2';
import { pointBoxDistance, sweptCircleHitsBox } from './vtt-collision';

export type House2TokenSource = {
  id: string;
  kind: 'character' | 'pet' | 'mount';
  name: string;
  character_id: string;
  character_name: string;
  image_url: string;
  top_down: boolean;
};
export type House2Token = House2TokenSource & {
  source_id: string;
  x: number;
  y: number;
  rotation: number;
  size: number;
  revision: number;
  can_control: boolean;
};
export const house2TokenPoint = z
  .object({
    x: z
      .number()
      .finite()
      .min(house2World.x)
      .max(house2World.x + house2World.width),
    y: z
      .number()
      .finite()
      .min(house2World.y)
      .max(house2World.y + house2World.height),
  })
  .strict();
export const house2TokenTransform = house2TokenPoint.extend({
  rotation: z.number().finite().min(0).lt(360),
  size: z.number().finite().min(0.35).max(3),
});
export const house2TokenUpdate = house2TokenTransform
  .extend({
    revision: z.number().int().min(0),
    path: z.array(house2TokenPoint).max(200).optional(),
  })
  .strict();
export function house2TokenClamp(p: { x: number; y: number; size: number }) {
  return {
    x: Math.max(house2World.x + p.size / 2, Math.min(house2World.x + 200 - p.size / 2, p.x)),
    y: Math.max(house2World.y + p.size / 2, Math.min(house2World.y + 200 - p.size / 2, p.y)),
  };
}
type Point = { x: number; y: number };
export function house2Local(
  p: Pick<House2Plot, 'house_x' | 'house_y' | 'house_rotation'>,
  at: Point,
) {
  const a = (-p.house_rotation * Math.PI) / 180,
    x = at.x - p.house_x!,
    y = at.y - p.house_y!;
  return { x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) };
}
export function house2HouseWorld(
  p: Pick<House2Plot, 'house_x' | 'house_y' | 'house_rotation'>,
  at: Point,
) {
  const a = (p.house_rotation * Math.PI) / 180;
  return {
    x: p.house_x! + at.x * Math.cos(a) - at.y * Math.sin(a),
    y: p.house_y! + at.x * Math.sin(a) + at.y * Math.cos(a),
  };
}
export function house2Floor(p: House2Plot) {
  const spec = house2Houses.find((h) => h.id === p.house_id);
  if (!spec) return null;
  const f = spec.footprint;
  return {
    left: (f.left - 0.5) * spec.width,
    right: (f.right - 0.5) * spec.width,
    top: (f.top - 0.5) * spec.height,
    bottom: (f.bottom - 0.5) * spec.height,
    doorStart: (f.doorStart - 0.5) * spec.width,
    doorEnd: (f.doorEnd - 0.5) * spec.width,
  };
}
export function house2Contains(p: House2Plot, at: Point) {
  const f = house2Floor(p),
    q = house2Local(p, at);
  return !!f && q.x > f.left && q.x < f.right && q.y > f.top && q.y < f.bottom;
}
export function house2Doorway(p: House2Plot) {
  const f = house2Floor(p);
  return f ? house2HouseWorld(p, { x: (f.doorStart + f.doorEnd) / 2, y: f.bottom }) : null;
}
export function house2WallBoxes(p: House2Plot) {
  const f = house2Floor(p);
  if (!f) return [];
  const t = 0.09;
  return [
    { left: f.left - t, right: f.right + t, top: f.top - t, bottom: f.top + t },
    { left: f.left - t, right: f.left + t, top: f.top, bottom: f.bottom },
    { left: f.right - t, right: f.right + t, top: f.top, bottom: f.bottom },
    { left: f.left, right: f.doorStart, top: f.bottom - t, bottom: f.bottom + t },
    { left: f.doorEnd, right: f.right, top: f.bottom - t, bottom: f.bottom + t },
    ...(!p.door_open
      ? [{ left: f.doorStart, right: f.doorEnd, top: f.bottom - t, bottom: f.bottom + t }]
      : []),
  ];
}
export function house2TokenCanMove(plots: House2Plot[], from: Point, to: Point, size: number) {
  return !plots.some(
    (p) =>
      p.house_id &&
      house2WallBoxes(p).some((box) =>
        sweptCircleHitsBox(house2Local(p, from), house2Local(p, to), box, size * 0.18),
      ),
  );
}
export function house2DoorOccupied(p: House2Plot, tokens: Pick<House2Token, 'x' | 'y' | 'size'>[]) {
  const f = house2Floor(p);
  return (
    !!f &&
    tokens.some(
      (t) =>
        pointBoxDistance(house2Local(p, t), {
          left: f.doorStart,
          right: f.doorEnd,
          top: f.bottom - 0.09,
          bottom: f.bottom + 0.09,
        }) <
        t.size * 0.18,
    )
  );
}
