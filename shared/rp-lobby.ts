import { z } from 'zod';
import { houseCatalog, houseTemplates, houseSupportsFacing } from './house';
export const rpScenes = [
  { id: 'beach', name: 'Praia do Porto', image: '/rp-lobby/20261018/beach.webp' },
  { id: 'market', name: 'Mercado da Cidade', image: '/rp-lobby/20261018/market.webp' },
  { id: 'plaza', name: 'Praça da Fonte', image: '/rp-lobby/20261018/plaza.webp' },
  { id: 'tavern', name: 'Taverna da Lareira', image: '/house/rooms/hall-hearth.webp' },
  ...houseTemplates.filter((t) =>
    ['hall-library', 'porch-pines', 'garden-courtyard', 'garden-moon'].includes(t.id),
  ),
];
export const rpDecor = houseCatalog.filter((x) => !['letter', 'frame'].includes(x.id));
export const rpPlacementSchema = z
  .object({
    id: z.string().uuid(),
    catalog: z.string().refine((id) => rpDecor.some((x) => x.id === id)),
    x: z.number().finite().min(0.03).max(0.97),
    y: z.number().finite().min(0.4).max(0.98),
    scale: z.number().finite().min(0.04).max(0.5),
    facing: z.number().int().min(0).max(15),
    rotation: z.number().finite().min(-180).max(180),
    layer: z.number().int().min(1).max(6),
  })
  .strict()
  .refine((x) => houseSupportsFacing(x.catalog, x.facing), 'Vista inválida para esta peça.');
export const rpDocumentSchema = z
  .object({
    scene: z.string().refine((id) => rpScenes.some((x) => x.id === id)),
    placements: z.array(rpPlacementSchema).max(60),
  })
  .strict()
  .refine(
    (x) => new Set(x.placements.map((p) => p.id)).size === x.placements.length,
    'Objetos repetidos.',
  );
export type RpPlacement = z.infer<typeof rpPlacementSchema>;
export type RpDocument = z.infer<typeof rpDocumentSchema>;
export type RpEntry = {
  id: string;
  name: string;
  kind: 'fixed' | 'temporary';
  owner_name: string | null;
  owner_id: string | null;
  expires_at: string | null;
  document: RpDocument;
  participants: number;
};
export type RpPresence = {
  user_id: string;
  character_id: string;
  name: string;
  x: number;
  y: number;
  scale: number;
  flip_x: boolean;
};
export type RpMessage = {
  id: string;
  user_id: string;
  character_id: string;
  name: string;
  body: string;
  created_at: string;
};
export type RpState = RpEntry & {
  revision: number;
  can_edit: boolean;
  is_owner: boolean;
  presence: RpPresence[];
  messages: RpMessage[];
  invites: { user_id: string; name: string; status: string; can_edit: boolean }[];
};
export type RpIndex = {
  rooms: RpEntry[];
  invites: { room_id: string; name: string; owner_name: string; status: string }[];
};
