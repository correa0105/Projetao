import { races } from './rules.js';

type Race = (typeof races)[number];
// Visual reference heights within the 2024 species descriptions, not fixed rules
// for every individual. The sheet does not yet store an individual height.
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

export function characterHeightScale(race: string, size?: string) {
  if (
    size === 'Pequeno' &&
    ['Humano', 'Tiefling', 'Changeling', 'Khoravar', 'Shifter', 'Warforged'].includes(race)
  )
    return 0.55;
  return (characterStature[race as Race]?.heightCm ?? 175) / 200;
}
