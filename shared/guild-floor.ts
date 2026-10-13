import { houseFloorScale, houseFloorDragPosition, houseViewWidth } from './house-perspective';

// The first four rooms have their own floor edge. Expanded rooms reuse House art.
export const guildFloorTemplates: Record<string, string> = {
  main: 'guild-main',
  forge: 'guild-forge',
  lounge: 'guild-lounge',
  meeting: 'guild-meeting',
  alchemy: 'kitchen-herbal',
  training: 'hall-vault',
  library: 'hall-library',
  leader: 'hall-manor',
};
export const guildFloorBacks: Record<string, number> = {
  main: 0.52,
  forge: 0.53,
  lounge: 0.55,
  meeting: 0.54,
};
export function guildFloorScale(y: number, room: string) {
  const back = guildFloorBacks[room];
  return back === undefined
    ? houseFloorScale(y, guildFloorTemplates[room])
    : 0.3 + ((Math.max(back, Math.min(0.98, y)) - back) * 0.7) / (0.84 - back);
}
export function guildFurnitureWidth(p: {
  catalog: string;
  facing: number;
  scale: number;
  y: number;
  room: string;
}) {
  return p.scale * houseViewWidth(p.catalog, p.facing) * guildFloorScale(p.y, p.room);
}
export function guildFloorDragPosition(
  cursor: { x: number; y: number },
  grab: { x: number; y: number },
  bounds: { width: number; height: number },
  previousY: number,
  room: string,
) {
  const back = guildFloorBacks[room];
  if (back === undefined) {
    const p = houseFloorDragPosition(
      cursor,
      grab,
      bounds,
      previousY,
      guildFloorTemplates[room],
      0.1,
    );
    return { x: Math.max(0.03, Math.min(0.97, p.x)), y: Math.min(0.97, p.y) };
  }
  const slope = 0.7 / (0.84 - back),
    intercept = 0.3 - back * slope;
  const denominator = bounds.height + grab.y * slope;
  const projected = denominator > 1e-8 ? (cursor.y - grab.y * intercept) / denominator : previousY;
  const above = (cursor.y - grab.y * 0.3) / bounds.height;
  const y = Math.max(0.1, Math.min(0.97, above < back ? above : projected));
  return {
    x: Math.max(
      0.03,
      Math.min(0.97, (cursor.x - grab.x * guildFloorScale(y, room)) / bounds.width),
    ),
    y,
  };
}
