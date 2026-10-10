/** Withdrawn offers keep their catalog rows for existing inventories and orders. */
export const withdrawnWeaponModels = [
  'laser-pistol',
  'semiautomatic-pistol',
  'revolver',
  'automatic-rifle',
  'antimatter-rifle',
  'laser-rifle',
] as const;

export function withdrawnWeaponOffer(item: { id: string; raw_data?: { base_item?: string } }) {
  return withdrawnWeaponModels.some(
    (model) => model === item.id || model === item.raw_data?.base_item,
  );
}
