import { z } from 'zod';
import houses from './vtt-houses-catalog.json';
import furniture from './vtt-home-furniture-catalog.json';
import medievalFurniture from './vtt-medieval-furniture-catalog.json';
import { terrainTextureIds } from './vtt-terrain';
import { vttVisualSource } from './vtt-asset-visuals';

export const house2Size = 200;
export const house2Landscape = '/vtt/terrain-v4-20261013/grass.webp';
export const house2World = { x: -50, y: -15, width: 200, height: 200 };
export const house2VillagePlots = [
  { x: 3, y: 35, rotation: 0, dx: -0.6, dy: 0.5 },
  { x: 41, y: 35, rotation: 0, dx: 0.7, dy: -0.5 },
  { x: 71, y: 43, rotation: 90, dx: -0.4, dy: 0.7 },
  { x: 3, y: 64, rotation: 270, dx: 0.7, dy: -0.8 },
  { x: 32, y: 65, rotation: 180, dx: -0.8, dy: 0.6 },
  { x: 73, y: 73, rotation: 90, dx: -0.7, dy: -0.5 },
  { x: 11, y: 91, rotation: 270, dx: 0.5, dy: 0.8 },
  { x: 46, y: 93, rotation: 0, dx: -0.9, dy: -0.5 },
  { x: 83, y: 97, rotation: 270, dx: 0.6, dy: -0.8 },
  { x: 23, y: 121, rotation: 180, dx: -0.5, dy: 0.8 },
  { x: 60, y: 122, rotation: 180, dx: 0.7, dy: -0.8 },
  { x: 86, y: 119, rotation: 270, dx: 0.4, dy: 0.6 },
] as const;
export const house2StartingBalance = 20000;
export const house2PlotPrice = 1200;
export const house2Houses = houses
  .filter((h) => h.category === 'Casas vazias')
  .map((h, i) => ({
    ...h,
    image: vttVisualSource(h.image),
    interior: vttVisualSource(h.interior),
    price: 600 + Math.floor(i / 5) * 100,
  }));
export const house2Furniture = [...furniture, ...medievalFurniture].map((f) => ({
  ...f,
  image: vttVisualSource(f.image),
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
  ground?: House2GroundStroke[];
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
  village_slot: number | null;
};
export type House2Item = {
  id: string;
  catalog_id: string;
  plot_id: string | null;
  x: number | null;
  y: number | null;
  rotation: number;
  scale: number;
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
export const house2GroundStrokeSchema = z
  .object({
    material: z.enum(terrainTextureIds),
    width: z.number().finite().min(0.25).max(4),
    points: z
      .array(z.object({ x: coordinate, y: coordinate }).strict())
      .min(1)
      .max(200),
  })
  .strict();
export const house2GroundSchema = z
  .array(house2GroundStrokeSchema)
  .max(250)
  .refine(
    (strokes) => strokes.reduce((n, s) => n + s.points.length, 0) <= 5000,
    'A pintura excede o limite de pontos do terreno.',
  );
export type House2GroundStroke = z.infer<typeof house2GroundStrokeSchema>;
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
    ground: house2GroundSchema.optional(),
    house: house2TransformSchema.nullable(),
    items: z
      .array(
        house2TransformSchema
          .extend({ id: z.string().uuid(), scale: z.number().finite().min(0.25).max(3).optional() })
          .strict(),
      )
      .max(200),
  })
  .strict();
export type House2Layout = z.infer<typeof house2LayoutSchema>;
export function house2HousePlacement(
  plot: Pick<House2Plot, 'x' | 'y' | 'width' | 'height' | 'village_slot'>,
) {
  const plan = house2VillagePlots[((plot.village_slot ?? 1) - 1) % 12];
  return {
    x: plot.x + plot.width / 2 + plan.dx,
    y: plot.y + plot.height / 2 + plan.dy,
    rotation: plan.rotation,
  };
}
export function house2DoorPoint(x: number, y: number, rotation: number) {
  const angle = (rotation * Math.PI) / 180;
  return { x: x - Math.sin(angle) * 4.2, y: y + Math.cos(angle) * 4.2 };
}

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
