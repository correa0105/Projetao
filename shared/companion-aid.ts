import type { Mount } from './mounts.js';
import type { Pet } from './pets.js';

export type CompanionAid = {
  name: string;
  skill: string;
  situation: string;
  bonus: 1 | 2;
};

const pets = {
  dog: ['Faro de estrada', 'Sobrevivência', 'seguir rastros pelo cheiro'],
  cat: ['Patas de veludo', 'Furtividade', 'atravessar um aposento sem fazer ruído'],
  rabbit: ['Orelhas em alerta', 'Percepção', 'ouvir passos em campo aberto'],
  owl: ['Olhar noturno', 'Percepção', 'avistar movimento em penumbra'],
  fox: ['Desvio da raposa', 'Investigação', 'encontrar a saída escondida de uma trilha'],
  raven: ['Brilho roubado', 'Investigação', 'localizar um pequeno objeto metálico escondido'],
  frog: ['Coro do brejo', 'Natureza', 'reconhecer sinais de água parada ou brejo'],
  snake: ['Passagem estreita', 'Investigação', 'examinar uma fresta ou uma cavidade no chão'],
  rat: ['Faro de despensa', 'Sobrevivência', 'procurar alimento em ruínas ou cidades'],
  'guinea-pig': [
    'Assobio tranquilizador',
    'Adestrar Animais',
    'acalmar um animal doméstico assustado',
  ],
} satisfies Record<Pet['id'], readonly [string, string, string]>;

const breeds: Record<string, readonly [string, string, string]> = {
  'dog:shepherd': ['Vigia do rebanho', 'Adestrar Animais', 'guiar um pequeno rebanho em segurança'],
  'cat:longhair': ['Presença serena', 'Persuasão', 'tranquilizar alguém que acolheu o gato'],
  'rabbit:runic': ['Saltos sobre runas', 'Arcanismo', 'localizar marcas arcanas no piso'],
  'owl:horned': ['Vigília âmbar', 'Percepção', 'distinguir silhuetas acima das copas'],
  'raven:shadow': ['Gralha no escuro', 'Furtividade', 'atravessar uma viela escura sem ser ouvido'],
  'snake:emerald': ['Escamas do antídoto', 'Medicina', 'identificar sinais de envenenamento'],
  'rat:fluffy': ['Ninho improvisado', 'Sobrevivência', 'encontrar abrigo seco em um subterrâneo'],
};

const mounts = {
  'riding-horse': ['Memória da estrada', 'Sobrevivência', 'reencontrar uma estrada conhecida'],
  warhorse: [
    'Passo de veterano',
    'Intimidação',
    'dissuadir alguém que bloqueia a passagem sem combate',
  ],
  pony: ['Casco leve', 'Acrobacia', 'manter o equilíbrio em terreno pedregoso com ajuda do pônei'],
  mule: ['Instinto de carga', 'Atletismo', 'mover uma carga pesada com a ajuda da mula'],
  'eclipse-stag': [
    'Trilha Entre Véus',
    'Sobrevivência',
    'traçar uma rota sob neblina ou pouca luz',
  ],
} satisfies Record<Mount['id'], readonly [string, string, string]>;

export function companionAid(
  kind: 'pet' | 'mount',
  species: string,
  appearance = 'original',
): CompanionAid | undefined {
  const catalog: Record<string, readonly [string, string, string]> = kind === 'pet' ? pets : mounts;
  const breed = species + ':' + appearance;
  const entry =
    kind === 'pet' && Object.hasOwn(breeds, breed)
      ? breeds[breed]
      : Object.hasOwn(catalog, species)
        ? catalog[species]
        : undefined;
  if (!entry) return;
  const [name, skill, situation] = entry;
  return { name, skill, situation, bonus: species === 'eclipse-stag' ? 2 : 1 };
}

export function companionAidSummary(aid: CompanionAid) {
  return `${aid.name} · +${aid.bonus} em ${aid.skill} para ${aid.situation}.`;
}
