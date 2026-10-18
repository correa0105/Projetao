// Latest published species only; ERLW versions are superseded by EFA (2025).
export const EBERRON_SOURCE = 'Eberron: Forge of the Artificer (2025)';
export const eberronSpecies = {
  Changeling: {
    speed: 9,
    size: 'Médio',
    variants: ['Changeling'],
    traits: [
      'Tipo de criatura: Feérico.',
      'Instintos changeling: duas perícias entre Atuação, Enganação, Intimidação, Intuição e Persuasão.',
      'Metamorfo: ação para mudar voz, aparência e tamanho entre Pequeno e Médio, conservando estatísticas, membros e equipamento. Só pode imitar alguém que já viu. A forma dura até usar outra ação para revertê-la; nela, tem vantagem em testes de Carisma.',
    ],
  },
  Kalashtar: {
    speed: 9,
    size: 'Médio',
    variants: ['Kalashtar'],
    traits: [
      'Tipo de criatura: Aberração.',
      'Mente dupla: vantagem em salvaguardas de Sabedoria e Carisma.',
      'Disciplina mental: resistência a dano psíquico.',
      'Vínculo mental: telepatia de 3 m por nível. Com uma ação Mágica, permite que o interlocutor responda por uma hora; outra ação Mágica encerra esse vínculo.',
      'Separado dos sonhos: não pode ser alvo de Sonho. Escolhe uma perícia após cada descanso longo, conservada até o próximo.',
    ],
  },
  Khoravar: {
    speed: 9,
    size: 'Médio',
    variants: ['Khoravar'],
    traits: [
      'Tipo de criatura: Humanoide.',
      'Visão no escuro: 18 m.',
      'Ancestralidade feérica: vantagem para evitar ou encerrar Enfeitiçado.',
      'Dom feérico: um truque, inicialmente Amizade; após descanso longo pode escolher outro da lista de Clérigo, Druida ou Mago.',
      'Resiliência à letargia: pode transformar uma salvaguarda falha contra Inconsciente em sucesso; recupera após 1d4 descansos longos.',
      'Versatilidade: uma perícia ou ferramenta, substituível após descanso longo.',
    ],
  },
  Shifter: {
    speed: 9,
    size: 'Médio',
    variants: ['Pele bestial', 'Dentes longos', 'Passo veloz', 'Caçada selvagem'],
    traits: [
      'Tipo de criatura: Humanoide.',
      'Visão no escuro: 18 m.',
      'Instintos bestiais: uma perícia entre Acrobacia, Atletismo, Intimidação e Sobrevivência.',
      'Transmutação bestial: ação bônus, duração de um minuto, encerrada também por ação bônus. Concede PV temporários iguais ao dobro da proficiência; usos iguais à proficiência por descanso longo. O benefício da linhagem só vale enquanto transformado.',
    ],
  },
  Warforged: {
    speed: 9,
    size: 'Médio',
    variants: ['Warforged'],
    traits: [
      'Tipo de criatura: Constructo.',
      'Resiliência construída: resistência a dano venenoso e vantagem para evitar ou encerrar Envenenado.',
      'Proteção integrada: +1 na CA. Enquanto vivo, sua armadura não pode ser retirada contra sua vontade.',
      'Repouso de sentinela: não precisa dormir e é imune ao sono mágico. Pode completar descanso longo em seis horas inerte e consciente.',
      'Projeto especializado: uma perícia e uma ferramenta à escolha.',
      'Incansável: desidratação, desnutrição e sufocamento não causam níveis de Exaustão.',
    ],
  },
};
export const shifterBenefits: Record<string, string> = {
  'Pele bestial':
    'Pele bestial: ao transformar, ganha mais 1d6 PV temporários; +1 CA durante a transformação.',
  'Dentes longos':
    'Dentes longos: ao transformar e por ação bônus nos turnos seguintes, pode atacar desarmado com as presas, causando 1d6 + Força de dano perfurante no acerto.',
  'Passo veloz':
    'Passo veloz: +3 m de deslocamento; reação para mover até 3 m sem ataque de oportunidade quando uma criatura termina o turno a até 1,5 m.',
  'Caçada selvagem':
    'Caçada selvagem: vantagem em testes de Sabedoria; criaturas a até 9 m não têm vantagem em ataques contra você, exceto se estiver Incapacitado.',
};
