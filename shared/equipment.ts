export const EQUIPMENT_SLOTS = [
  'head',
  'armor',
  'shoulders',
  'bracers',
  'legs',
  'feet',
  'main_hand',
  'off_hand',
  'ring_left',
  'ring_right',
  'neck',
  'cloak',
  'hands',
  'back',
  'belt',
] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];
export const EQUIPMENT_LABELS: Record<EquipmentSlot, string> = {
  head: 'Cabeça / capacete',
  armor: 'Peitoral / armadura',
  shoulders: 'Ombreiras',
  bracers: 'Braçadeiras',
  legs: 'Calça / pernas',
  main_hand: 'Mão principal / arma',
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
export type HelmetMode = 'open' | 'closed';
export function isHelmet(item: { id?: string; item_id?: string; name: string }) {
  return /helmet|capacete|elmo/i.test(`${item.id || item.item_id || ''} ${item.name}`);
}
export function twoHanded(item: EquipmentItem) {
  return ['greatsword', 'longbow', 'shortbow'].includes(item.id) || /duas mãos/i.test(item.name);
}
export function compatibleSlots(item: EquipmentItem): EquipmentSlot[] {
  const name = `${item.id} ${item.name}`.toLowerCase();
  if (/pauldron|ombreira/.test(name)) return ['shoulders'];
  if (/bracer|braçadeira/.test(name)) return ['bracers'];
  if (/legging|calça|perneira/.test(name)) return ['legs'];
  if (/boots|slippers|botas|sandálias|pantufas/.test(name)) return ['feet'];
  if (/gloves|gauntlets|luvas|manoplas/.test(name)) return ['hands'];
  if (/shield|escudo/.test(name)) return ['off_hand'];
  if (item.category === 'Armaduras' || /armor|armadura|cota|couro batido/.test(name))
    return ['armor'];
  if (/ring|anel/.test(name)) return ['ring_left', 'ring_right'];
  if (/helmet|capacete|elmo|chapéu|hat|coroa|tiara/.test(name)) return ['head'];
  if (item.category === 'Armas' || /staff|cajado|bordão/.test(name))
    return twoHanded(item) ? ['main_hand'] : ['main_hand', 'off_hand'];
  if (/cloak|cape|capa|manto/.test(name)) return ['cloak'];
  if (/amulet|necklace|amuleto|colar|medalhão/.test(name)) return ['neck'];
  if (/backpack|mochila/.test(name)) return ['back'];
  if (/belt|pouch|bag-of-holding|cinto|bolsa/.test(name)) return ['belt'];
  if (HANDHELD_ITEMS.has(item.id) || item.category === 'Poções') return ['main_hand', 'off_hand'];
  return [];
}
const HANDHELD_ITEMS = new Set([
  'torch',
  'hooded-lantern',
  'hempen-rope-50-feet',
  'grappling-hook',
  'cigar',
  'candle',
  'waterskin',
  'book',
  'crowbar',
  'shovel',
  'bucket',
  'chain',
  'manacles',
  'tinderbox',
  'glass-bottle',
  'oil',
  'bell',
  'healers-kit',
  'climbers-kit',
  'blanket',
  'rations',
  'antitoxin',
  'acid',
  'alchemists-fire',
  'ball-bearings',
  'caltrops',
  'lock',
]);
export function equipmentBlockMessage(
  slot: EquipmentSlot,
  equipped: (EquipmentItem & { slot: EquipmentSlot })[],
) {
  const main = equipped.find((item) => item.slot === 'main_hand');
  if (slot === 'off_hand' && main && twoHanded(main)) return 'A arma principal ocupa as duas mãos.';
  if (
    slot === 'hands' &&
    equipped.some((item) => item.slot === 'bracers' && item.id === 'plate-bracers')
  )
    return 'As braçadeiras de placas já incluem luvas. Desequipe-as antes de usar outras luvas.';
  return '';
}
export type ArtEquipment = { slot: EquipmentSlot; item_id: string; name: string; image: Buffer };
