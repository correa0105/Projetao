export const EQUIPMENT_SLOTS = [
  'head',
  'armor',
  'main_hand',
  'off_hand',
  'ring_left',
  'ring_right',
  'neck',
  'cloak',
  'hands',
  'feet',
  'back',
  'belt',
] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];
export const EQUIPMENT_LABELS: Record<EquipmentSlot, string> = {
  head: 'Cabeça / capacete',
  armor: 'Armadura',
  main_hand: 'Arma principal',
  off_hand: 'Mão secundária / escudo',
  ring_left: 'Anel esquerdo',
  ring_right: 'Anel direito',
  neck: 'Pescoço',
  cloak: 'Capa',
  hands: 'Luvas',
  feet: 'Botas',
  back: 'Mochila / costas',
  belt: 'Cinto / bolsa',
};
export type EquipmentItem = { id: string; name: string; category: string };
export function twoHanded(item: EquipmentItem) {
  return ['greatsword', 'longbow', 'shortbow'].includes(item.id) || /duas mãos/i.test(item.name);
}
export function compatibleSlots(item: EquipmentItem): EquipmentSlot[] {
  const name = `${item.id} ${item.name}`.toLowerCase();
  if (/ring|anel/.test(name)) return ['ring_left', 'ring_right'];
  if (/shield|escudo/.test(name)) return ['off_hand'];
  if (/helmet|capacete|elmo|chapéu|hat|coroa/.test(name)) return ['head'];
  if (item.category === 'Armaduras' || /armor|armadura|cota|couro batido/.test(name))
    return ['armor'];
  if (item.category === 'Armas' || /staff|cajado|bordão/.test(name))
    return twoHanded(item) ? ['main_hand'] : ['main_hand', 'off_hand'];
  if (/boots|slippers|botas|sandálias|pantufas/.test(name)) return ['feet'];
  if (/cloak|cape|capa|manto/.test(name)) return ['cloak'];
  if (/gloves|gauntlets|luvas|manoplas/.test(name)) return ['hands'];
  if (/amulet|necklace|amuleto|colar|medalhão/.test(name)) return ['neck'];
  if (/backpack|mochila/.test(name)) return ['back'];
  if (/belt|pouch|bag-of-holding|cinto|bolsa/.test(name)) return ['belt'];
  return [];
}
export type ArtEquipment = { slot: EquipmentSlot; item_id: string; name: string; image: Buffer };
