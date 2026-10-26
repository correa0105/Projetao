import type { SoundEntry } from './vtt-sounds';

const scenarioCategories: Record<string, string[]> = {
  'Taverna e cidade': [
    'Taverna',
    'Castelo',
    'Cidade e taverna',
    'Celebração',
    'Interiores',
    'Livros',
    'Madeira',
    'Objetos',
  ],
  'Viagem e natureza': ['Viagem', 'Aventura', 'Natureza', 'Clima', 'Animais', 'Passos'],
  'Masmorras e ruínas': [
    'Masmorras',
    'Subterrâneos',
    'Ruínas',
    'Eco',
    'Passagens secretas',
    'Fechaduras',
    'Pedra e entulho',
    'Desabamentos',
    'Tremores',
    'Armadilhas',
  ],
  'Combate e perigos': ['Batalha', 'Combate', 'Armadilhas', 'Desabamentos', 'Tremores'],
  'Magia e sobrenatural': ['Magia', 'Tensão', 'Mistério'],
  'Criaturas e animais': ['Monstros', 'Animais'],
  'Objetos e ações': [
    'Objetos',
    'Livros',
    'Portas',
    'Metal',
    'Madeira',
    'Vidro e cerâmica',
    'Fechaduras',
    'Fogo e luz',
    'Passos',
  ],
  'Drama e celebração': ['Drama', 'Épico', 'Celebração'],
  'Efeitos imersivos': ['Efeitos de tela'],
};
export function soundScenarios(entry: SoundEntry): string[] {
  return [
    ...new Set([
      ...(entry.scenarios || []),
      ...Object.entries(scenarioCategories)
        .filter(([, categories]) => categories.includes(entry.category))
        .map(([scenario]) => scenario),
    ]),
  ];
}
export const normalizeSoundText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
export function soundMatches(entry: SoundEntry, query: string) {
  const text = normalizeSoundText(
    [
      entry.name,
      entry.description,
      entry.category,
      ...soundScenarios(entry),
      ...(entry.tags || []),
    ].join(' '),
  );
  return normalizeSoundText(query)
    .trim()
    .split(/\s+/)
    .every((token) => text.includes(token));
}
export function soundDuration(seconds: number) {
  const rounded = Math.round(seconds);
  return rounded < 60
    ? rounded + ' s'
    : Math.floor(rounded / 60) + ':' + String(rounded % 60).padStart(2, '0');
}
