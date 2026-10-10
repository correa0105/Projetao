import { conditionGlyphs } from './vtt-condition-glyphs.js';
export type ConditionGlyph = { d: string; fill?: boolean };
export type ConditionIcon = { name: string; color: string; hint: string; paths: ConditionGlyph[] };
const p = (d: string, fill = false): ConditionGlyph => ({ d, fill });
// Thirty original vector pictograms. Existing condition names stay compatible with saved rooms.
const definitions: ConditionIcon[] = [
  {
    name: 'Cego',
    color: '#f1dbb3',
    hint: 'Visão comprometida',
    paths: [
      p('M3 12 Q12 3 21 12 Q12 21 3 12 Z'),
      p('M9 12 A3 3 0 1 0 15 12 A3 3 0 1 0 9 12'),
      p('M3 3 L21 21'),
    ],
  },
  {
    name: 'Enfeitiçado',
    color: '#ef89ba',
    hint: 'Sob influência de encanto',
    paths: [
      p('M12 18 C-1 10 5 1 12 7 C19 1 25 10 12 18 Z', true),
      p('M7 19 L5 21 M12 20 V23 M17 19 L19 21'),
    ],
  },
  {
    name: 'Surdo',
    color: '#e6c999',
    hint: 'Audição comprometida',
    paths: [
      p('M7 7 C7 1 20 1 20 9 C20 15 13 15 13 19 C13 23 7 23 7 19'),
      p('M12 7 C12 3 17 5 16 10 L13 12'),
      p('M3 3 L21 21'),
    ],
  },
  {
    name: 'Exausto',
    color: '#d7b18c',
    hint: 'Cansaço intenso',
    paths: [
      p('M10 4 A2 2 0 1 0 14 4 A2 2 0 1 0 10 4', true),
      p('M12 8 L8 13 L14 16 L12 22 M8 13 L4 18 M12 9 L16 13 L20 13'),
    ],
  },
  {
    name: 'Amedrontado',
    color: '#b09ce6',
    hint: 'Dominado pelo medo',
    paths: [
      p('M5 13 C0 0 24 0 19 13 L16 16 V20 H8 V16 Z'),
      p('M7 10 L10 11 M17 10 L14 11 M10 18 V21 M14 18 V21'),
      p('M12 12 L10 15 H14 Z', true),
    ],
  },
  {
    name: 'Agarrado',
    color: '#f2bf6b',
    hint: 'Preso por uma criatura',
    paths: [
      p(
        'M7 21 L4 12 Q3 8 6 10 L8 13 V5 Q8 2 10 5 V11 V3 Q12 1 13 4 V11 V5 Q15 3 16 6 V12 V9 Q19 7 19 11 V17 L17 21 Z',
      ),
    ],
  },
  {
    name: 'Incapacitado',
    color: '#e99794',
    hint: 'Sem capacidade de agir',
    paths: [
      p('M12 3 L15 8 L21 7 L18 12 L21 17 L15 16 L12 22 L9 16 L3 17 L6 12 L3 7 L9 8 Z'),
      p('M8 8 L16 16 M16 8 L8 16'),
    ],
  },
  {
    name: 'Invisível',
    color: '#8ebfe3',
    hint: 'Oculto à visão comum',
    paths: [
      p('M10 5 A2 2 0 1 0 14 5 A2 2 0 1 0 10 5'),
      p('M8 11 L6 14 M9 10 H15 M16 11 L18 14 M9 16 L8 21 M15 16 L16 21'),
      p('M3 3 L5 3 M19 3 L21 3 M3 21 H5 M19 21 H21'),
    ],
  },
  {
    name: 'Paralisado',
    color: '#d6b2ef',
    hint: 'Corpo sem movimento',
    paths: [
      p('M9 5 A3 3 0 1 0 15 5 A3 3 0 1 0 9 5'),
      p('M8 11 H16 V16 H14 V22 H10 V16 H8 Z', true),
      p('M3 6 V17 M21 6 V17 M2 9 H5 M19 14 H22'),
    ],
  },
  {
    name: 'Petrificado',
    color: '#b6c2c7',
    hint: 'Transformado em pedra',
    paths: [
      p('M8 3 H16 L19 8 L17 16 H15 V21 H9 V16 H7 L5 8 Z'),
      p('M10 4 L12 9 L9 12 L13 15 M15 7 L13 10'),
    ],
  },
  {
    name: 'Envenenado',
    color: '#a7de61',
    hint: 'Afetado por veneno',
    paths: [
      p('M9 3 H15 M10 3 V9 L5 18 Q4 21 8 21 H16 Q20 21 19 18 L14 9 V3'),
      p('M7 16 H17'),
      p('M10 12 L14 16 M14 12 L10 16'),
    ],
  },
  {
    name: 'Caído',
    color: '#e6c496',
    hint: 'No chão',
    paths: [
      p('M4 14 A2 2 0 1 0 8 14 A2 2 0 1 0 4 14', true),
      p(
        'M9 15 L15 15 L19 12 L21 15 M14 15 L18 18 M11 15 L10 19 M3 21 H21 M12 2 V9 M9 6 L12 9 L15 6',
      ),
    ],
  },
  {
    name: 'Impedido',
    color: '#d8aa75',
    hint: 'Movimento restringido',
    paths: [
      p('M4 5 C1 2 7 0 9 3 L13 7 C16 10 11 15 8 12 Z'),
      p('M11 11 C8 8 14 5 17 8 L21 12 C24 15 19 21 16 18 Z'),
      p('M8 8 L16 16'),
    ],
  },
  {
    name: 'Atordoado',
    color: '#f1d461',
    hint: 'Desorientado e sem reação',
    paths: [
      p('M7 17 C4 10 18 8 18 16 V21 H9 V18 Z'),
      p('M7 3 L8 6 L11 7 L8 8 L7 11 L6 8 L3 7 L6 6 Z', true),
      p('M17 1 L18 4 L21 5 L18 6 L17 9 L16 6 L13 5 L16 4 Z', true),
    ],
  },
  {
    name: 'Inconsciente',
    color: '#9faedb',
    hint: 'Sem consciência',
    paths: [
      p('M5 18 C1 4 23 4 19 18 Z'),
      p('M7 13 Q9 15 11 13 M13 13 Q15 15 17 13'),
      p('M14 2 Q19 7 22 4 Q19 12 14 2 Z', true),
    ],
  },
  {
    name: 'Concentração',
    color: '#89cff3',
    hint: 'Mantendo concentração',
    paths: [
      p('M7 19 C3 11 7 7 12 7 C18 7 21 12 17 19 M9 21 H15'),
      p('M10 13 A2 2 0 1 0 14 13 A2 2 0 1 0 10 13', true),
      p('M12 1 V4 M3 5 L5 7 M21 5 L19 7'),
    ],
  },
  {
    name: 'Mancando',
    color: '#e6bd91',
    hint: 'Perna ferida ou marcha irregular',
    paths: [
      p('M9 3 L11 10 L8 16 L12 21 H7 L5 16 L8 9 L6 4'),
      p('M17 3 L19 21 M14 4 H21 M16 10 H20'),
    ],
  },
  {
    name: 'Asas',
    color: '#e7e0bd',
    hint: 'Com asas ou em voo',
    paths: [
      p('M11 18 C3 18 1 10 3 3 L9 8 L11 15 Z'),
      p('M13 18 C21 18 23 10 21 3 L15 8 L13 15 Z'),
      p('M4 8 L8 13 M4 12 L8 16 M20 8 L16 13 M20 12 L16 16'),
    ],
  },
  {
    name: 'Eletrizado',
    color: '#76ccff',
    hint: 'Afetado por choque elétrico',
    paths: [p('M13 2 L5 13 H11 L9 22 L20 9 H13 Z', true), p('M2 7 L5 5 M19 19 L22 17')],
  },
  {
    name: 'Queimando',
    color: '#ffab54',
    hint: 'Em chamas',
    paths: [
      p('M13 2 C17 8 9 9 16 12 L19 8 C25 19 16 23 10 22 C1 20 3 11 7 8 C6 17 14 12 13 2 Z', true),
      p('M12 13 C9 18 10 20 14 20'),
    ],
  },
  {
    name: 'Congelado',
    color: '#91e6fa',
    hint: 'Afetado por gelo',
    paths: [
      p(
        'M12 2 V22 M3 7 L21 17 M3 17 L21 7 M8 4 L12 7 L16 4 M8 20 L12 17 L16 20 M3 11 L7 10 L7 6 M17 18 L17 14 L21 13 M3 13 L7 14 L7 18 M17 6 L17 10 L21 11',
      ),
    ],
  },
  {
    name: 'Sangrando',
    color: '#ff7278',
    hint: 'Perdendo sangue',
    paths: [
      p('M12 2 C10 8 5 11 5 16 A7 7 0 0 0 19 16 C19 11 14 8 12 2 Z', true),
      p('M9 15 Q8 19 12 19'),
    ],
  },
  {
    name: 'Silenciado',
    color: '#d0b0df',
    hint: 'Sem poder falar',
    paths: [p('M4 12 Q12 6 20 12 Q12 18 4 12 Z'), p('M5 12 H19 M3 3 L21 21')],
  },
  {
    name: 'Dormindo',
    color: '#aeb5ef',
    hint: 'Dormindo',
    paths: [p('M3 9 H11 L3 18 H11 M13 3 H21 L13 11 H21 M3 22 H21')],
  },
  {
    name: 'Marcado',
    color: '#f08b67',
    hint: 'Alvo marcado',
    paths: [
      p('M5 12 A7 7 0 1 0 19 12 A7 7 0 1 0 5 12'),
      p('M10 12 A2 2 0 1 0 14 12 A2 2 0 1 0 10 12', true),
      p('M12 1 V6 M12 18 V23 M1 12 H6 M18 12 H23'),
    ],
  },
  {
    name: 'Protegido',
    color: '#7cbff0',
    hint: 'Sob proteção',
    paths: [p('M12 2 L21 6 V12 Q21 19 12 23 Q3 19 3 12 V6 Z'), p('M12 6 V18 M7 11 H17')],
  },
  {
    name: 'Regenerando',
    color: '#86dda2',
    hint: 'Recuperando vitalidade',
    paths: [p('M3 15 Q2 3 17 4 Q18 17 3 15 Z'), p('M3 18 L13 8 M18 14 V22 M14 18 H22')],
  },
  {
    name: 'Lentidão',
    color: '#d6b18c',
    hint: 'Movimento ou ações lentos',
    paths: [
      p('M6 2 H18 M6 22 H18 M7 3 V7 L17 17 V21 M17 3 V7 L7 17 V21'),
      p('M9 18 H15 L12 14 Z', true),
    ],
  },
  {
    name: 'Acelerado',
    color: '#80e0d6',
    hint: 'Movimento acelerado',
    paths: [
      p('M13 3 L16 10 L21 14 V19 H9 L7 14 L12 12 L10 5 Z', true),
      p('M1 6 H7 M2 10 H6 M1 19 H5'),
    ],
  },
  {
    name: 'Inspirado',
    color: '#ffdb73',
    hint: 'Com inspiração',
    paths: [
      p('M7 8 Q12 3 17 8 L16 17 Q12 22 8 17 Z'),
      p('M9 8 V17 M12 7 V18 M15 8 V17 M3 4 L5 6 M21 4 L19 6 M12 1 V3'),
    ],
  },
];
export const conditionIcons: ConditionIcon[] = definitions.map(icon => ({...icon, paths: conditionGlyphs[icon.name] || icon.paths}));
export function conditionIcon(name: string) {
  return conditionIcons.find((icon) => icon.name === name);
}
export function toggledCondition(current: readonly string[], name: string, gm: boolean): string[] {
  if (current.includes(name)) return gm ? current.filter((item) => item !== name) : [...current];
  return current.length < 30 ? [...current, name] : [...current];
}
