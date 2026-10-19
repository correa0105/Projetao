import { z } from 'zod';
import { house2Furniture } from './house-v2';
export const guildEstateWorld = { width: 60, height: 50 };
export const guildEstateHouse = { x: 21, y: 17, width: 18, height: 14 };
export const guildEstateRooms = [
  { id: 'main', name: 'Salão principal', x: 21.6, y: 17.6, width: 7.8, height: 5.8 },
  { id: 'forge', name: 'Oficina', x: 30.6, y: 17.6, width: 7.8, height: 5.8 },
  { id: 'lounge', name: 'Sala de estar', x: 21.6, y: 24.6, width: 7.8, height: 5.8 },
  { id: 'meeting', name: 'Sala de reunião', x: 30.6, y: 24.6, width: 7.8, height: 5.8 },
] as const;
export const guildEstateItems = [
  { id: 'main', name: 'Sino dos Juramentos', catalog: 'urban-038', x: 25.5, y: 20.5 },
  { id: 'forge', name: 'Bancada do Mestre Ferreiro', catalog: 'furniture-212', x: 34.5, y: 20.5 },
  { id: 'lounge', name: 'Aparador da Hospitalidade', catalog: 'furniture-023', x: 25.5, y: 27.5 },
  { id: 'meeting', name: 'Mesa de Estratégia', catalog: 'furniture-049', x: 34.5, y: 27.5 },
] as const;
export type GuildEstateItemId = (typeof guildEstateItems)[number]['id'];
export const guildEstateArt = (id: string) =>
  house2Furniture.find((f) => f.id === guildEstateItems.find((i) => i.id === id)?.catalog)!;
export function guildEstateItemSize(id: string, rotation: number) {
  const f = guildEstateArt(id);
  const w = f.width * 1.4,
    h = f.height * 1.4;
  return rotation % 180 === 0 ? { width: w, height: h } : { width: h, height: w };
}
export function guildEstateItemRoom(item: { id: string; x: number; y: number; rotation: number }) {
  const size = guildEstateItemSize(item.id, item.rotation);
  return guildEstateRooms.find(
    (r) =>
      item.x - size.width / 2 >= r.x &&
      item.x + size.width / 2 <= r.x + r.width &&
      item.y - size.height / 2 >= r.y &&
      item.y + size.height / 2 <= r.y + r.height,
  );
}
const item = z
  .object({
    id: z.enum(['main', 'forge', 'lounge', 'meeting']),
    x: z.number().finite().min(0).max(60),
    y: z.number().finite().min(0).max(50),
    rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  })
  .strict();
export const guildEstateSchema = z
  .object({ version: z.literal(1), items: z.array(item).length(4) })
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
    for (let a = 0; a < v.items.length; a++)
      for (let b = a + 1; b < v.items.length; b++) {
        const i = v.items[a],
          j = v.items[b],
          s = guildEstateItemSize(i.id, i.rotation),
          t = guildEstateItemSize(j.id, j.rotation);
        if (
          Math.abs(i.x - j.x) < (s.width + t.width) / 2 &&
          Math.abs(i.y - j.y) < (s.height + t.height) / 2
        )
          ctx.addIssue({ code: 'custom', message: 'As instalações não podem ficar sobrepostas.' });
      }
  });
export type GuildEstateLayout = z.infer<typeof guildEstateSchema>;
export function defaultGuildEstate(): GuildEstateLayout {
  return {
    version: 1,
    items: guildEstateItems.map((i) => ({ id: i.id, x: i.x, y: i.y, rotation: 0 })),
  };
}
