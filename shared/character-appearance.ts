import { z } from 'zod';
import { warforgedBodies } from './warforged-appearance.js';

export const characterHeights = [
  {
    id: 'short',
    name: 'Baixo',
    instruction: 'Estatura baixa em relação aos indivíduos da mesma raça e categoria de tamanho.',
  },
  {
    id: 'average',
    name: 'Mediano',
    instruction: 'Estatura mediana para a raça e categoria de tamanho.',
  },
  {
    id: 'tall',
    name: 'Alto',
    instruction: 'Estatura alta em relação aos indivíduos da mesma raça e categoria de tamanho.',
  },
] as const;
export const characterBuilds = [
  {
    id: 'slim',
    name: 'Magro',
    instruction: 'Porte magro, cintura e membros finos, sem musculatura volumosa.',
  },
  {
    id: 'average',
    name: 'Mediano',
    instruction: 'Porte mediano, volumes equilibrados e musculatura discreta.',
  },
  {
    id: 'athletic',
    name: 'Atlético',
    instruction: 'Porte atlético, musculatura definida e silhueta ágil.',
  },
  {
    id: 'muscular',
    name: 'Musculoso',
    instruction: 'Musculatura volumosa e ombros desenvolvidos.',
  },
  {
    id: 'broad',
    name: 'Robusto',
    instruction: 'Porte largo e encorpado, tronco e membros espessos.',
  },
  {
    id: 'heavy',
    name: 'Corpulento',
    instruction: 'Corpo cheio, com volumes arredondados e abdômen volumoso, proporções naturais.',
  },
] as const;
export const characterAges = [
  {
    id: 'young',
    name: 'Jovem',
    instruction:
      'Aparência jovem para a raça, traços juvenis, sem envelhecimento marcado; não converter em bebê ou chibi.',
  },
  {
    id: 'adult',
    name: 'Adulto',
    instruction: 'Aparência adulta para a raça, traços maduros sem envelhecimento acentuado.',
  },
  {
    id: 'old',
    name: 'Idoso',
    instruction:
      'Aparência idosa para a raça, marcas de idade visíveis e naturais nas partes expostas.',
  },
] as const;
export const physicalTraitsSchema = z
  .object({
    height: z.enum(['short', 'average', 'tall']),
    build: z.enum(['slim', 'average', 'athletic', 'muscular', 'broad', 'heavy']),
    age: z.enum(['young', 'adult', 'old']),
  })
  .strict();
export type PhysicalTraits = z.infer<typeof physicalTraitsSchema>;
export const warforgedBodySchema = z.enum([
  'balanced',
  'slender',
  'robust',
  'reinforced-arms',
  'long-legs',
  'compact',
]);
export type AppearanceChoices = {
  physicalTraits?: Partial<PhysicalTraits>;
  warforgedBody?: z.infer<typeof warforgedBodySchema>;
};

// Optional on legacy sheets; complete, explicit choices are required only for new submissions.
export function validateCreationAppearance(
  race: string,
  choices?: AppearanceChoices & {
    warforgedArtMode?: 'construction' | 'reference';
    warforgedAppearance?: { body: string };
  },
) {
  if (!physicalTraitsSchema.safeParse(choices?.physicalTraits).success)
    throw new Error('Escolha a altura, o porte físico e a idade aparente do personagem.');
  if (race === 'Warforged' && !choices?.warforgedAppearance && !choices?.warforgedBody)
    throw new Error(
      'Escolha a estrutura do corpo do Warforged, mesmo usando uma imagem de referência.',
    );
}

export function characterAppearanceInstructions(race: string, choices?: AppearanceChoices | null) {
  const traits = physicalTraitsSchema.safeParse(choices?.physicalTraits);
  const body = race === 'Warforged' && warforgedBodies.find((b) => b.id === choices?.warforgedBody);
  if (!traits.success && !body) return '';
  return `PERSONALIZAÇÃO FÍSICA ESCOLHIDA PELO JOGADOR (${race}). ${
    traits.success
      ? [
          characterHeights.find((v) => v.id === traits.data.height)!.instruction,
          characterBuilds.find((v) => v.id === traits.data.build)!.instruction,
          characterAges.find((v) => v.id === traits.data.age)!.instruction,
        ].join(' ')
      : ''
  } ${body ? `Estrutura do Warforged: ${body.name}. ${body.instruction} A estrutura define a distribuição e as proporções das placas e articulações; o porte físico define os volumes dentro dessa estrutura. Rosto, cabeça, materiais, cores e detalhes continuam seguindo a referência do jogador; não copiar a cabeça ou a paleta do manequim do corpo.` : ''} ${race === 'Warforged' && traits.success ? 'A idade aparente do constructo é expressa pela maturidade do desenho e marcas discretas de uso compatíveis com os materiais; não criar pele humana, barba, ferrugem ou mudar o acabamento escolhido automaticamente.' : ''} Essas escolhas prevalecem sobre a idade, altura e porte genéricos da raça, da classe ou das imagens. Preserve a identidade, cabelo, rosto, cores e marcas compatíveis da referência, adaptando somente as características escolhidas. Altura é relativa à própria raça: um halfling alto continua halfling, não um humano esticado. Preserve a anatomia racial, a categoria de tamanho da ficha e o equipamento; não conceder bônus ou penalidades. Mantenha essas características no retrato, ao vestir, nas correções e no token, respeitando o encurtamento e a oclusão da câmera superior. Não exigir medidas absolutas ou idade visível quando estiverem ocultas.`;
}
