import type { BastionProgression } from './guild-bastion';
export const guildFacilities = [
  {
    room: 'main',
    name: 'Sino dos Juramentos',
    description: 'Um marco para reunir a companhia e celebrar suas jornadas.',
    x: 0.82,
    y: 0.66,
    scale: 0.14,
  },
  {
    room: 'forge',
    name: 'Bancada do Mestre Ferreiro',
    description: 'Ferramentas e uma bancada sólida para os artesãos da guilda.',
    x: 0.64,
    y: 0.63,
    scale: 0.25,
  },
  {
    room: 'lounge',
    name: 'Sofá da Hospitalidade',
    description: 'Um ponto de acolhimento e descanso entre aventuras.',
    x: 0.64,
    y: 0.67,
    scale: 0.24,
  },
  {
    room: 'meeting',
    name: 'Mesa de Estratégia',
    description: 'Mapas e planos para as próximas expedições da companhia.',
    x: 0.52,
    y: 0.8,
    scale: 0.34,
  },
  {
    room: 'alchemy',
    name: 'Laboratório da Guilda',
    description: 'Uma estação dedicada a estudos e experiências alquímicas.',
    x: 0.3,
    y: 0.66,
    scale: 0.23,
  },
  {
    room: 'training',
    name: 'Posto de Treinamento',
    description: 'Um alvo de prática para aperfeiçoar a disciplina dos aventureiros.',
    x: 0.76,
    y: 0.68,
    scale: 0.13,
  },
  {
    room: 'library',
    name: 'Estante do Saber',
    description: 'Livros e registros que guardam o conhecimento da guilda.',
    x: 0.34,
    y: 0.55,
    scale: 0.23,
  },
  {
    room: 'leader',
    name: 'Escrivaninha do Comando',
    description: 'O lugar de organizar os compromissos e o futuro da companhia.',
    x: 0.53,
    y: 0.71,
    scale: 0.3,
  },
] as const;
export type GuildFacilityRoom = (typeof guildFacilities)[number]['room'];
export const guildFacilityMaxLevel = 10;
export const guildFacilityCost = (currentLevel: number) => currentLevel * 10000;
export const guildFacilityImage = (room: string) => '/guild/facilities-20261019/' + room + '.webp';
export type GuildFacilityDefinition = {
  room: GuildFacilityRoom;
  name: string;
  description: string;
  upgrade_description: string;
  x: number;
  y: number;
  scale: number;
  revision: number;
  progression?: BastionProgression | null;
};
export type GuildFacilityCatalog = { items: GuildFacilityDefinition[]; can_edit: boolean };
export function defaultGuildFacilities(): GuildFacilityDefinition[] {
  return guildFacilities.map((facility) => ({
    ...facility,
    revision: 0,
    upgrade_description:
      'Esta instalação pertence à guilda. As melhorias ficam registradas para receber benefícios futuramente.',
  }));
}
