import { z } from 'zod';
import refitCatalog from '../data/house-refit-catalog.json';
import expansionCatalog from '../data/house-expansion-20261008.json';
export const houseDistortionLimit = 0.12;
const distortionPointSchema = z
  .object({
    x: z.number().finite().min(-houseDistortionLimit).max(houseDistortionLimit),
    y: z.number().finite().min(-houseDistortionLimit).max(houseDistortionLimit),
  })
  .strict();
export const houseDistortionSchema = z.tuple([
  distortionPointSchema,
  distortionPointSchema,
  distortionPointSchema,
  distortionPointSchema,
]);
export type HouseDistortion = z.infer<typeof houseDistortionSchema>;
export const roomKinds = ['sala', 'cozinha', 'varanda', 'jardim'] as const;
const roomNames = [
  ['hall-hearth', 'sala', 'Sala da Lareira'],
  ['hall-library', 'sala', 'Sala do Escriba'],
  ['hall-vault', 'sala', 'Sala do Bastião'],
  ['hall-manor', 'sala', 'Sala da Vigília'],
  ['kitchen-hearth', 'cozinha', 'Cozinha do Fogo'],
  ['kitchen-manor', 'cozinha', 'Cozinha do Solar'],
  ['kitchen-herbal', 'cozinha', 'Cozinha das Ervas'],
  ['kitchen-cellar', 'cozinha', 'Cozinha da Adega'],
  ['porch-pines', 'varanda', 'Varanda dos Pinheiros'],
  ['porch-castle', 'varanda', 'Varanda do Bastião'],
  ['porch-vines', 'varanda', 'Varanda das Vinhas'],
  ['porch-coast', 'varanda', 'Varanda do Mar Pálido'],
  ['garden-courtyard', 'jardim', 'Pátio da Fonte'],
  ['garden-herbs', 'jardim', 'Jardim das Ervas'],
  ['garden-moon', 'jardim', 'Jardim da Lua'],
  ['garden-orchard', 'jardim', 'Pomar de Outono'],
];
export const houseTemplates = roomNames.map(([id, kind, name]) => ({
  id,
  kind,
  name,
  image: `/house/rooms/${id}.webp`,
}));
const furniture = new Map(refitCatalog.map((item) => [item.id, item]));
const expansion = new Map(expansionCatalog.map((item) => [item.id, item]));
/** Initial view only; placed pieces retain their explicit or historical front view. */
export function houseDefaultFacing(catalogId: string) {
  return (
    expansion.get(catalogId)?.default_facing ??
    furniture.get(catalogId)?.default_facing ??
    (catalogId === 'letter' ? 1 : 0)
  );
}
/** Base size for a newly placed piece; never rewrite saved placement sizes. */
export function houseDefaultScale(catalogId: string) {
  return expansion.get(catalogId)?.default_scale ?? furniture.get(catalogId)?.default_scale ?? 0.17;
}
/** Real rendered views; old letter/frame assets remain unchanged. */
export function houseItemImage(catalogId: string, facing = houseDefaultFacing(catalogId)) {
  const directory = expansion.has(catalogId)
    ? 'house-expansion-20261008'
    : furniture.has(catalogId)
      ? facing >= 8 || (['table', 'rug'].includes(catalogId) && facing === 0)
        ? 'house-perspective-20261007'
        : 'house-refit-20261007'
      : 'views';
  return `/house/items/${directory}/${catalogId}/${facing}.webp`;
}
// These four intermediate views were retired because they repeated nearby views.
// Keep their assets/IDs readable for already saved layouts.
const retiredFacings = new Set([9, 11, 12, 15]);
/** Saved layouts retain all original assets, even views removed from the picker. */
export function houseSupportsFacing(catalogId: string, facing: number) {
  return Number.isInteger(facing) && facing >= 0 && facing < (furniture.has(catalogId) ? 16 : 8);
}
/** Keep legacy IDs 0..15; offer only the twelve distinct furniture views. */
export function houseFacingOptions(catalogId: string) {
  const names = [
    'Frente',
    'Frente e direita',
    'Direita',
    'Trás e direita',
    'Trás',
    'Trás e esquerda',
    'Esquerda',
    'Frente e esquerda',
  ];
  const options = names.map((label, value) => ({ value, label }));
  return furniture.has(catalogId)
    ? options.flatMap((option, i) => [
        option,
        ...(!retiredFacings.has(i + 8)
          ? [{ value: i + 8, label: `${option.label} · intermediária ${i * 45 + 22.5}°` }]
          : []),
      ])
    : options;
}
export function houseTurnFacing(catalogId: string, facing: number, direction: -1 | 1) {
  const options = houseFacingOptions(catalogId);
  const order = furniture.has(catalogId)
    ? [0, 8, 1, 9, 2, 10, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15]
    : [0, 1, 2, 3, 4, 5, 6, 7];
  let index = Math.max(0, order.indexOf(facing));
  do {
    index = (index + direction + order.length) % order.length;
  } while (!options.some((option) => option.value === order[index]));
  return order[index];
}
export const houseCatalog = [
  ...refitCatalog,
  ...expansionCatalog,
  {
    id: 'letter',
    name: 'Carta Selada',
    price_cp: 1000,
    description: 'Escreva uma mensagem e ofereça como lembrança.',
    speech: 'A tinta é sua. Eu só cuido para o selo chegar inteiro.',
    art: 'one sealed medieval parchment envelope with aged red wax seal, resting flat, elevated front-right three-quarter view with visible paper edge thickness',
  },
  {
    id: 'frame',
    name: 'Quadro de Memórias',
    price_cp: 4500,
    description: 'Moldura para uma imagem pessoal e uma dedicatória.',
    speech: 'Uma parede merece alguma coisa que você queira lembrar.',
    art: 'one empty medieval portrait frame with subtle aged copper ornament, transparent opening, rectangular upright front view',
  },
].map((item) => ({
  ...item,
  default_facing: houseDefaultFacing(item.id),
  default_scale: houseDefaultScale(item.id),
  image: houseItemImage(item.id),
  audio_path:
    expansion.get(item.id)?.audio_path ??
    furniture.get(item.id)?.audio_path ??
    `/audio/emporium/house-${item.id}.wav`,
}));
export const placementSchema = z
  .object({
    id: z.string().uuid(),
    kind: z.enum(['item', 'pet', 'mount']),
    ref: z.string().uuid(),
    x: z.number().min(0.02).max(0.98),
    y: z.number().min(0.08).max(0.98),
    scale: z.number().min(0.03).max(0.8),
    rotation: z.number().min(-180).max(180),
    facing: z.number().int().min(0).max(15).optional(),
    perspective_pitch: z.number().finite().min(0).max(20).optional(),
    perspective_yaw: z.number().finite().min(-20).max(20).optional(),
    frame_backing: z.boolean().optional(),
    distortion: houseDistortionSchema.optional(),
    layer: z.number().int().min(0).max(300),
    depth_layer: z.number().int().min(1).max(6).optional(),
  })
  .strict();
export type HousePlacement = z.infer<typeof placementSchema>;
export const roomSchema = z
  .object({
    kind: z.enum(roomKinds),
    template: z.string().max(60),
    placements: z.array(placementSchema).max(100),
  })
  .strict();
export const layoutSchema = z
  .object({
    revision: z.number().int().min(0),
    name: z.string().trim().min(2).max(80),
    rooms: z.array(roomSchema).length(4),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.rooms.map((r) => r.kind)).size !== 4)
      ctx.addIssue({ code: 'custom', message: 'Escolha os quatro ambientes.' });
    const placements = v.rooms.flatMap((r) => r.placements);
    if (
      new Set(placements.map((p) => p.id)).size !== placements.length ||
      new Set(placements.map((p) => `${p.kind}:${p.ref}`)).size !== placements.length
    )
      ctx.addIssue({ code: 'custom', message: 'Cada peça só pode ocupar um lugar na casa.' });
    for (const r of v.rooms)
      if (!houseTemplates.some((t) => t.id === r.template && t.kind === r.kind))
        ctx.addIssue({ code: 'custom', message: 'Cenário inválido para este ambiente.' });
  });
export const initialHouseRooms = () =>
  roomKinds.map((kind) => ({
    kind,
    template: houseTemplates.find((t) => t.kind === kind)!.id,
    placements: [] as HousePlacement[],
  }));
export type HouseItem = {
  id: string;
  catalog_id: string;
  content: { title?: string; text?: string };
  source: string;
  has_image: boolean;
  sender_name?: string;
};
export type HouseVariant = { id: string; character_id: string; name: string };
export type HouseState = {
  gold_cp?: number;
  gold_unlimited?: boolean;
  id: string;
  character_id: string;
  name: string;
  revision: number;
  rooms: z.infer<typeof roomSchema>[];
  is_owner: boolean;
  owner_name: string;
  inventory: HouseItem[];
  items: HouseItem[];
  companions: {
    id: string;
    kind: 'pet' | 'mount';
    name: string;
    pet_id?: string;
    mount_id?: string;
    appearance?: string;
    coat?: string;
    equipment?: string[];
    image_url?: string | null;
    image_revision?: number;
  }[];
  presence: {
    user_id: string;
    character_id: string;
    name: string;
    variant_id: string | null;
    room: string;
    x: number;
    y: number;
    scale: number;
    layer: number;
    depth_layer?: number | null;
    flip_x?: boolean;
  }[];
  invites: { user_id: string; name: string; status: string }[];
  messages: {
    id: string;
    user_id: string;
    character_id: string;
    name: string;
    body: string;
    created_at: string;
  }[];
};
