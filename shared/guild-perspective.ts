import { z } from 'zod';
export const guildPerspectiveLimit = 0.4;
const offset = z
  .object({
    x: z.number().finite().min(-guildPerspectiveLimit).max(guildPerspectiveLimit),
    y: z.number().finite().min(-guildPerspectiveLimit).max(guildPerspectiveLimit),
  })
  .strict();
export type GuildPerspective = [
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
];
const corners = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
export function guildPerspectiveCorners(p?: GuildPerspective) {
  return corners.map((c, i) => ({ x: c.x + (p?.[i].x ?? 0), y: c.y + (p?.[i].y ?? 0) }));
}
function convex(p: GuildPerspective) {
  const q = guildPerspectiveCorners(p);
  return q.every((a, i) => {
    const b = q[(i + 1) % 4],
      c = q[(i + 2) % 4];
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) > 0.02;
  });
}
export const guildPerspectiveSchema = z
  .tuple([offset, offset, offset, offset])
  .refine(convex, 'A perspectiva precisa manter os quatro cantos sem cruzamentos.');
export const guildPerspectiveGuidesSchema = z
  .object({
    horizon: z.number().finite().min(0.1).max(0.8),
    left: z.number().finite().min(-3).max(0.45),
    right: z.number().finite().min(0.55).max(4),
  })
  .strict();
export type GuildPerspectiveGuides = z.infer<typeof guildPerspectiveGuidesSchema>;
export function guildRoomPerspective(room: string): GuildPerspectiveGuides {
  return {
    horizon:
      ({ main: 0.42, forge: 0.44, lounge: 0.43, meeting: 0.43 } as Record<string, number>)[
        room
      ] ?? 0.43,
    left: -1,
    right: 2,
  };
}
export function guildMovePerspectiveCorner(
  p: GuildPerspective | undefined,
  index: number,
  x: number,
  y: number,
): GuildPerspective {
  const next = corners.map((_, i) =>
    i === index
      ? {
          x: Math.max(-guildPerspectiveLimit, Math.min(guildPerspectiveLimit, x)),
          y: Math.max(-guildPerspectiveLimit, Math.min(guildPerspectiveLimit, y)),
        }
      : (p?.[i] ?? { x: 0, y: 0 }),
  ) as GuildPerspective;
  return convex(next)
    ? next
    : (p ?? (corners.map(() => ({ x: 0, y: 0 })) as GuildPerspective));
}
export function guildFitPerspective(
  base: { left: number; top: number; width: number; height: number },
  vanishing: { x: number; y: number },
): GuildPerspective {
  const left = base.left,
    right = left + base.width,
    top = base.top,
    bottom = top + base.height;
  const movingLeft = vanishing.x < (left + right) / 2,
    fixedX = movingLeft ? right : left,
    movingX = movingLeft ? left : right;
  const ratio = (movingX - vanishing.x) / (fixedX - vanishing.x);
  const topOffset = (vanishing.y + (top - vanishing.y) * ratio - top) / base.height;
  const bottomOffset = (vanishing.y + (bottom - vanishing.y) * ratio - bottom) / base.height;
  let result = corners.map(() => ({ x: 0, y: 0 })) as GuildPerspective;
  result = guildMovePerspectiveCorner(result, movingLeft ? 0 : 1, 0, topOffset);
  return guildMovePerspectiveCorner(result, movingLeft ? 3 : 2, 0, bottomOffset);
}

/** Gentle refinement of a real furniture view; keep the floor contact in place. */
export function guildFitPerspectiveSoft(
  base: { left: number; top: number; width: number; height: number },
  vanishing: { x: number; y: number },
): GuildPerspective {
  const fitted = guildFitPerspective(base, vanishing);
  const floor = (fitted[2].y + fitted[3].y) / 2;
  const centered = fitted.map(p => ({ x: p.x, y: p.y - floor }));
  const maximum = Math.max(...centered.map(p => Math.max(Math.abs(p.x), Math.abs(p.y))));
  const strength = maximum > .12 ? .12 / maximum : 1;
  return centered.map(p => ({ x: p.x * strength, y: p.y * strength })) as GuildPerspective;
}
