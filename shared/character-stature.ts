import { races } from './rules.js';
import type { PhysicalTraits } from './character-appearance.js';

type Race = (typeof races)[number];
// Visual reference heights within the 2024 species descriptions, not fixed rules
// for every individual. Visual height choices vary this baseline without changing size rules.
export const characterStature: Record<
  Race | 'Meio-elfo' | 'Meio-orc',
  { heightCm: number; anatomy: string }
> = {
  Changeling: {
    heightCm: 175,
    anatomy: 'Adulto metamorfo feérico, aparência conforme a referência.',
  },
  Kalashtar: {
    heightCm: 195,
    anatomy: 'Adulto alto de aparência humana, ligado a um espírito quori.',
  },
  Khoravar: {
    heightCm: 170,
    anatomy: 'Adulto com herança humana e élfica, orelhas levemente pontudas.',
  },
  Shifter: {
    heightCm: 175,
    anatomy: 'Adulto humanoide com traços bestiais sutis, sem transformação automática.',
  },
  Warforged: {
    heightCm: 210,
    anatomy: 'Constructo adulto de madeira, pedra e metal, articulado e consciente.',
  },
  Golias: { heightCm: 230, anatomy: 'Adulto muito alto e robusto, herança de gigantes.' },
  Orc: { heightCm: 200, anatomy: 'Adulto alto e robusto, presas e anatomia orc.' },
  Humano: { heightCm: 175, anatomy: 'Anatomia humana adulta, constituição da referência.' },
  Elfo: { heightCm: 175, anatomy: 'Adulto esguio, membros graciosos, orelhas pontudas.' },
  Anão: {
    heightCm: 137,
    anatomy:
      'Adulto baixo e robusto, tronco largo e membros proporcionalmente curtos; não achatar um humano.',
  },
  Halfling: {
    heightCm: 92,
    anatomy:
      'Adulto de estatura pequena, corpo compacto, pernas proporcionalmente curtas e pés largos; rosto adulto, sem aparência infantil ou chibi; não desenhar um humano alto em miniatura.',
  },
  Draconato: {
    heightCm: 200,
    anatomy:
      'Adulto alto e pesado, ombros largos, anatomia dracônica e escamas, constituição robusta.',
  },
  Gnomo: {
    heightCm: 107,
    anatomy:
      'Adulto pequeno, constituição leve, traços faciais e orelhas marcantes; membros coerentes com a estatura, sem aparência infantil ou chibi.',
  },
  'Meio-elfo': { heightCm: 175, anatomy: 'Adulto de porte humano, traços élficos sutis.' },
  'Meio-orc': {
    heightCm: 190,
    anatomy: 'Adulto alto e volumoso, musculatura e ombros robustos, presas discretas.',
  },
  Tiefling: {
    heightCm: 175,
    anatomy: 'Adulto de porte humano, anatomia racial compatível, chifres e cauda.',
  },
};

export function characterHeightScale(
  race: string,
  size?: string,
  traits?: Partial<PhysicalTraits>,
) {
  const variation = traits?.height === 'short' ? 0.88 : traits?.height === 'tall' ? 1.12 : 1;
  if (
    size === 'Pequeno' &&
    ['Humano', 'Tiefling', 'Changeling', 'Khoravar', 'Shifter', 'Warforged'].includes(race)
  )
    return 0.55 * variation;
  return ((characterStature[race as Race]?.heightCm ?? 175) / 200) * variation;
}

export function characterArtAnatomy(race: string, traits?: Partial<PhysicalTraits>) {
  if (!traits) return characterStature[race as Race]?.anatomy || '';
  const anatomy: Record<string, string> = {
    Changeling: 'Metamorfo feérico, traços compatíveis com a referência.',
    Kalashtar: 'Aparência humana, ligado a um espírito quori.',
    Khoravar: 'Herança humana e élfica, orelhas levemente pontudas.',
    Shifter: 'Humanoide com traços bestiais sutis, sem transformação automática.',
    Warforged: 'Constructo consciente de madeira, pedra e metal, articulações coerentes.',
    Golias: 'Anatomia humanoide com herança de gigantes.',
    Orc: 'Anatomia orc, presas raciais.',
    Humano: 'Anatomia humana.',
    Elfo: 'Anatomia élfica, orelhas pontudas.',
    Anão: 'Anatomia anã: tronco e membros com proporções raciais, nunca um humano achatado.',
    Halfling:
      'Anatomia halfling: pernas proporcionalmente curtas e pés largos; não um humano em miniatura ou chibi.',
    Draconato: 'Anatomia dracônica com escamas, sem traços élficos ou humanos incompatíveis.',
    Gnomo:
      'Anatomia gnômica: traços faciais e orelhas marcantes, membros coerentes com a espécie, sem chibi.',
    Tiefling: 'Anatomia tiefling, chifres e cauda coerentes.',
  };
  return anatomy[race] || characterStature[race as Race]?.anatomy || '';
}
