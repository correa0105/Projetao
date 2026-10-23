import { z } from 'zod';

export const beardStyles = [
  {
    id: 'none',
    name: 'Sem barba',
    description: 'Bochechas, queixo e maxilar raspados.',
    instruction:
      'Sem barba, cavanhaque, costeletas ou pelos nas bochechas, queixo e maxilar; essas áreas ficam raspadas.',
  },
  {
    id: 'stubble',
    name: 'Por fazer',
    description: 'Pelos bem curtos, com a pele aparente.',
    instruction:
      'Barba por fazer: pelos muito curtos e uniformes nas bochechas, maxilar e queixo, mantendo a superfície do rosto aparente.',
  },
  {
    id: 'short',
    name: 'Curta',
    description: 'Barba curta e bem aparada.',
    instruction:
      'Barba curta bem aparada, cerca de dois centímetros, cobrindo bochechas, maxilar e queixo.',
  },
  {
    id: 'full',
    name: 'Cheia',
    description: 'Volume médio e contorno arredondado.',
    instruction:
      'Barba cheia, densa e arredondada de comprimento médio, cerca de oito centímetros abaixo do queixo.',
  },
  {
    id: 'goatee',
    name: 'Cavanhaque',
    description: 'Concentrado no queixo, bochechas raspadas.',
    instruction: 'Cavanhaque pontudo somente no queixo; bochechas e laterais do maxilar raspadas.',
  },
  {
    id: 'braided',
    name: 'Longa trançada',
    description: 'Barba longa terminando em uma trança.',
    instruction:
      'Barba longa e cheia terminando em uma única trança de pelos sobre o peito, sem contas, presilhas, anéis ou joias.',
  },
] as const;
export const mustacheStyles = [
  {
    id: 'none',
    name: 'Sem bigode',
    description: 'Região acima da boca raspada.',
    instruction:
      'Sem bigode: região acima da boca completamente raspada, sem pelos sobre o lábio superior, mesmo com barba cheia.',
  },
  {
    id: 'pencil',
    name: 'Fino',
    description: 'Linha estreita sobre o lábio superior.',
    instruction:
      'Bigode fino: faixa estreita e curta, precisamente aparada sobre o lábio superior.',
  },
  {
    id: 'chevron',
    name: 'Cheio',
    description: 'Denso, com pontas curtas junto à boca.',
    instruction:
      'Bigode cheio em V invertido, denso sobre o lábio superior, com pontas curtas próximas aos cantos da boca.',
  },
  {
    id: 'handlebar',
    name: 'Pontas curvadas',
    description: 'Pontas finas enroladas para cima.',
    instruction:
      'Bigode de pontas curvadas: centro de volume médio e duas pontas longas e finas enroladas para cima.',
  },
  {
    id: 'walrus',
    name: 'Morsa',
    description: 'Muito volumoso, caindo sobre o lábio.',
    instruction:
      'Bigode morsa muito espesso e largo, caindo sobre o lábio superior e com pontas voltadas para baixo.',
  },
  {
    id: 'horseshoe',
    name: 'Ferradura',
    description: 'Duas faixas descem pelos lados da boca.',
    instruction:
      'Bigode ferradura: duas faixas verticais descem dos cantos da boca até os lados do queixo, deixando o centro do queixo livre quando não houver barba.',
  },
  {
    id: 'english',
    name: 'Inglês',
    description: 'Pontas longas, finas e horizontais.',
    instruction:
      'Bigode inglês dividido no centro, com pontas longas, finas, retas e horizontais, sem enrolar ou cair.',
  },
] as const;
export const facialHairColors = [
  { id: 'brown', name: 'Marrom', color: '#65402b', instruction: 'marrom' },
  { id: 'black', name: 'Preto', color: '#1b1918', instruction: 'preto' },
  { id: 'white', name: 'Branco', color: '#eee9df', instruction: 'branco' },
  { id: 'blond', name: 'Loiro', color: '#d3ad60', instruction: 'loiro' },
] as const;
export const facialHairSchema = z
  .object({
    beard: z.enum(['none', 'stubble', 'short', 'full', 'goatee', 'braided']),
    mustache: z.enum(['none', 'pencil', 'chevron', 'handlebar', 'walrus', 'horseshoe', 'english']),
    color: z.enum(['brown', 'black', 'white', 'blond']),
    graying: z.boolean(),
  })
  .strict();
export type FacialHair = z.infer<typeof facialHairSchema>;
export const defaultFacialHair: FacialHair = {
  beard: 'none',
  mustache: 'none',
  color: 'brown',
  graying: false,
};
export const facialHairAtlases = {
  beard: {
    path: '/character-creation/beards-20261023.png',
    columns: 3,
    rows: 2,
    width: 1536,
    height: 1024,
  },
  mustache: {
    path: '/character-creation/mustaches-20261023.png',
    columns: 4,
    rows: 2,
    width: 1774,
    height: 887,
  },
} as const;
export function supportsFacialHair(race: string, gender?: string) {
  return race !== 'Warforged' && gender === 'male';
}
export function facialHairArtInstructions(
  race: string,
  choices?: { physicalTraits?: { gender?: string }; facialHair?: FacialHair } | null,
) {
  if (!supportsFacialHair(race, choices?.physicalTraits?.gender)) return '';
  const parsed = facialHairSchema.safeParse(choices?.facialHair);
  if (!parsed.success) return '';
  const hair = parsed.data,
    beard = beardStyles.find((v) => v.id === hair.beard)!,
    mustache = mustacheStyles.find((v) => v.id === hair.mustache)!;
  const visible = hair.beard !== 'none' || hair.mustache !== 'none';
  return `BARBA E BIGODE ESCOLHIDOS PELO JOGADOR. Barba ${beard.name}: ${beard.instruction} Bigode ${mustache.name}: ${mustache.instruction} São escolhas INDEPENDENTES: a barba não acrescenta bigode e o bigode não acrescenta barba. ${visible ? `Cor base compartilhada da barba e do bigode: ${facialHairColors.find((v) => v.id === hair.color)!.instruction}. ${hair.graying ? 'Adicionar fios grisalhos prateados misturados à cor base, que continua visível; não substituir toda a cor por branco. Na base branca, usar variação sutil de branco e prata.' : 'Sem fios grisalhos adicionais; conservar a cor base mesmo nas faixas Idoso e Ancião, sem clarear automaticamente pela idade.'}` : 'Rosto sem barba e sem bigode; não inventar pelos, sombra de barba ou grisalho.'} Essas escolhas visuais explícitas valem para todas as espécies masculinas desta mesa, incluindo Elfo e Draconato, exceto Warforged. Adapte os pelos à anatomia racial do maxilar/focinho sem humanizar o rosto, alterar escamas/pele, dentes, chifres ou orelhas. Preserve rosto, cabelo da cabeça, identidade, porte, idade, roupa e equipamentos da referência; a cor escolhida só muda barba e bigode. A prancha isolada, quando anexada, tem a barba escolhida à esquerda e o bigode escolhido à direita e define somente esses formatos: ignore a identidade do manequim, seu cabelo, sua roupa e as cores demonstrativas. As escolhas prevalecem sobre pelos divergentes na imagem do jogador e nos modelos. Preservar retrato, token, correções e novas roupas. Conferir apenas partes visíveis; não abrir elmo ou alterar a câmera superior para exibir pelos ocultos.`;
}
