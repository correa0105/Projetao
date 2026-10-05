export const pets = [
  {
    id: 'dog',
    name: 'Cão',
    price_cp: 1000,
    cell: 0,
    description: 'Fiel, curioso e sempre pronto para uma caminhada.',
    sign: 'Fiel e companheiro. Reserve tempo para passear e brincar com ele.',
  },
  {
    id: 'cat',
    name: 'Gato',
    price_cp: 1500,
    cell: 1,
    description: 'Um observador de bigodes, com horários e opiniões próprios.',
    sign: 'Você oferece abrigo. Ele escolhe a hora de oferecer carinho.',
  },
  {
    id: 'rabbit',
    name: 'Coelho',
    price_cp: 500,
    cell: 2,
    description: 'Orelhas atentas, patas leves e gosto por cantinhos tranquilos.',
    sign: 'Feno, sossego e uma boa toca. Nada de puxar pelas orelhas.',
  },
  {
    id: 'owl',
    name: 'Coruja',
    price_cp: 3000,
    cell: 3,
    description: 'Uma companheira noturna, silenciosa e de olhar atento.',
    sign: 'Ela prefere a noite. Respeite o descanso da sua companheira.',
  },
  {
    id: 'fox',
    name: 'Raposa',
    price_cp: 4000,
    cell: 4,
    description: 'Esperta, inquieta e apaixonada por investigar a trilha.',
    sign: 'Esperta e curiosa. Guarde o lanche: ela já está de olho nele.',
  },
  {
    id: 'raven',
    name: 'Corvo',
    price_cp: 2000,
    cell: 5,
    description: 'Olhos atentos, penas negras e curiosidade por coisas brilhantes.',
    sign: 'Um amigo atento. Só não deixe suas moedas brilhantes ao alcance dele.',
  },
  {
    id: 'frog',
    name: 'Sapo',
    price_cp: 200,
    cell: 6,
    description: 'Um pequeno companheiro de passos lentos e saltos inesperados.',
    sign: 'Um cantinho úmido e seguro. Beijar não faz parte dos cuidados.',
  },
  {
    id: 'snake',
    name: 'Cobra',
    price_cp: 1200,
    cell: 7,
    description: 'Serena, discreta e de escamas em tons de terra.',
    sign: 'Esta não é venenosa. Dê abrigo, calor e espaço; manuseie com cuidado.',
  },
  {
    id: 'rat',
    name: 'Rato',
    price_cp: 300,
    cell: 8,
    description: 'Inteligente, sociável e dono de um nariz muito curioso.',
    sign: 'Sociável e bom de faro. Até os biscoitos escondidos ele encontra.',
  },
  {
    id: 'guinea-pig',
    name: 'Porquinho-da-índia',
    price_cp: 600,
    cell: 9,
    description: 'Um amigo tranquilo, de focinho pequeno e muitos assobios.',
    sign: 'Tranquilo e falante. Ele sempre avisa quando é hora da comida.',
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
  id: string;
  pet_id: string;
  name: string;
  appearance: string;
  price_cp: number;
  created_at: string;
};
export const garalhoQuestions = [
  {
    id: 'name',
    question: 'Quem é você?',
    meow: 'Miau… miaaau.',
    answer: 'Garalho. Cuido desta casa e dos bichinhos. Eu escrevo; você lê. Miau!',
  },
  {
    id: 'companion',
    question: 'Como escolho um companheiro?',
    meow: 'Miau. Miau!',
    answer: 'Conheça cada um. Escolha pela companhia que deseja, além da aparência.',
  },
  {
    id: 'care',
    question: 'Como cuida dos animais?',
    meow: 'Miaaau… miau.',
    answer: 'Com abrigo, alimento e paciência. Leve um amigo e trate-o com respeito.',
  },
] as const;
