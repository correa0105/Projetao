import { z } from 'zod';

export const startingTops = [
  {
    id: 'linen',
    name: 'Túnica de linho',
    detail: 'Mangas longas e gola com cordão.',
    instruction: 'túnica de linho até o quadril, mangas longas e gola fechada por cordão curto',
  },
  {
    id: 'cotton',
    name: 'Camisa de algodão',
    detail: 'Mangas curtas e gola simples.',
    instruction:
      'camisa medieval de algodão até o quadril, mangas curtas ligadas aos ombros, gola redonda simples',
  },
  {
    id: 'road',
    name: 'Túnica de estrada',
    detail: 'Mangas amplas e barra até a coxa.',
    instruction:
      'túnica medieval de tecido encorpado até o meio das coxas, mangas amplas até os cotovelos, gola em V com debrum discreto da mesma cor',
  },
  {
    id: 'vest',
    name: 'Colete com camisa',
    detail: 'Colete de tecido sobre camisa clara.',
    instruction:
      'colete medieval de tecido, sem armadura, na cor escolhida, sobre camisa de linho cru com mangas longas; ambas as peças ligadas e vestidas naturalmente',
  },
] as const;
export const startingTrousers = [
  {
    id: 'straight',
    name: 'Calça reta',
    detail: 'Corte simples e caimento solto.',
    instruction:
      'calça medieval comprida de corte reto e caimento solto, tecido contínuo em ambas as pernas até os tornozelos',
  },
  {
    id: 'tied',
    name: 'Calça com amarração',
    detail: 'Cordões discretos nas barras.',
    instruction:
      'calça medieval comprida com amarrações discretas nos tornozelos, cobrindo também as canelas por inteiro',
  },
  {
    id: 'wool',
    name: 'Calça de lã',
    detail: 'Tecido espesso e pernas amplas.',
    instruction:
      'calça medieval comprida de lã, tecido espesso e pernas amplas, com barras inteiras nos tornozelos',
  },
  {
    id: 'fitted',
    name: 'Calça ajustada',
    detail: 'Corte estreito sem apertar.',
    instruction:
      'calça medieval comprida de corte estreito sem apertar, com costuras laterais e barras completas até os tornozelos',
  },
] as const;
export const startingFootwear = [
  {
    id: 'barefoot',
    name: 'Descalço',
    detail: 'Pés livres, com a anatomia da espécie.',
    instruction: 'descalço, pés naturais da espécie, sem sapatos, botas ou sandálias',
  },
  {
    id: 'shoes',
    name: 'Sapatos simples',
    detail: 'Couro macio e cano baixo.',
    instruction:
      'sapatos medievais simples de couro macio, fechados, cano abaixo do tornozelo, sem proteção de armadura',
  },
  {
    id: 'boots',
    name: 'Botas de viagem',
    detail: 'Botas curtas com costuras aparentes.',
    instruction:
      'botas medievais curtas de couro até os tornozelos, costuras artesanais, sem placas ou proteção de armadura',
  },
  {
    id: 'sandals',
    name: 'Sandálias',
    detail: 'Tiras de couro presas aos pés.',
    instruction:
      'sandálias medievais simples com tiras de couro fisicamente presas aos pés e sola discreta, sem tiras flutuantes',
  },
] as const;
export const outfitColors = [
  { name: 'Cru', value: '#dfceb1' },
  { name: 'Castanho', value: '#654b39' },
  { name: 'Musgo', value: '#535d3f' },
  { name: 'Azul', value: '#36516a' },
  { name: 'Vinho', value: '#723c46' },
  { name: 'Carvão', value: '#33363b' },
] as const;
const color = z.string().regex(/^#[0-9a-f]{6}$/i, 'Escolha uma cor válida.');
export const startingOutfitSchema = z
  .object({
    top: z.enum(['linen', 'cotton', 'road', 'vest']),
    topColor: color,
    trousers: z.enum(['straight', 'tied', 'wool', 'fitted']),
    trousersColor: color,
    footwear: z.enum(['barefoot', 'shoes', 'boots', 'sandals']),
    footwearColor: color,
    sash: z.boolean(),
    sashColor: color,
  })
  .strict();
export type StartingOutfit = z.infer<typeof startingOutfitSchema>;
export const defaultStartingOutfit: StartingOutfit = {
  top: 'linen',
  topColor: '#dfceb1',
  trousers: 'straight',
  trousersColor: '#654b39',
  footwear: 'barefoot',
  footwearColor: '#654b39',
  sash: true,
  sashColor: '#535d3f',
};
export function startingOutfitInstructions(value?: StartingOutfit | null) {
  if (!value) return '';
  const outfit = startingOutfitSchema.parse(value);
  return `TRAJE INICIAL ESCOLHIDO: esta seleção substitui os modelos e as cores do traje inicial padrão e da referência de estilo. Parte superior: ${startingTops.find((v) => v.id === outfit.top)!.instruction}; cor principal sRGB ${outfit.topColor}. Parte inferior: ${startingTrousers.find((v) => v.id === outfit.trousers)!.instruction}; cor sRGB ${outfit.trousersColor}. Calçado: ${startingFootwear.find((v) => v.id === outfit.footwear)!.instruction}${outfit.footwear === 'barefoot' ? '' : `; cor sRGB ${outfit.footwearColor}`}. ${outfit.sash ? `Faixa simples de tecido na cintura, cor sRGB ${outfit.sashColor}, amarrada com queda natural.` : 'SEM FAIXA DE TECIDO na barriga ou cintura: não acrescentar a faixa verde do padrão nem copiar a faixa da referência.'} Roupa artesanal medieval, modesta, bem acabada, sem rasgos e sem aspecto de pijama; não recolorir pele, cabelo, metal ou outros equipamentos. São escolhas visuais da roupa base, sem bônus de armadura, itens, ouro ou armas extras. Equipamentos realmente selecionados têm prioridade nas suas posições e encobrem/substituem a roupa base naturalmente: não remover armadura, calçado, cinto ou outros itens equipados para revelar estas escolhas. Conferir modelos, cores e presença/ausência da faixa SOMENTE nas partes visíveis; não exigir tecido oculto. Preserve estas escolhas no retrato, no token superior, ao vestir e nas correções.`;
}
