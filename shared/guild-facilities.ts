export const guildFacilities = [
  {
    room: 'main',
    name: 'Sino dos Juramentos',
    description: 'Um marco para reunir a companhia e celebrar suas jornadas.',
    x: 0.76,
    y: 0.85,
    scale: 0.18,
  },
  {
    room: 'forge',
    name: 'Bancada do Mestre Ferreiro',
    description: 'Ferramentas e uma bancada sólida para os artesãos da guilda.',
    x: 0.73,
    y: 0.86,
    scale: 0.25,
  },
  {
    room: 'lounge',
    name: 'Aparador da Hospitalidade',
    description: 'Um ponto de acolhimento e descanso entre aventuras.',
    x: 0.68,
    y: 0.86,
    scale: 0.24,
  },
  {
    room: 'meeting',
    name: 'Mesa de Estratégia',
    description: 'Mapas e planos para as próximas expedições da companhia.',
    x: 0.52,
    y: 0.88,
    scale: 0.3,
  },
  {
    room: 'alchemy',
    name: 'Laboratório da Guilda',
    description: 'Uma estação dedicada a estudos e experiências alquímicas.',
    x: 0.7,
    y: 0.87,
    scale: 0.25,
  },
  {
    room: 'training',
    name: 'Posto de Treinamento',
    description: 'Um alvo de prática para aperfeiçoar a disciplina dos aventureiros.',
    x: 0.74,
    y: 0.87,
    scale: 0.17,
  },
  {
    room: 'library',
    name: 'Estante do Saber',
    description: 'Livros e registros que guardam o conhecimento da guilda.',
    x: 0.74,
    y: 0.85,
    scale: 0.18,
  },
  {
    room: 'leader',
    name: 'Escrivaninha do Comando',
    description: 'O lugar de organizar os compromissos e o futuro da companhia.',
    x: 0.65,
    y: 0.87,
    scale: 0.27,
  },
] as const;
export type GuildFacilityRoom = (typeof guildFacilities)[number]['room'];
export const guildFacilityMaxLevel = 10;
export const guildFacilityCost = (currentLevel: number) => currentLevel * 10000;
export const guildFacilityImage = (room: string) => '/guild/facilities-20261018/' + room + '.webp';
