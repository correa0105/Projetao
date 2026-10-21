import { z } from 'zod';

export const warforgedBodies = [
  {
    id: 'balanced',
    name: 'Equilibrado',
    description: 'Tronco médio e membros proporcionais.',
    instruction: 'Tronco de largura média, ombros e membros proporcionais.',
  },
  {
    id: 'slender',
    name: 'Esguio',
    description: 'Tronco estreito e membros mais finos.',
    instruction: 'Tronco estreito, ombros finos e membros esguios; silhueta leve.',
  },
  {
    id: 'robust',
    name: 'Robusto',
    description: 'Peito largo, ombros amplos e membros grossos.',
    instruction:
      'Peito muito largo, ombros amplos, cintura espessa e membros grossos; silhueta robusta.',
  },
  {
    id: 'reinforced-arms',
    name: 'Braços reforçados',
    description: 'Braços e antebraços maiores que os usuais.',
    instruction:
      'Tronco médio com dois braços proporcionalmente maiores, ombros e antebraços reforçados e simétricos.',
  },
  {
    id: 'long-legs',
    name: 'Pernas alongadas',
    description: 'Pernas longas e joelhos bem articulados.',
    instruction:
      'Pernas proporcionalmente alongadas, joelhos articulados, tronco médio e braços normais.',
  },
  {
    id: 'compact',
    name: 'Compacto',
    description: 'Tronco denso e membros curtos e espessos.',
    instruction:
      'Tronco compacto e largo com braços e pernas proporcionalmente curtos e espessos; manter aspecto adulto e tamanho Médio.',
  },
] as const;
export const warforgedHeads = [
  {
    id: 'mask',
    name: 'Máscara lisa',
    description: 'Face alongada, fechada e com olhos estreitos.',
    instruction:
      'Cabeça com máscara alongada de curvas suaves, duas aberturas de olhos estreitas e sem boca aberta.',
  },
  {
    id: 'visor',
    name: 'Visor',
    description: 'Cabeça retangular com um visor horizontal.',
    instruction: 'Cabeça retangular compacta com um único visor horizontal escuro e queixo plano.',
  },
  {
    id: 'angular',
    name: 'Angular',
    description: 'Placas facetadas e testa com crista central.',
    instruction:
      'Cabeça geométrica com placas facetadas, maçãs angulares, crista central na testa e dois olhos estreitos.',
  },
  {
    id: 'round-eyes',
    name: 'Olhos circulares',
    description: 'Crânio arredondado e duas lentes embutidas.',
    instruction:
      'Cabeça arredondada com duas lentes circulares embutidas e pequena grade de boca; as lentes integram a cabeça, sem óculos externos.',
  },
  {
    id: 'segmented',
    name: 'Mandíbula segmentada',
    description: 'Rosto articulado com placas que se encaixam.',
    instruction:
      'Rosto humanoide formado por placas metálicas encaixadas, maçãs segmentadas e mandíbula inferior articulada, sem pele nem dentes humanos.',
  },
  {
    id: 'domed',
    name: 'Cúpula rebitada',
    description: 'Coroa arredondada e parte inferior larga.',
    instruction:
      'Cabeça cilíndrica larga com coroa em cúpula rebitada, pequenas fendas de olhos e face inferior plana e larga.',
  },
  {
    id: 'sentinel',
    name: 'Sentinela',
    description: 'Face alongada com visor em T e maçãs angulares.',
    instruction:
      'Cabeça alongada com visor escuro em T, maçãs angulares e coroa sólida arredondada, sem chifres; expressão imponente.',
  },
  {
    id: 'cavalier',
    name: 'Cavaleiro',
    description: 'Face afilada e crista baixa integrada ao crânio.',
    instruction:
      'Cabeça de face afilada inspirada em bacinete medieval, duas fendas de olhos, arcos nas maçãs e crista central baixa integrada ao crânio.',
  },
  {
    id: 'oracle',
    name: 'Oráculo',
    description: 'Máscara serena, testa gravada e têmporas circulares.',
    instruction:
      'Rosto metálico esculpido e sereno, dois olhos estreitos, sulcos geométricos na testa e discos circulares rentes nas têmporas; sem texto legível.',
  },
  {
    id: 'warden',
    name: 'Guardião',
    description: 'Cabeça larga com mandíbula e placas reforçadas.',
    instruction:
      'Cabeça larga e quadrada, têmporas e mandíbula formadas por placas sobrepostas, olhos pequenos recuados e queixo forte afilado; sem dentes.',
  },
  {
    id: 'artificer',
    name: 'Artífice',
    description: 'Uma lente circular e mecanismos integrados à face.',
    instruction:
      'Cabeça compacta assimétrica, uma lente circular embutida e um olho em fenda, pequenas engrenagens integradas a uma têmpora e mandíbula fina articulada; sem óculos externos.',
  },
  {
    id: 'veteran',
    name: 'Veterano',
    description: 'Máscara de batalha com marcas de reparo e emendas.',
    instruction:
      'Máscara angular marcada por batalhas, emenda diagonal reparada, placa remendada na sobrancelha, dois olhos estreitos íntegros e mandíbula articulada forte.',
  },
] as const;
export const warforgedMetals = [
  { id: 'iron', name: 'Ferro cinza', color: '#777570', instruction: 'ferro cinza neutro' },
  {
    id: 'steel',
    name: 'Aço prateado',
    color: '#b7c1c6',
    instruction: 'aço prateado claro com reflexos frios',
  },
  {
    id: 'blackened',
    name: 'Metal escurecido',
    color: '#373b40',
    instruction: 'metal escurecido em grafite quase preto',
  },
  { id: 'bronze', name: 'Bronze', color: '#967145', instruction: 'bronze castanho dourado' },
  { id: 'copper', name: 'Cobre', color: '#b97452', instruction: 'cobre avermelhado' },
  { id: 'brass', name: 'Latão', color: '#b8a163', instruction: 'latão amarelo envelhecido' },
  {
    id: 'gold',
    name: 'Dourado',
    color: '#d0aa50',
    instruction: 'metal de cor dourada, sem significar ouro valioso ou item mágico',
  },
  {
    id: 'blue-steel',
    name: 'Aço azulado',
    color: '#647e95',
    instruction: 'aço azulado frio e dessaturado',
  },
] as const;
export const warforgedFinishes = [
  {
    id: 'polished',
    name: 'Polido',
    instruction: 'superfície polida e bem cuidada com reflexos suaves, sem ferrugem',
  },
  {
    id: 'brushed',
    name: 'Escovado',
    instruction: 'superfície escovada acetinada, com marcas finas de trabalho, sem ferrugem',
  },
  {
    id: 'aged',
    name: 'Envelhecido',
    instruction: 'superfície envelhecida, pátina discreta e pequenos riscos de uso',
  },
  {
    id: 'rusted',
    name: 'Enferrujado',
    instruction:
      'oxidação aparente em tons ferrugem, avermelhados e castanhos, sobre a cor principal ainda reconhecível; juntas funcionais e estrutura íntegra',
  },
] as const;
export const warforgedAccentColors = [
  { name: 'Latão', color: '#b58c50' },
  { name: 'Prata', color: '#c0c7ce' },
  { name: 'Cobre', color: '#b86f4b' },
  { name: 'Preto', color: '#292b30' },
  { name: 'Marfim', color: '#d5c9ad' },
  { name: 'Vermelho', color: '#9b3934' },
  { name: 'Vinho', color: '#62344c' },
  { name: 'Azul', color: '#3f658e' },
  { name: 'Verde-musgo', color: '#63704e' },
  { name: 'Turquesa', color: '#3f827c' },
  { name: 'Violeta', color: '#78618b' },
  { name: 'Âmbar', color: '#c2893e' },
] as const;
export const warforgedAppearanceSchema = z
  .object({
    body: z.enum(['balanced', 'slender', 'robust', 'reinforced-arms', 'long-legs', 'compact']),
    head: z.enum([
      'mask',
      'visor',
      'angular',
      'round-eyes',
      'segmented',
      'domed',
      'sentinel',
      'cavalier',
      'oracle',
      'warden',
      'artificer',
      'veteran',
    ]),
    metal: z.enum([
      'iron',
      'steel',
      'blackened',
      'bronze',
      'copper',
      'brass',
      'gold',
      'blue-steel',
    ]),
    finish: z.enum(['polished', 'brushed', 'aged', 'rusted']),
    accentEnabled: z.boolean(),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })
  .strict();
export type WarforgedAppearance = z.infer<typeof warforgedAppearanceSchema>;
export function warforgedArtMode(
  choices:
    | { warforgedArtMode?: 'construction' | 'reference'; warforgedAppearance?: unknown }
    | undefined
    | null,
) {
  return (
    choices?.warforgedArtMode ??
    (warforgedAppearanceSchema.safeParse(choices?.warforgedAppearance).success
      ? 'construction'
      : 'reference')
  );
}
export const defaultWarforgedAppearance: WarforgedAppearance = {
  body: 'balanced',
  head: 'sentinel',
  metal: 'iron',
  finish: 'brushed',
  accentEnabled: true,
  accentColor: '#b58c50',
};
export const warforgedBodyAtlas = '/character-creation/warforged-bodies-20261021.png';
export const warforgedHeadAtlas = '/character-creation/warforged-heads-20261021.png';
export const warforgedDetailedHeadAtlas =
  '/character-creation/warforged-heads-detailed-20261021.png';
export function warforgedHeadReference(head: WarforgedAppearance['head']) {
  const index = warforgedHeads.findIndex((option) => option.id === head);
  return { atlas: index < 6 ? warforgedHeadAtlas : warforgedDetailedHeadAtlas, index: index % 6 };
}
export function warforgedArtInstructions(value: unknown) {
  const parsed = warforgedAppearanceSchema.safeParse(value);
  if (!parsed.success) return '';
  const a = parsed.data;
  const body = warforgedBodies.find((v) => v.id === a.body)!;
  const head = warforgedHeads.find((v) => v.id === a.head)!;
  const metal = warforgedMetals.find((v) => v.id === a.metal)!;
  const finish = warforgedFinishes.find((v) => v.id === a.finish)!;
  const accent = warforgedAccentColors.find((v) => v.color === a.accentColor.toLowerCase());
  return `APARÊNCIA DO WARFORGED ESCOLHIDA PELO JOGADOR. Estrutura ${body.name}: ${body.instruction} Cabeça ${head.name}: ${head.instruction} A cabeça é parte do constructo, não um elmo removível. Cor das placas do corpo: ${metal.instruction}. Acabamento: ${finish.instruction}. ${a.accentEnabled ? `Cor secundária ${accent?.name || 'personalizada'} (${a.accentColor}): somente detalhes, encaixes, juntas e pequenos frisos; a cor principal deve predominar.` : 'Sem cor secundária contrastante: detalhes metálicos seguem o tom principal.'} Manter madeira/fibras e articulações naturais de um constructo vivo, dois braços e duas pernas íntegros, sem peças soltas ou membros extras. Essas escolhas cosméticas prevalecem sobre o corpo genérico da referência. Preservar rosto, estrutura e paleta escolhidos no retrato, token e correções, respeitando perspectiva e oclusão natural. NÃO recolorir, substituir ou remover roupas, armas, armaduras e acessórios comprados para expor o corpo. Nenhuma escolha concede bônus, arma, alcance, altura de regra, tamanho ou metal valioso.`;
}
