import { z } from 'zod';
import houses from './vtt-houses-catalog.json';
import furniture from './vtt-home-furniture-catalog.json';

export const house2Size = 100;
export const house2StartingBalance = 20000;
export const house2PlotPrice = 1200;
export const house2Houses = houses
  .filter((h) => h.category === 'Casas vazias')
  .map((h, i) => ({
    ...h,
    price: 600 + Math.floor(i / 5) * 100,
  }));
export const house2Furniture = furniture.map((f) => ({
  ...f,
  price: Math.max(15, Math.round(f.width * f.height * 30)),
}));
export const house2Terrains = {
  earth: '/vtt/terrain-v3-20261013/earth.webp',
  grass: '/vtt/terrain-v4-20261013/grass.webp',
  stone: '/vtt/terrain-v3-20261013/stone.webp',
} as const;
export type House2Neighborhood = {
  id: string;
  name: string;
  description: string;
  terrain: keyof typeof house2Terrains;
  available: number;
  total: number;
  owned: number;
};
export type House2Plot = {
  id: string;
  neighborhood_id: string;
  number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  price: number;
  character_id: string | null;
  owner_name: string | null;
  player_name: string | null;
  can_edit: boolean;
  house_id: string | null;
  house_x: number | null;
  house_y: number | null;
  house_rotation: number;
  revision: number;
};
export type House2Item = {
  id: string;
  catalog_id: string;
  plot_id: string | null;
  x: number | null;
  y: number | null;
  rotation: number;
};
export type House2Directory = {
  neighborhoods: House2Neighborhood[];
  balance: number;
  inventory: House2Item[];
};
export type House2Scene = {
  neighborhood: House2Neighborhood;
  plots: House2Plot[];
  items: House2Item[];
};
const coordinate = z.number().finite().min(0).max(house2Size);
export const house2TransformSchema = z
  .object({
    x: coordinate,
    y: coordinate,
    rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  })
  .strict();
export const house2LayoutSchema = z
  .object({
    revision: z.number().int().min(0),
    house: house2TransformSchema.nullable(),
    items: z.array(house2TransformSchema.extend({ id: z.string().uuid() }).strict()).max(200),
  })
  .strict();
export type House2Layout = z.infer<typeof house2LayoutSchema>;

/** Includes the complete rotated sprite, so nothing can extend onto a neighbor's land. */
export function house2Within(
  plot: Pick<House2Plot, 'x' | 'y' | 'width' | 'height'>,
  piece: { x: number; y: number; rotation: number },
  width: number,
  height: number,
) {
  if (![piece.x, piece.y, piece.rotation, width, height].every(Number.isFinite)) return false;
  const radians = (piece.rotation * Math.PI) / 180;
  const w = Math.abs(Math.cos(radians)) * width + Math.abs(Math.sin(radians)) * height;
  const h = Math.abs(Math.sin(radians)) * width + Math.abs(Math.cos(radians)) * height;
  const eps = 1e-7;
  return (
    piece.x - w / 2 >= plot.x - eps &&
    piece.x + w / 2 <= plot.x + plot.width + eps &&
    piece.y - h / 2 >= plot.y - eps &&
    piece.y + h / 2 <= plot.y + plot.height + eps
  );
}
export function house2Clamp(
  plot: Pick<House2Plot, 'x' | 'y' | 'width' | 'height'>,
  piece: { x: number; y: number; rotation: number },
  width: number,
  height: number,
) {
  const rotated = piece.rotation % 180 !== 0,
    w = rotated ? height : width,
    h = rotated ? width : height;
  return {
    ...piece,
    x: Math.min(plot.x + plot.width - w / 2, Math.max(plot.x + w / 2, piece.x)),
    y: Math.min(plot.y + plot.height - h / 2, Math.max(plot.y + h / 2, piece.y)),
  };
}
