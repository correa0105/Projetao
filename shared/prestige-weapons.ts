type WeaponStage = {
  level: number;
  bonus: 1 | 2 | 3;
  rarity: 'Incomum' | 'Rara' | 'Muito rara';
};

type WeaponEffect = 'critical' | 'distant' | 'wounded-wielder' | 'wounded-target';

export type PrestigeWeapon = {
  id: string;
  name: string;
  stages: readonly [WeaponStage, ...WeaponStage[]];
  effect: WeaponEffect;
  effectLevel: number;
  effectText: string;
};

export const prestigeWeapons: readonly PrestigeWeapon[] = [
  {
    id: 'prestige-espada-aurora-velada',
    name: 'Espada da Aurora Velada',
    stages: [
      { level: 5, bonus: 1, rarity: 'Incomum' },
      { level: 11, bonus: 2, rarity: 'Rara' },
      { level: 17, bonus: 3, rarity: 'Muito rara' },
    ],
    effect: 'critical',
    effectLevel: 11,
    effectText:
      'Clarão do Alvorecer · A partir do nível 11, um crítico causa 1d4 de dano extra. Esse dado extra já faz parte do crítico.',
  },
  {
    id: 'prestige-arco-do-eclipse',
    name: 'Arco do Eclipse',
    stages: [
      { level: 5, bonus: 1, rarity: 'Incomum' },
      { level: 13, bonus: 2, rarity: 'Rara' },
    ],
    effect: 'distant',
    effectLevel: 5,
    effectText:
      'Flecha do Horizonte · +2 de dano quando o alvo está entre 40 e 150 pés (cerca de 12 a 46 m).',
  },
  {
    id: 'prestige-martelo-sentinela',
    name: 'Martelo da Sentinela',
    stages: [{ level: 9, bonus: 2, rarity: 'Rara' }],
    effect: 'wounded-wielder',
    effectLevel: 9,
    effectText: 'Última Vigília · +2 de dano quando o portador ataca com metade dos PV ou menos.',
  },
  {
    id: 'prestige-rapieira-ressaca',
    name: 'Rapieira da Ressaca',
    stages: [{ level: 5, bonus: 1, rarity: 'Incomum' }],
    effect: 'wounded-target',
    effectLevel: 5,
    effectText: 'Corrente de Retorno · +1 de dano quando o alvo tem metade dos PV ou menos.',
  },
];

export function prestigeWeapon(itemId: string | null | undefined) {
  return prestigeWeapons.find((weapon) => weapon.id === itemId);
}

export function prestigeWeaponStage(weapon: PrestigeWeapon, level: number) {
  return weapon.stages.findLast((stage) => stage.level <= level);
}

const updatedSkinArt: Readonly<Record<string, string>> = {
  '/shop/homebrew/arco-vigilia-celeste.webp': '/shop/reliquias-forja/arco-vigilia-v2.webp',
  '/shop/homebrew/adaga-primeiro-broto.webp': '/shop/reliquias-forja/adaga-broto-v2.webp',
};

export function prestigeSkinArt(path: string | null | undefined) {
  return path ? (updatedSkinArt[path] ?? path) : null;
}
