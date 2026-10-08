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
export const BARDING_PARTS = ['head', 'neck', 'chest', 'body', 'front_legs', 'hind_legs'] as const;
export type BardingPart = (typeof BARDING_PARTS)[number];
export const BARDING_PART_LABELS: Record<BardingPart, string> = {
  head: 'Capacete / testeira',
  neck: 'Proteção do pescoço',
  chest: 'Proteção do peito',
  body: 'Tronco e flancos',
  front_legs: 'Proteção das patas dianteiras',
  hind_legs: 'Proteção das patas traseiras',
};
export function isBarding(itemId: string) {
  return /^(?:legacy:)?barding-/.test(itemId);
}
export function supportsArmorParts(kind: CompanionKind, speciesId: string) {
  return kind === 'mount' || speciesId === 'dog';
}
export function armorPartLabel(part: BardingPart, kind: CompanionKind) {
  return part === 'head' && kind === 'pet' ? 'Proteção da cabeça' : BARDING_PART_LABELS[part];
}
export function visibleDogArmor(
  itemId: string,
  slot: CompanionSlot,
  parts: readonly BardingPart[],
) {
  if (!itemId.startsWith('pet-armor-')) return true;
  if (slot === 'armor') return parts.length > 0;
  const regions: Partial<Record<CompanionSlot, BardingPart[]>> = {
    head: ['head'],
    shoulders: ['neck', 'chest', 'body'],
    bracers: ['front_legs'],
    legs: ['hind_legs'],
    feet: ['front_legs', 'hind_legs'],
  };
  return (regions[slot] || []).some((part) => parts.includes(part));
}
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
  belt: 'Arreios / acessórios',
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
  barding_parts?: BardingPart[];
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
  if (kind === 'mount') return ['head', 'armor', 'neck', 'cloak', 'back', 'belt', 'saddle'];
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
  if (
    kind === 'mount' &&
    item.raw_data?.piece_slot &&
    item.raw_data?.armor_bundle_parent !== item.id
  )
    return [];
  const allowed = companionSlots(kind, speciesId);
  if (/^horseshoes-/.test(item.id)) return kind === 'mount' ? ['belt'] : [];
  const configured = item.raw_data?.equipment_slots;
  if (Array.isArray(configured))
    return configured.filter((slot): slot is CompanionSlot =>
      allowed.includes(slot as CompanionSlot),
    );
  const pieceSlot = item.raw_data?.piece_slot;
  if (pieceSlot)
    return allowed.includes(pieceSlot as CompanionSlot) ? [pieceSlot as CompanionSlot] : [];
  if (item.id === 'saddlebags') return kind === 'mount' ? ['back'] : [];
  if (/^saddle-/.test(item.id) || /\bsela\b/i.test(item.name))
    return kind === 'mount' ? ['saddle'] : [];
  if (item.raw_data?.barding === true) return ['armor'];
  return [];
}
