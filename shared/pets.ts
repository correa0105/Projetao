export const pets = [
  {
    id: 'dog',
    name: 'Cão',
    price_cp: 1000,
    cell: 0,
    description: 'Fiel, curioso e sempre pronto para uma caminhada.',
    sign: 'Vigia sua mochila. O lanche que sumir foi inspeção de segurança.',
  },
  {
    id: 'cat',
    name: 'Gato',
    price_cp: 1500,
    cell: 1,
    description: 'Um observador de bigodes, com horários e opiniões próprios.',
    sign: 'Carinho só no horário dele. Reclamações também.',
  },
  {
    id: 'rabbit',
    name: 'Coelho',
    price_cp: 500,
    cell: 2,
    description: 'Orelhas atentas, patas leves e gosto por cantinhos tranquilos.',
    sign: 'Faz cenouras sumirem. Não é magia, mas impressiona.',
  },
  {
    id: 'owl',
    name: 'Coruja',
    price_cp: 3000,
    cell: 3,
    description: 'Uma companheira noturna, silenciosa e de olhar atento.',
    sign: 'Vigia à noite, cochila de dia. Finalmente alguém com a sua rotina.',
  },
  {
    id: 'fox',
    name: 'Raposa',
    price_cp: 4000,
    cell: 4,
    description: 'Esperta, inquieta e apaixonada por investigar a trilha.',
    sign: 'Se a bolsa sumir, negocie com petiscos antes de acusar alguém.',
  },
  {
    id: 'raven',
    name: 'Corvo',
    price_cp: 2000,
    cell: 5,
    description: 'Olhos atentos, penas negras e curiosidade por coisas brilhantes.',
    sign: 'Conte suas moedas antes e depois do passeio. Por precaução.',
  },
  {
    id: 'frog',
    name: 'Sapo',
    price_cp: 200,
    cell: 6,
    description: 'Um pequeno companheiro de passos lentos e saltos inesperados.',
    sign: 'Quietinho até chover. Aí começa a carreira de cantor.',
  },
  {
    id: 'snake',
    name: 'Cobra',
    price_cp: 1200,
    cell: 7,
    description: 'Serena, discreta e de escamas em tons de terra.',
    sign: 'Não faz bagunça com as patas. Uma vantagem de não ter patas.',
  },
  {
    id: 'rat',
    name: 'Rato',
    price_cp: 300,
    cell: 8,
    description: 'Inteligente, sociável e dono de um nariz muito curioso.',
    sign: 'Encontra comida até no escuro. Estou pensando em contratar.',
  },
  {
    id: 'guinea-pig',
    name: 'Porquinho-da-índia',
    price_cp: 600,
    cell: 9,
    description: 'Um amigo tranquilo, de focinho pequeno e muitos assobios.',
    sign: 'Assobia quando a comida chega. Alguém aqui elogia meu serviço.',
  },
] as const;
export type Pet = (typeof pets)[number];
export const petVariants = [
  { pet_id: 'dog', id: 'shepherd', name: 'Pastor da estrada', atlas: 'a', cell: 0 },
  { pet_id: 'cat', id: 'longhair', name: 'Gato de pelagem longa', atlas: 'a', cell: 1 },
  { pet_id: 'rabbit', id: 'runic', name: 'Coelho rúnico', atlas: 'a', cell: 2 },
  { pet_id: 'owl', id: 'horned', name: 'Coruja de olhos âmbar', atlas: 'a', cell: 3 },
  { pet_id: 'raven', id: 'shadow', name: 'Corvo das sombras', atlas: 'b', cell: 0 },
  { pet_id: 'snake', id: 'emerald', name: 'Serpente esmeralda', atlas: 'b', cell: 1 },
  { pet_id: 'rat', id: 'fluffy', name: 'Rato de pelagem longa', atlas: 'b', cell: 2 },
] as const;
export function petAppearance(petId: string, appearance = 'original') {
  return petVariants.find((v) => v.pet_id === petId && v.id === appearance);
}
export type OwnedPet = {
  image_url?: string | null;
  image_revision?: number;
  equipment_revision?: number;
  art_equipment_revision?: number | null;
  id: string;
  pet_id: string;
  name: string;
  appearance: string;
  price_cp: number;
  created_at: string;
  displayed: boolean;
};
export type PetBreed = { pet_id: string; appearance: string; name: string; revision: number };
export type PetBreedCatalog = { breeds: PetBreed[]; can_edit: boolean };
export function defaultPetBreeds(): PetBreed[] {
  return pets.flatMap((pet) => [
    { pet_id: pet.id, appearance: 'original', name: `${pet.name} clássico`, revision: 0 },
    ...petVariants
      .filter((variant) => variant.pet_id === pet.id)
      .map((variant) => ({
        pet_id: pet.id,
        appearance: variant.id,
        name: variant.name,
        revision: 0,
      })),
  ]);
}
export const garalhoQuestions = [
  {
    id: 'name',
    question: 'Quem é você?',
    meow: 'Miau… miaaau.',
    answer: 'Sou Garalho. Vendedor e fiscal dos cochilos. O cargo mais disputado.',
  },
  {
    id: 'companion',
    question: 'Como escolho um companheiro?',
    meow: 'Miau. Miau!',
    answer: 'Veja quem gosta de você. Se gostar do seu lanche, já é um começo.',
  },
  {
    id: 'care',
    question: 'Como cuida dos animais?',
    meow: 'Miaaau… miau.',
    answer: 'Comida, cobertor e carinho. Só falta eles ajudarem no aluguel.',
  },
] as const;
