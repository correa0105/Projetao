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
      'A Vigília. Ficavam acesas lanternas como esta nos portões do Norte, mesmo quando ninguém esperava visitas. Gosto de pensar que algum viajante conseguiu voltar por causa delas.',
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
      'Olhe as penas, perto do pescoço. O artista pintou cada uma antes de tocar no céu. Disse que este corvo conhecia o caminho de casa; nunca me contou de quem era a casa.',
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
      'Recebi este espelho dentro de um pano de linho. O dono pediu que eu não juntasse os pedaços. Guardei a carta, e respeitei o pedido. Você parece ter parado no mesmo fragmento que ele.',
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
      'Esta foi pintada por alguém que viajava à noite. Repare na figura junto à montanha: ela segue em frente, embora a estrada já tenha sumido. Sempre volto a olhar esse detalhe.',
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
      'Passe o olhar pelas raízes. Quase se confundem com a pedra. Ainda não posso entregar esta carta; prometi guardá-la até que saibam de onde veio.',
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
      'Um marinheiro deixou esta comigo antes de partir. Pediu que eu a conservasse longe da umidade, como se não tivesse passado a vida no mar. Ela permanece guardada por enquanto.',
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
      'O fio está limpo, mas o punho foi gasto por muitas mãos. Há um nome gravado na guarda; a pintura não deixa ler. Também esta continua sob meus cuidados.',
  },
  {
    id: 'throne',
    name: 'O Trono Vazio',
    family: 'Destino',
    price_cp: 0,
    buyable: false,
    cell: 7,
    description: 'Uma cadeira sem dono, um lugar sem promessa. A ausência também deixa sua marca.',
    comment:
      'Quando trouxe esta carta, o pintor ficou um bom tempo sentado onde você está. Perguntou se uma cadeira vazia podia incomodar alguém. Não a pus à venda.',
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
      'Chamam-me de Anfitrião. Recebo as cartas que viajantes trazem e cuido delas até encontrarem outra companhia. Algumas vieram com uma história; outras, apenas com um pedido de silêncio. Pode se sentar.',
  },
  {
    question: 'Quantas cartas posso levar?',
    answer:
      'Três podem acompanhar você ao mesmo tempo. As demais ficam guardadas na sua coleção. Escolha um dos três lugares e coloque ali a carta que deseja levar; poderá trocar a combinação quando voltar.',
  },
  {
    question: 'Como consigo novas cartas?',
    answer:
      'As quatro primeiras estão à venda; deixei o preço junto de cada uma. As outras ficam sob minha guarda por enquanto. Quando houver um modo de recebê-las, você saberá. Não aceito ouro por promessas.',
  },
] as const;
