export const cards = [
  {
    id: 'vigil',
    name: 'A Vigília',
    family: 'Luz',
    price_cp: 5000,
    buyable: true,
    cell: 0,
    description:
      'Uma chama protegida contra a noite. O símbolo de quem permanece quando os outros precisam descansar.',
    comment:
      'A primeira escolha não precisa ser grandiosa. Uma pequena luz já muda o que se enxerga no escuro.',
  },
  {
    id: 'raven',
    name: 'O Corvo',
    family: 'Presságio',
    price_cp: 7500,
    buyable: true,
    cell: 1,
    description:
      'Olhos atentos sobre as ruínas. Nem toda mensagem chega pelas mãos de um mensageiro.',
    comment:
      'Ele observa antes de agir. Talvez seja esse o segredo de voltar inteiro de tantas histórias.',
  },
  {
    id: 'mirror',
    name: 'O Espelho Partido',
    family: 'Mistério',
    price_cp: 10000,
    buyable: true,
    cell: 2,
    description: 'Os fragmentos guardam perspectivas que um espelho inteiro jamais mostraria.',
    comment:
      'Reconhecer uma rachadura é o primeiro passo. Decidir o que fazer com ela costuma demorar mais.',
  },
  {
    id: 'moon',
    name: 'A Lua Errante',
    family: 'Caminho',
    price_cp: 15000,
    buyable: true,
    cell: 3,
    description: 'Uma luz distante acompanha os viajantes que seguem depois do último portão.',
    comment:
      'A lua não escolhe a estrada por você. Mas até os caminhos mais difíceis ficam diferentes sob sua luz.',
  },
  {
    id: 'roots',
    name: 'Raízes Antigas',
    family: 'Memória',
    price_cp: 0,
    buyable: false,
    cell: 4,
    description: 'Muito antes dos nomes dos reinos, estas raízes já sustentavam a terra.',
    comment:
      'Esta ainda não está à venda. Algumas histórias precisam encontrar o próprio caminho até você.',
  },
  {
    id: 'anchor',
    name: 'Âncora da Maré',
    family: 'Vínculo',
    price_cp: 0,
    buyable: false,
    cell: 5,
    description: 'O peso que dá direção ao retorno quando o mar insiste em apagar as rotas.',
    comment:
      'Nem tudo o que pesa nos impede de seguir. Às vezes é justamente o que torna o retorno possível.',
  },
  {
    id: 'blade',
    name: 'O Último Corte',
    family: 'Juramento',
    price_cp: 0,
    buyable: false,
    cell: 6,
    description: 'A lâmina descansa. O juramento que a acompanha permanece desperto.',
    comment:
      'Uma lâmina silenciosa conta muito sobre quem a carrega. Esta ainda aguarda sua história.',
  },
  {
    id: 'throne',
    name: 'O Trono Vazio',
    family: 'Destino',
    price_cp: 0,
    buyable: false,
    cell: 7,
    description: 'Uma cadeira sem dono, um lugar sem promessa. A ausência também deixa sua marca.',
    comment: 'O trono está vazio. Isso não significa que esteja esperando por qualquer um.',
  },
] as const;
export type Card = (typeof cards)[number];
export type OwnedCard = {
  id: string;
  card_id: string;
  level: number;
  slot: number | null;
  price_cp: number;
  created_at: string;
};
export const cardQuestions = [
  {
    question: 'Quem é você?',
    answer:
      'Por enquanto, sou o Anfitrião. Cuido desta sala e das cartas que chegam até ela. Sente-se; temos tempo para conversar.',
  },
  {
    question: 'Quantas cartas posso levar?',
    answer:
      'Suas cartas pertencem ao personagem que as recebe. Você pode manter três equipadas de cada vez e trocar a combinação quando quiser.',
  },
  {
    question: 'Como consigo novas cartas?',
    answer:
      'As cartas com preço podem ser compradas aqui com seu ouro. As outras ainda guardam histórias que serão abertas depois. Os aprimoramentos também terão seu momento.',
  },
] as const;
