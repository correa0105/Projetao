import { z } from 'zod';

export const weaponStyles = ['sword', 'axe', 'mace', 'spear', 'dagger', 'bow', 'crossbow'] as const;
export type WeaponStyle = (typeof weaponStyles)[number];
export const weaponStyleNames: Record<WeaponStyle, string> = {
  sword: 'Espada',
  axe: 'Machado',
  mace: 'Arma de impacto',
  spear: 'Lança',
  dagger: 'Adaga',
  bow: 'Arco e flecha',
  crossbow: 'Besta e virote',
};
export function weaponKind(style: WeaponStyle): 'sword' | 'arrow' {
  return style === 'bow' || style === 'crossbow' ? 'arrow' : 'sword';
}
export const attackVisualSchema = z
  .object({
    actor_id: z.string().uuid(),
    target_id: z.string().uuid(),
    kind: z.enum(['sword', 'arrow']),
    weapon: z.enum(weaponStyles).optional(),
  })
  .strict()
  .refine((v) => !v.weapon || weaponKind(v.weapon) === v.kind, {
    message: 'A animação precisa corresponder ao tipo da arma.',
    path: ['weapon'],
  });
export type AttackVisualCommand = z.infer<typeof attackVisualSchema>;
export type AttackVisual = AttackVisualCommand & {
  sceneId: string;
  hit: boolean;
  critical?: boolean;
};

export function weaponStyle(name: string): WeaponStyle {
  // Labels include the actor before the middle dot; only the actual attack names the weapon.
  const attack = (name.split(' · ').at(-1) || name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (/\b(besta|crossbow|arbalest)\b/.test(attack)) return 'crossbow';
  if (/\b(arco|bow|longbow|shortbow)\b/.test(attack)) return 'bow';
  if (/\b(machado|machadinha|axe|greataxe|handaxe|battleaxe|halberd|alabarda)\b/.test(attack))
    return 'axe';
  if (
    /\b(martelo|maca|macas|clava|mangual|maul|mace|hammer|warhammer|club|greatclub|flail|morningstar)\b/.test(
      attack,
    )
  )
    return 'mace';
  if (
    /\b(lanca|azagaia|tridente|pique|spear|javelin|trident|pike|quarterstaff|bordao)\b/.test(attack)
  )
    return 'spear';
  if (/\b(adaga|punhal|dagger|knife)\b/.test(attack)) return 'dagger';
  return 'sword';
}
export function weaponVisual(name: string): AttackVisualCommand['kind'] {
  return weaponKind(weaponStyle(name));
}
