export type EquipmentTarget = 'human' | 'mount' | 'pet';
export type EquipmentMetadata = {
  equipment_target?: EquipmentTarget;
  equipment_slots?: string[];
  armor_bundle_parent?: string;
  piece_slot?: string;
  armor_bundle_pieces?: { id: string; slot: string }[];
  armor_bundle_weight_lb?: number;
  armor_bundle_model_image?: string;
  armor_bundle_name?: string;
  armor_piece_name?: string;
  [key: string]: unknown;
};
export type TargetedItem = { id: string; category: string; raw_data?: EquipmentMetadata | null };
const mountItems = new Set([
  'saddle-exotic',
  'saddle-military',
  'saddle-riding',
  'saddlebags',
  'horseshoes-of-a-zephyr',
  'horseshoes-of-speed',
]);
// Only catalog taxonomy or these explicit catalog IDs grant an animal target.
// A humanoid item name or slot must never make it wearable by an animal.
export function equipmentTarget(item: TargetedItem): EquipmentTarget {
  const target = item.raw_data?.equipment_target;
  if (target === 'human' || target === 'mount' || target === 'pet') return target;
  if (
    mountItems.has(item.id) ||
    item.category === 'Equipamento de montaria' ||
    item.category === 'Equipamentos de montaria'
  )
    return 'mount';
  if (item.category === 'Acessórios para pet') return 'pet';
  return 'human';
}
