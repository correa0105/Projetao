import { crestArtSchema } from './guild-crest-art';
import {
  additionalCrestIcons,
  additionalCrestFields,
  additionalCrestOrnaments,
} from './guild-crest-options';
import { z } from 'zod';
import { guildEstateSchema } from './guild-estate';
import { houseCatalog, houseTemplates, houseSupportsFacing } from './house';
import { guildPerspectiveSchema, guildPerspectiveGuidesSchema } from './guild-perspective';
export const crestIcons = [
  'sword',
  'wolf',
  'crown',
  'raven',
  'tree',
  'flame',
  'moon',
  'star',
  'anchor',
  'book',
  'dragon',
  'mountain',
  ...additionalCrestIcons,
] as const;
export const crestFields = [
  'plain',
  'quartered',
  'diagonal',
  'stripes',
  'chevron',
  'sunburst',
  ...additionalCrestFields,
] as const;
export const crestBorders = ['shield', 'round', 'banner', 'diamond', 'hexagon', 'laurel'] as const;
// `border` is the historical shape key. Keep it so saved guilds remain compatible.
export const crestOrnaments = [
  'beveled',
  'riveted',
  'braided',
  'runic',
  'laurel',
  'thorns',
  ...additionalCrestOrnaments,
] as const;
export const guildRooms = [
  { id: 'main', name: 'Salão principal', image: '/guild/rooms/main.webp', starter: true },
  { id: 'forge', name: 'Ferraria', image: '/guild/rooms/forge.webp', starter: true },
  { id: 'lounge', name: 'Sala de estar', image: '/guild/rooms/lounge.webp', starter: true },
  { id: 'meeting', name: 'Sala de reunião', image: '/guild/rooms/meeting.webp', starter: true },
  { id: 'alchemy', name: 'Alquimia', image: '/house/rooms/kitchen-herbal.webp', starter: false },
  {
    id: 'training',
    name: 'Salão de treinamento',
    image: '/house/rooms/hall-vault.webp',
    starter: false,
  },
  { id: 'library', name: 'Biblioteca', image: '/house/rooms/hall-library.webp', starter: false },
  { id: 'leader', name: 'Sala do líder', image: '/house/rooms/hall-manor.webp', starter: false },
] as const;
export const roomIds = [
  'main',
  'forge',
  'lounge',
  'meeting',
  'alchemy',
  'training',
  'library',
  'leader',
] as const;
export function guildLevel(prestige: number) {
  return Math.min(100, 1 + Math.floor(prestige / 100));
}
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
export const crestSchema = z
  .object({
    art: crestArtSchema.optional(),
    icon: z.enum(crestIcons).default('sword'),
    field: z.enum(crestFields).default('quartered'),
    border: z.enum(crestBorders).default('shield'),
    ornament: z.enum(crestOrnaments).default('beveled'),
    iconColor: color.default('#e5c681'),
    fieldColor: color.default('#283b36'),
    fieldColor2: color.default('#17272d'),
    borderColor: color.default('#b28a4c'),
  })
  .strict();
export type Crest = z.infer<typeof crestSchema>;
export const guildDecor = houseCatalog.filter((i) => !['letter', 'frame'].includes(i.id));
export const guildPlacementSchema = z
  .object({
    id: z.string().uuid(),
    catalog: z.string().refine((id) => guildDecor.some((i) => i.id === id)),
    room: z.enum(roomIds).default('main'),
    x: z.number().min(0.03).max(0.97),
    y: z.number().min(0.1).max(0.97),
    scale: z.number().min(0.04).max(0.6),
    facing: z.number().int().min(0).max(15),
    perspective: guildPerspectiveSchema.optional(),
  })
  .strict()
  .refine((p) => houseSupportsFacing(p.catalog, p.facing), 'Vista inválida.');
export const guildDocumentSchema = z
  .object({
    name: z.string().trim().min(3).max(60),
    description: z.string().trim().max(1500).default(''),
    crest: crestSchema.default(() => crestSchema.parse({})),
    ambience: z.enum(['natural', 'warm', 'moonlit']).default('natural'),
    placements: z.array(guildPlacementSchema).max(24).default([]),
    estate: guildEstateSchema.optional(),
    perspectives: z.partialRecord(z.enum(roomIds), guildPerspectiveGuidesSchema).optional(),
  })
  .strict()
  .refine(
    (d) => new Set(d.placements.map((p) => p.id)).size === d.placements.length,
    'Objetos repetidos.',
  );
export type GuildDocument = z.infer<typeof guildDocumentSchema>;
export const missionTemplateSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,50}$/),
    name: z.string().trim().min(3).max(100),
    metric: z.enum(['participations', 'missions', 'members']),
    goal: z.number().int().min(1).max(1000),
    gold_po: z.number().int().min(0).max(100000),
    prestige: z.number().int().min(0).max(10000),
  })
  .strict();
export const communitySettingsSchema = z
  .object({
    room_unlocks: z
      .object({
        alchemy: z.number().int().min(2).max(100).default(3),
        training: z.number().int().min(2).max(100).default(5),
        library: z.number().int().min(2).max(100).default(7),
        leader: z.number().int().min(2).max(100).default(10),
      })
      .strict()
      .default(() => ({ alchemy: 3, training: 5, library: 7, leader: 10 })),
    founding_po: z.number().int().min(0).max(1000000).nullable().default(null),
    profile_unlocks: z
      .array(z.number().int().min(1).max(100))
      .min(1)
      .max(8)
      .default([1, 3, 5, 10, 15, 20]),
    missions: z
      .array(missionTemplateSchema)
      .max(8)
      .default([
        {
          id: 'united',
          name: 'Aventureiros unidos',
          metric: 'members',
          goal: 3,
          gold_po: 150,
          prestige: 30,
        },
        {
          id: 'chronicles',
          name: 'Novas crônicas',
          metric: 'missions',
          goal: 2,
          gold_po: 100,
          prestige: 20,
        },
        {
          id: 'journey',
          name: 'Uma jornada em companhia',
          metric: 'participations',
          goal: 5,
          gold_po: 200,
          prestige: 40,
        },
      ]),
    upgrades: z
      .array(
        z
          .object({
            catalog: z.string().refine((id) => guildDecor.some((i) => i.id === id)),
            gold_po: z.number().int().min(0).max(1000000),
            prestige: z.number().int().min(0).max(1000000),
            missions: z.number().int().min(0).max(10000),
            max_level: z.number().int().min(2).max(10),
          })
          .strict(),
      )
      .max(100)
      .default([]),
  })
  .strict()
  .refine(
    (c) =>
      new Set(c.missions.map((m) => m.id)).size === c.missions.length &&
      new Set(c.upgrades.map((u) => u.catalog)).size === c.upgrades.length,
    'Configurações repetidas.',
  );
export type CommunitySettings = z.infer<typeof communitySettingsSchema>;
export function accountProgress(missions: number, achievements: number, unlocks: number[]) {
  const xp = Math.max(0, missions) * 50 + Math.max(0, achievements) * 20,
    level = Math.min(100, 1 + Math.floor(xp / 100));
  return {
    xp,
    level,
    next_xp: level === 100 ? null : level * 100,
    modules: unlocks.filter((n) => n <= level).length,
    unlocks,
  };
}
export function guildRank(prestige: number) {
  return prestige >= 1000
    ? 'Lendária'
    : prestige >= 500
      ? 'Obsidiana'
      : prestige >= 200
        ? 'Prata'
        : prestige >= 50
          ? 'Bronze'
          : 'Ferro';
}
export function guildWeek(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
