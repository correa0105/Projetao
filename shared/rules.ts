export const races = [
  'Humano',
  'Elfo',
  'Anão',
  'Halfling',
  'Draconato',
  'Gnomo',
  'Meio-elfo',
  'Meio-orc',
  'Tiefling',
] as const;
export const classes = [
  'Bárbaro',
  'Bardo',
  'Bruxo',
  'Clérigo',
  'Druida',
  'Feiticeiro',
  'Guerreiro',
  'Ladino',
  'Mago',
  'Monge',
  'Paladino',
  'Patrulheiro',
] as const;
export const hitDice: Record<string, number> = {
  Bárbaro: 12,
  Bardo: 8,
  Bruxo: 8,
  Clérigo: 8,
  Druida: 8,
  Feiticeiro: 6,
  Guerreiro: 10,
  Ladino: 8,
  Mago: 6,
  Monge: 8,
  Paladino: 10,
  Patrulheiro: 10,
};
export const statNames = [
  'Força',
  'Destreza',
  'Constituição',
  'Inteligência',
  'Sabedoria',
  'Carisma',
];
export function modifier(score: number) {
  return Math.floor((score - 10) / 2);
}
export function money(copper: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(copper / 100);
}
