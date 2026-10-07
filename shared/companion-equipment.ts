import type { EquipmentItem } from './equipment.js';
import { equipmentTarget } from './equipment-target.js';
export const COMPANION_SLOTS = [
  'head',
  'armor',
  'shoulders',
  'bracers',
  'legs',
  'feet',
  'neck',
  'cloak',
  'back',
  'belt',
  'saddle',
] as const;
export type CompanionSlot = (typeof COMPANION_SLOTS)[number];
export type CompanionKind = 'mount' | 'pet';
export const COMPANION_SLOT_LABELS: Record<CompanionSlot, string> = {
  head: 'Cabeça',
  armor: 'Armadura / barda',
  shoulders: 'Ombros',
  bracers: 'Proteção das patas dianteiras',
  legs: 'Proteção das patas traseiras',
  feet: 'Patas',
  neck: 'Pescoço',
  cloak: 'Manto',
  back: 'Costas / alforje',
  belt: 'Arreios / bolsa',
  saddle: 'Sela',
};
export type CompanionEquipmentItem = EquipmentItem & {
  item_id: string;
  slot: CompanionSlot;
  source: 'inventory' | 'legacy';
  image_path: string | null;
  description?: string;
};
export type CompanionLegacyOption = EquipmentItem & {
  slot: CompanionSlot;
  source: 'legacy';
  image_path: string | null;
  description?: string;
};
export type CompanionOutfit = {
  id: string;
  kind: CompanionKind;
  name: string;
  species_id: string;
  appearance: string;
  base_image: string;
  image_url: string | null;
  image_revision: number;
  equipment_revision: number;
  art_equipment_revision: number | null;
  art_pending: boolean;
  art_used: number;
  art_limit: number | null;
  quota_scope: 'character';
  legacy_equipment: string[];
  legacy_options: CompanionLegacyOption[];
  equipped: CompanionEquipmentItem[];
  slots: CompanionSlot[];
};
export type CompanionInventoryItem = EquipmentItem & {
  quantity: number;
  allocated: number;
  available: number;
  image_path: string | null;
  description?: string;
};
export type CompanionEquipmentState = {
  companions: CompanionOutfit[];
  inventory: CompanionInventoryItem[];
  worker_available: boolean;
};
export type CompanionArtJob = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'stale';
  companion_id: string;
  kind: CompanionKind;
  equipment_revision: number;
  error?: string | null;
  created_at: string;
  completed_at?: string | null;
};
export function companionSlots(kind: CompanionKind, speciesId: string): CompanionSlot[] {
  if (kind === 'mount') return [...COMPANION_SLOTS];
  if (speciesId === 'snake') return ['head', 'armor', 'neck', 'cloak', 'back', 'belt'];
  if (speciesId === 'owl' || speciesId === 'raven')
    return ['head', 'armor', 'neck', 'cloak', 'back', 'belt', 'feet'];
  return COMPANION_SLOTS.filter((slot) => slot !== 'saddle');
}
export function compatibleCompanionSlots(
  item: EquipmentItem,
  kind: CompanionKind,
  speciesId: string,
): CompanionSlot[] {
  if (equipmentTarget(item) !== kind) return [];
  const allowed = companionSlots(kind, speciesId);
  const configured = item.raw_data?.equipment_slots;
  if (Array.isArray(configured))
    return configured.filter((slot): slot is CompanionSlot =>
      allowed.includes(slot as CompanionSlot),
    );
  const pieceSlot = item.raw_data?.piece_slot;
  if (pieceSlot)
    return allowed.includes(pieceSlot as CompanionSlot) ? [pieceSlot as CompanionSlot] : [];
  if (item.id === 'saddlebags') return kind === 'mount' ? ['back'] : [];
  if (/^horseshoes-/.test(item.id)) return kind === 'mount' ? ['feet'] : [];
  if (/^saddle-/.test(item.id) || /\bsela\b/i.test(item.name))
    return kind === 'mount' ? ['saddle'] : [];
  if (item.raw_data?.barding === true) return ['armor'];
  return [];
}
