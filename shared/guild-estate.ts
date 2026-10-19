import { z } from 'zod';
import { house2RotatedSize, house2Furniture, house2FurnitureForSale } from './house-v2';
export const guildEstateFurnitureCatalog = house2FurnitureForSale.filter(
  (f) => f.category === 'Mobílias' && f.width <= 5 && f.height <= 4,
);
export const guildEstateFinishes = {
  roof: [
    { id: 'slate', name: 'Ardósia', image: '/vtt/houses-empty-20261014/house-013-roof.webp' },
    { id: 'red', name: 'Telhas de barro', image: '/vtt/houses-empty-20261014/house-002-roof.webp' },
    {
      id: 'wood',
      name: 'Telhas de madeira',
      image: '/vtt/houses-empty-20261014/house-003-roof.webp',
    },
  ],
  floor: [
    { id: 'oak', name: 'Carvalho', image: '/house2/floors-20261018/floor-parquet-oak.webp' },
    { id: 'pine', name: 'Pinho', image: '/house2/floors-20261018/floor-pine-planks.webp' },
    { id: 'stone', name: 'Pedra', image: '/vtt/terrain-expansion-20261015/cobblestone.webp' },
  ],
  walls: [
    {
      id: 'stone',
      name: 'Alvenaria de pedra',
      image: '/house2/walls-20261018/walls-fieldstone.webp',
    },
    { id: 'brick', name: 'Tijolos', image: '/house2/walls-20261018/walls-red-brick.webp' },
    { id: 'wood', name: 'Madeira escura', image: '/house2/walls-20261018/walls-walnut.webp' },
  ],
};
export const guildEstateFinishesSchema = z
  .object({
    roof: z.enum(['slate', 'red', 'wood']).default('slate'),
    floor: z.enum(['oak', 'pine', 'stone']).default('oak'),
    walls: z.enum(['stone', 'brick', 'wood']).default('stone'),
    trees: z.boolean().default(true),
  })
  .strict();
export const guildEstateFurnitureSchema = z
  .object({
    id: z.string().uuid(),
    catalog: z.string().refine((id) => guildEstateFurnitureCatalog.some((f) => f.id === id)),
    x: z.number().finite().min(0).max(60).nullable(),
    y: z.number().finite().min(0).max(50).nullable(),
    rotation: z.number().finite().min(0).lt(360),
    scale: z.number().finite().min(0.25).max(3).default(1),
  })
  .strict()
  .refine((i) => (i.x === null) === (i.y === null), 'Posição incompleta.');
export type GuildEstateFurniture = z.infer<typeof guildEstateFurnitureSchema>;
export function guildEstateFurnitureSize(i: GuildEstateFurniture) {
  const f = guildEstateFurnitureCatalog.find((f) => f.id === i.catalog);
  if (!f) return { width: Infinity, height: Infinity };
  const w = f.width * 1.4 * i.scale,
    h = f.height * 1.4 * i.scale;
  const size = house2RotatedSize(w, h, i.rotation);
  return { width: size.width * 0.82, height: size.height * 0.82 };
}
export function guildEstateFurnitureFlat(catalog: string) {
  return /tapete|carpete|esteira|pele de|peles/i.test(
    guildEstateFurnitureCatalog.find((f) => f.id === catalog)?.name || '',
  );
}
export function guildEstateFurnitureRoom(i: GuildEstateFurniture) {
  if (i.x === null || i.y === null) return undefined;
  return guildEstateRoomAt(i.x, i.y);
}
export const guildEstateWorld = { width: 60, height: 50 };
export const guildEstateHouse = { x: 21, y: 17, width: 18, height: 14 };
export const guildEstateRooms = [
  { id: 'main', name: 'Salão principal', x: 21.6, y: 17.6, width: 7.8, height: 5.8 },
  { id: 'forge', name: 'Oficina', x: 30.6, y: 17.6, width: 7.8, height: 5.8 },
  { id: 'lounge', name: 'Sala de estar', x: 21.6, y: 24.6, width: 7.8, height: 5.8 },
  { id: 'meeting', name: 'Sala de reunião', x: 30.6, y: 24.6, width: 7.8, height: 5.8 },
] as const;
export function guildEstateRoomAt(x: number, y: number) {
  if (x < 21.15 || x > 38.85 || y < 17.15 || y > 30.85) return undefined;
  return [...guildEstateRooms].sort(
    (a, b) =>
      Math.hypot(x - a.x - a.width / 2, y - a.y - a.height / 2) -
      Math.hypot(x - b.x - b.width / 2, y - b.y - b.height / 2),
  )[0];
}
export const guildEstateItems = [
  { id: 'main', name: 'Sino dos Juramentos', catalog: 'urban-038', x: 25.5, y: 20.5 },
  { id: 'forge', name: 'Bancada do Mestre Ferreiro', catalog: 'furniture-212', x: 34.5, y: 20.5 },
  { id: 'lounge', name: 'Aparador da Hospitalidade', catalog: 'furniture-023', x: 25.5, y: 27.5 },
  { id: 'meeting', name: 'Mesa de Estratégia', catalog: 'furniture-049', x: 34.5, y: 27.5 },
] as const;
export type GuildEstateItemId = (typeof guildEstateItems)[number]['id'];
export const guildEstateArt = (id: string) =>
  house2Furniture.find((f) => f.id === guildEstateItems.find((i) => i.id === id)?.catalog)!;
export function guildEstateItemSize(id: string, rotation: number, scale = 1) {
  const f = guildEstateArt(id);
  const w = f.width * 1.4 * scale,
    h = f.height * 1.4 * scale;
  const size = house2RotatedSize(w, h, rotation);
  return { width: size.width * 0.82, height: size.height * 0.82 };
}
export function guildEstateItemRoom(item: {
  id: string;
  x: number;
  y: number;
  rotation: number;
  scale?: number;
}) {
  return guildEstateRoomAt(item.x, item.y);
}
const item = z
  .object({
    id: z.enum(['main', 'forge', 'lounge', 'meeting']),
    x: z.number().finite().min(0).max(60),
    y: z.number().finite().min(0).max(50),
    rotation: z.number().finite().min(0).lt(360),
    scale: z.number().finite().min(0.25).max(3).default(1),
  })
  .strict();
export const guildEstateSchema = z
  .object({
    version: z.literal(1),
    items: z.array(item).length(4),
    furniture: z.array(guildEstateFurnitureSchema).max(120).default([]),
    finishes: guildEstateFinishesSchema.default(() => guildEstateFinishesSchema.parse({})),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.items.map((i) => i.id)).size !== 4)
      ctx.addIssue({
        code: 'custom',
        message: 'A sede precisa conter exatamente as quatro instalações.',
      });
    for (const i of v.items)
      if (!guildEstateItemRoom(i))
        ctx.addIssue({
          code: 'custom',
          message: 'Mantenha as instalações dentro dos cômodos, sem atravessar as paredes.',
        });
    if (new Set(v.furniture.map((i) => i.id)).size !== v.furniture.length)
      ctx.addIssue({ code: 'custom', message: 'Móveis repetidos.' });
    for (const i of v.furniture)
      if (i.x !== null && !guildEstateFurnitureRoom(i))
        ctx.addIssue({ code: 'custom', message: 'Mantenha o móvel dentro de um cômodo.' });
  });
export type GuildEstateLayout = z.infer<typeof guildEstateSchema>;
export function defaultGuildEstate(): GuildEstateLayout {
  return guildEstateSchema.parse({
    version: 1,
    items: guildEstateItems.map((i) => ({ id: i.id, x: i.x, y: i.y, rotation: 0 })),
  });
}
