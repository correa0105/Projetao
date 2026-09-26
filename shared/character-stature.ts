import { races } from './rules.js';

type Race = (typeof races)[number];
// Visual reference heights within the 2014 racial descriptions, not fixed rules
// for every individual. The sheet does not yet store an individual height.
export const characterStature: Record<Race, { heightCm: number; anatomy: string }> = {
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

export function characterHeightScale(race: string) {
  return (characterStature[race as Race]?.heightCm ?? 175) / 200;
}
