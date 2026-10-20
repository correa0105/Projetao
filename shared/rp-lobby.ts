import { z } from 'zod';
import { houseCatalog, houseSupportsFacing } from './house';
import integratedScenes from './rp-scenes-integrated-20261019.json';
export const rpScenes = integratedScenes;
export const rpDecor = houseCatalog.filter((x) => !['letter', 'frame'].includes(x.id));
export const rpPlacementSchema = z
  .object({
    id: z.string().uuid(),
    catalog: z.string().refine((id) => rpDecor.some((x) => x.id === id)),
    x: z.number().finite().min(0.03).max(0.97),
    y: z.number().finite().min(0.18).max(0.98),
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
    placements: z.array(rpPlacementSchema),
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
export type RpSceneItem = RpPlacement & {
  kind: 'prop' | 'pet' | 'mount';
  image?: string;
  name?: string;
  wardrobe_id?: string;
};
export type RpPresence = {
  depth_layer?: number;
  scene_items?: RpSceneItem[];
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
