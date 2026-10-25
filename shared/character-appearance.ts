import { z } from 'zod';
import { warforgedBodies, warforgedBodySchema } from './warforged-appearance.js';
export { warforgedBodySchema };
import { facialHairArtInstructions, type FacialHair } from './facial-hair.js';

export const characterGenders = [
  {
    id: 'male',
    name: 'Homem',
    instruction:
      'Personagem homem, com aparência masculina compatível com a raça, a idade e o porte físico escolhidos.',
  },
  {
    id: 'female',
    name: 'Mulher',
    instruction:
      'Personagem mulher, com aparência feminina compatível com a raça, a idade e o porte físico escolhidos.',
  },
] as const;

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
    id: 'middle-aged',
    name: 'Meia-idade',
    instruction:
      'Aparência de meia-idade para a raça, traços maduros e marcas moderadas de idade, sem envelhecimento avançado.',
  },
  {
    id: 'old',
    name: 'Idoso',
    instruction:
      'Aparência idosa para a raça, marcas de idade visíveis e naturais nas partes expostas.',
  },
  {
    id: 'elder',
    name: 'Ancião',
    instruction:
      'Aparência anciã para a raça, claramente mais envelhecida que a categoria Idoso, com sinais acentuados de idade compatíveis com a anatomia e os materiais, preservando o porte físico escolhido.',
  },
] as const;
export const physicalTraitsSchema = z
  .object({
    height: z.enum(['short', 'average', 'tall']),
    build: z.enum(['slim', 'average', 'athletic', 'muscular', 'broad', 'heavy']),
    age: z.enum(['young', 'adult', 'middle-aged', 'old', 'elder']),
    // Existing sheets and queued jobs predate this choice; require it on new submissions only.
    gender: z.enum(['male', 'female']).optional(),
  })
  .strict();
export type PhysicalTraits = z.infer<typeof physicalTraitsSchema>;
export type AppearanceChoices = {
  physicalTraits?: Partial<PhysicalTraits>;
  facialHair?: FacialHair;
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
  const traits = physicalTraitsSchema.safeParse(choices?.physicalTraits);
  if (!traits.success)
    throw new Error('Escolha a altura, o porte físico e a idade aparente do personagem.');
  if (!traits.data.gender) throw new Error('Escolha se o personagem é homem ou mulher.');
  if (race === 'Warforged' && !choices?.warforgedAppearance && !choices?.warforgedBody)
    throw new Error(
      'Escolha a estrutura do corpo do Warforged, mesmo usando uma imagem de referência.',
    );
}

export function characterAppearanceInstructions(race: string, choices?: AppearanceChoices | null) {
  const hairInstructions = facialHairArtInstructions(race, choices);
  const traits = physicalTraitsSchema.safeParse(choices?.physicalTraits);
  const body = race === 'Warforged' && warforgedBodies.find((b) => b.id === choices?.warforgedBody);
  if (!traits.success && !body && !hairInstructions) return '';
  return `PERSONALIZAÇÃO FÍSICA ESCOLHIDA PELO JOGADOR (${race}). ${
    traits.success
      ? [
          characterGenders.find((v) => v.id === traits.data.gender)?.instruction,
          characterHeights.find((v) => v.id === traits.data.height)!.instruction,
          characterBuilds.find((v) => v.id === traits.data.build)!.instruction,
          characterAges.find((v) => v.id === traits.data.age)!.instruction,
        ]
          .filter(Boolean)
          .join(' ')
      : ''
  } ${body ? `Estrutura do Warforged: ${body.name}. ${body.instruction} A estrutura define a distribuição e as proporções das placas e articulações; o porte físico define os volumes dentro dessa estrutura. Rosto, cabeça, materiais, cores e detalhes continuam seguindo a referência do jogador; não copiar a cabeça ou a paleta do manequim do corpo.` : ''} ${race === 'Warforged' && traits.success ? 'A idade aparente e a aparência masculina ou feminina do constructo são expressas pelo desenho das formas, proporções e marcas de uso coerentes com a faixa etária escolhida e compatíveis com os materiais; não criar pele humana, barba, ferrugem ou mudar o acabamento escolhido automaticamente.' : ''} Essas escolhas, incluindo homem ou mulher quando informado, prevalecem sobre a aparência genérica da raça, da classe ou das imagens. Preserve a identidade, cabelo, rosto, cores e marcas compatíveis da referência, adaptando somente as características escolhidas. Altura é relativa à própria raça: um halfling alto continua halfling, não um humano esticado. Preserve a anatomia racial, a categoria de tamanho da ficha e o equipamento; não conceder bônus ou penalidades. Não sexualizar o personagem nem substituir seu porte físico por estereótipos de gênero. Mantenha essas características no retrato, ao vestir, nas correções e no token, respeitando o encurtamento e a oclusão da câmera superior. Não exigir medidas absolutas ou características ocultas. ${hairInstructions}`;
}
