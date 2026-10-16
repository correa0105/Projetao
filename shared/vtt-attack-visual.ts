import { z } from 'zod';

export const naturalStyles = ['bite', 'claw', 'tail', 'horn', 'slam', 'sting', 'tentacle', 'beak', 'hoof', 'wing', 'touch', 'pincer', 'burst'] as const;
export type NaturalStyle = (typeof naturalStyles)[number];
export const isNaturalStyle = (style: string | undefined): style is NaturalStyle => naturalStyles.includes(style as NaturalStyle);
export const weaponStyles = ['sword', 'axe', 'mace', 'spear', 'dagger', 'bow', 'crossbow', ...naturalStyles] as const;
export type WeaponStyle = (typeof weaponStyles)[number];
export const weaponStyleNames: Record<WeaponStyle, string> = {
  sword: 'Espada',
  axe: 'Machado',
  mace: 'Arma de impacto',
  spear: 'Lança',
  dagger: 'Adaga',
  bow: 'Arco e flecha',
  crossbow: 'Besta e virote',
  bite: 'Mordida', claw: 'Garras', tail: 'Cauda', horn: 'Chifres', slam: 'Pancada',
  sting: 'Ferrão', tentacle: 'Tentáculo', beak: 'Bico', hoof: 'Cascos', wing: 'Asas',
  touch: 'Toque sobrenatural', pincer: 'Pinças', burst: 'Rajada sobrenatural',
};
export function weaponKind(style: WeaponStyle): 'sword' | 'arrow' | 'natural' {
  return isNaturalStyle(style) ? 'natural' : style === 'bow' || style === 'crossbow' ? 'arrow' : 'sword';
}
export const attackVisualSchema = z
  .object({
    actor_id: z.string().uuid(),
    target_id: z.string().uuid(),
    kind: z.enum(['sword', 'arrow', 'natural']),
    weapon: z.enum(weaponStyles).optional(),
  })
  .strict()
  .refine((v) => !v.weapon || weaponKind(v.weapon) === v.kind, {
    message: 'A animação precisa corresponder ao tipo da arma.',
    path: ['weapon'],
  }).refine(v => v.kind !== 'natural' || isNaturalStyle(v.weapon), { message: 'Escolha o tipo de ataque natural.', path: ['weapon'] });
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
  if (/\b(tail|cauda|calda|rabada|rabo)\b/.test(attack)) return 'tail';
  if (/\b(bite|bites|mordida|mordidas|morder|fangs|presas|snake hair)\b/.test(attack)) return 'bite';
  if (/\b(pincer|pincers|pinca|pincas|chela)\b/.test(attack)) return 'pincer';
  if (/\b(claw|claws|garra|garras|arranhao|arranhar|scratch|rake|rend|rasgar|dilacerar|dilaceracao|shred|talon|talons|slash|gouge|draining swipe)\b/.test(attack)) return 'claw';
  if (/\b(hoof|hooves|casco|cascos|coice|foreleg)\b/.test(attack)) return 'hoof';
  if (/\b(beak|beaks|bico|bicada)\b/.test(attack)) return 'beak';
  if (/\b(horn|horns|gore|chifre|chifres|chifrada|tusk|presas de javali)\b/.test(attack)) return 'horn';
  if (/\b(sting|stinger|ferrao|ferroada|proboscis|attach)\b/.test(attack)) return 'sting';
  if (/\b(tentacle|tentacles|tentaculo|tentaculos|tendril|pseudopod|pseudopode|constrict|constricao|constringir|vine lash|beard|grab)\b/.test(attack)) return 'tentacle';
  if (/\b(wing|wings|asa|asas|wind swipe)\b/.test(attack)) return 'wing';
  if (/\b(touch|toque|life drain|drenar vida|drenagem de vida)\b/.test(attack)) return 'touch';
  if (/\b(burst|rajada|bolt|spit|cuspir|cuspe|vile slime|burn|shock)\b/.test(attack)) return 'burst';
  if (/\b(slam|fist|pancada|soco|punho|esmagar|crush|ram|smother|grave strike|grasping hands)\b/.test(attack)) return 'slam';
  if (/\b(machado|machadinha|axe|greataxe|handaxe|battleaxe|halberd|alabarda)\b/.test(attack))
    return 'axe';
  if (
    /\b(martelo|maca|macas|clava|mangual|maul|mace|hammer|warhammer|club|greatclub|flail|morningstar|cudgel)\b/.test(
      attack,
    )
  )
    return 'mace';
  if (
    /\b(lanca|azagaia|tridente|pique|spear|javelin|trident|pike|quarterstaff|bordao|harpoon|fork)\b/.test(attack)
  )
    return 'spear';
  if (/\b(adaga|punhal|dagger|knife)\b/.test(attack)) return 'dagger';
  return 'sword';
}
export function weaponVisual(name: string): AttackVisualCommand['kind'] {
  return weaponKind(weaponStyle(name));
}
