import type { EquipmentMetadata } from '../shared/equipment-target.js';

const marker = ' [Visual mágico obrigatório: ';
const families: Record<string, string> = {
  'Adamantine Armor': 'adamante escuro com reflexos frios e inscrições prateadas de brilho contido',
  'Antimagic Armor': 'selos de anulação em violeta escuro, com luminosidade fina concentrada nas gravações',
  'Armor of Gleaming': 'superfície impecável com reflexos perolados sobrenaturais e filetes de luz nas bordas',
  'Armor of Invulnerability': 'selos protetores em ouro pálido e pequenos arcos luminosos junto à superfície',
  'Armor of Vulnerability': 'inscrições corrompidas em rubi escuro, fissuras luminosas e sombra sutil no acabamento',
  'Armor of Weightlessness': 'filigranas de prata azulada e pequenos motes suspensos junto às bordas da peça',
  'Armor of the Fallen': 'gravações ancestrais em prata espectral e tênue brilho azulado nos relevos',
  'Cast-Off Armor': 'fechos e juntas marcados por selos âmbar luminosos, integrados ao modelo da referência',
  'Demon Armor': 'runas infernais rubras gravadas no acabamento escuro, com brilho de brasa nas linhas',
  'Dwarven Plate': 'gravações geométricas anãs em bronze e ouro antigo, com luminosidade âmbar nas runas',
  'Elven Chain': 'elos delicados de prata clara, filigranas élficas e cintilação azul prateada entre os elos',
  'Feywrought Armor': 'filigranas de folhas com luz verde sálvia e ouro suave, com poucos motes feéricos',
  'Glamoured Studded Leather': 'couro original com costuras arcanas violeta e reflexos iridescentes nos rebites',
  'Gloomwrought Armor': 'gravações violeta profundas e névoa muito fina aderida às bordas da armadura',
  'Last Stand Armor': 'sigilos dourados de proteção e fissuras de luz âmbar, sem dano físico no modelo',
  'Living Armor': 'veios orgânicos púrpura luminosos e textura viva contida no material da armadura',
  "Mariner's Armor": 'arabescos de ondas em turquesa, brilho aquático nas gravações e reflexos perolados',
  'Mithral Armor': 'mithral claro com cintilação azul prateada e filigranas luminosas muito finas',
  'Mizzium Armor': 'liga de cobre prateado com canais de energia azul elétrica e selos gravados',
  'Plate Armor of Etherealness': 'reflexos violetas opalescentes e bordas espectrais luminosas, mantendo a armadura sólida',
  'Ruidium Armor': 'veios minerais de ruidium vermelho profundo e pequenas inclusões cristalinas luminosas',
  'Smoldering Armor': 'fendas de brasa âmbar e fumaça tênue junto ao material, sem incendiar o personagem',
  'Spell-Fueling Armor': 'canais de energia violeta azulada e sigilos de reserva arcana luminosos',
  'Tramontane Armor': 'filamentos arcanos prateados tecidos no material, com luz azul suave nas tramas',
};
const elements: Record<string, string> = {
  acid: 'verde ácido, com arabescos e pequenas gotas de luz esmeralda',
  cold: 'azul glacial, com runas e cristais finos de geada luminosa',
  fire: 'âmbar e laranja de brasa, com runas incandescentes e poucas fagulhas',
  lightning: 'azul elétrico, com filamentos luminosos curtos entre as gravações',
  necrotic: 'violeta espectral, com inscrições e névoa escura muito fina',
  poison: 'verde jade, com inscrições luminosas e névoa tênue junto às bordas',
  psychic: 'ametista e rosa pálido, com sigilos cristalinos e reflexos iridescentes',
  radiant: 'ouro pálido, com selos luminosos e pequenas partículas de luz',
  thunder: 'índigo e prata, com sigilos concêntricos gravados e luz entre as linhas',
  bludgeoning: 'bronze luminoso, com selos geométricos protetores',
  piercing: 'prata azulada, com selos geométricos protetores',
  slashing: 'prata clara, com filigranas protetoras luminosas',
};

/** Catalog metadata only: this describes illustration, never changes game rules. */
export function armorMagicAppearance(raw?: EquipmentMetadata | null) {
  if (!raw || typeof raw.magic_family !== 'string' || !raw.armor_bundle_parent) return undefined;
  const family = raw.magic_family;
  let finish = families[family];
  if (family === 'Armor, +1, +2, or +3') {
    const tier = [1, 2, 3].includes(Number(raw.enhancement)) ? Number(raw.enhancement) : 1;
    finish = `encantamento +${tier}: runas luminosas ${tier === 1 ? 'azul prateadas' : tier === 2 ? 'violeta azuladas' : 'douradas'}, linhas arcanas gravadas e halo fino de intensidade ${tier === 1 ? 'moderada' : tier === 2 ? 'nítida' : 'forte e controlada'}`;
  }
  if (family === 'Armor of Resistance' || family === 'Dragon Scale Mail') {
    const element = typeof raw.damage_type === 'string' ? elements[raw.damage_type] : undefined;
    finish = `${family === 'Dragon Scale Mail' ? 'escamas originais com inscrições dracônicas' : 'sigilos de proteção gravados'} em ${element || 'azul rúnico com luz fina nas gravações'}`;
  }
  finish ||= 'gravações arcanas luminosas e um halo fino coerente com as cores da referência';
  return `${finish}. Encantamento VISÍVEL nas áreas expostas desta peça, legível na figura inteira; não reduzir a um reflexo comum. Preservar corte, material, textura e formato do modelo: couro continua couro, tecido continua tecido, malha continua malha e placas continuam placas. Luz aderida à peça, sem cobrir rosto, capa ou itens mundanos; áreas naturalmente ocultas continuam ocultas. Aparência cosmética, sem conjurar poderes ou acrescentar peças.`;
}

export function withArmorMagicAppearance(name: string, raw?: EquipmentMetadata | null) {
  const effect = armorMagicAppearance(raw);
  return effect ? name + marker + effect + ']' : name;
}

/** The trusted art snapshot carries its design even if the catalog changes later. */
export function snapshottedArmorMagic(item: { name: string }) {
  const start = item.name.indexOf(marker);
  return start < 0 ? undefined : item.name.slice(start + marker.length, item.name.lastIndexOf(']'));
}

export function artEquipmentName(item: { name: string }) {
  const start = item.name.indexOf(marker);
  return start < 0 ? item.name : item.name.slice(0, start);
}

export function magicalArtEquipment(items: { slot: string; item_id: string; name: string }[]) {
  return items.flatMap(item => {
    const appearance = snapshottedArmorMagic(item);
    return appearance ? [{ slot: item.slot, item: item.item_id, appearance }] : [];
  });
}
