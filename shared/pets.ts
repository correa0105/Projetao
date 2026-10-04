export const pets = [
  {
    id: 'dog',
    name: 'Cão',
    price_cp: 1000,
    cell: 0,
    description: 'Fiel, curioso e sempre pronto para uma caminhada.',
    sign: 'Este conhece o caminho de volta. Só não prometa passeios que não pretende fazer.',
  },
  {
    id: 'cat',
    name: 'Gato',
    price_cp: 1500,
    cell: 1,
    description: 'Um observador de bigodes, com horários e opiniões próprios.',
    sign: 'Excelente companhia. O contrato é simples: você oferece abrigo, ele decide quando oferece carinho.',
  },
  {
    id: 'rabbit',
    name: 'Coelho',
    price_cp: 500,
    cell: 2,
    description: 'Orelhas atentas, patas leves e gosto por cantinhos tranquilos.',
    sign: 'Nada de puxar pelas orelhas. Ele prefere feno, sossego e uma boa toca.',
  },
  {
    id: 'owl',
    name: 'Coruja',
    price_cp: 3000,
    cell: 3,
    description: 'Uma companheira noturna, silenciosa e de olhar atento.',
    sign: 'Ela gosta da noite. Respeite o descanso dela e não confunda silêncio com falta de opinião.',
  },
  {
    id: 'fox',
    name: 'Raposa',
    price_cp: 4000,
    cell: 4,
    description: 'Esperta, inquieta e apaixonada por investigar a trilha.',
    sign: 'Antes de confiar na raposa, confira onde deixou o lanche. Ela também está fazendo essa conferência.',
  },
  {
    id: 'raven',
    name: 'Corvo',
    price_cp: 2000,
    cell: 5,
    description: 'Olhos atentos, penas negras e curiosidade por coisas brilhantes.',
    sign: 'Guarde suas moedas. Ele não cobra pela amizade, mas adora examinar o pagamento.',
  },
  {
    id: 'frog',
    name: 'Sapo',
    price_cp: 200,
    cell: 6,
    description: 'Um pequeno companheiro de passos lentos e saltos inesperados.',
    sign: 'Precisa de um cantinho úmido e seguro. Não beije o sapo. Aqui não há promessa de príncipe.',
  },
  {
    id: 'snake',
    name: 'Cobra',
    price_cp: 1200,
    cell: 7,
    description: 'Serena, discreta e de escamas em tons de terra.',
    sign: 'Esta não é venenosa. Dê espaço, calor e um abrigo adequado. Apertar demais não é carinho.',
  },
  {
    id: 'rat',
    name: 'Rato',
    price_cp: 300,
    cell: 8,
    description: 'Inteligente, sociável e dono de um nariz muito curioso.',
    sign: 'O rato é um ótimo companheiro. Baguncinha insiste em esconder o biscoito do café; o rato insiste em encontrar.',
  },
  {
    id: 'guinea-pig',
    name: 'Porquinho-da-índia',
    price_cp: 600,
    cell: 9,
    description: 'Um amigo tranquilo, de focinho pequeno e muitos assobios.',
    sign: 'Este avisa quando a comida está atrasada. Às vezes avisa antes, só para garantir.',
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
    answer:
      'Garalho. Comerciante, cuidador e dono desta casa. Eu escrevo; você lê. Parece um acordo justo.',
  },
  {
    id: 'skeleton',
    question: 'Quem é o esqueleto ali?',
    meow: 'Miau. Miau!',
    answer:
      'Baguncinha, meu servo. Ele organiza a casa, cuida dos bichinhos e faz café. Hoje está testando a última função com bastante dedicação.',
  },
  {
    id: 'care',
    question: 'Como cuida dos animais?',
    meow: 'Miaaau… miau.',
    answer:
      'Com abrigo, alimento e paciência. Eles procuram companhia, não um dono que os assuste. Cuide bem de quem escolher seguir com você.',
  },
] as const;
