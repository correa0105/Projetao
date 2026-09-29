import type { Item } from './types';

export const merchantConversations = [
  {
    question: 'Quem é você?',
    answer:
      'Já fui um nome temido nas estradas. Perdi companheiros, um reino… e quase todo o cabelo para os impostos. Hoje sou só o velho atrás do balcão. A tragédia continua, mas agora em horário comercial.',
  },
  {
    question: 'Como você conseguiu todos esses itens?',
    answer:
      'Herança de uma tia. Muito aventureira. Tinha três metros, soltava fogo e dormia em cima de ouro. Os documentos? Queimaram. Terrível acidente de família.',
  },
  {
    question: 'Faz um desconto?',
    answer:
      'Claro! Desconto a ousadia da pergunta e finjo que não ouvi. O preço continua igual, mas essa conversa maravilhosa saiu de graça. Um negócio e tanto, não acha?',
  },
];

// Approximate visible footprint in cm for the illustrated, packed objects.
// Diagonal weapons use their projected bounding length, not their total length.
// These are art proportions, not additional SRD rules or equipment statistics.
export const shopFootprints: Record<string, number> = {
  acid: 25,
  'alchemists-fire': 27,
  antitoxin: 23,
  'ball-bearings': 30,
  basket: 44,
  bell: 22,
  blanket: 55,
  book: 42,
  'glass-bottle': 30,
  bucket: 44,
  caltrops: 30,
  candle: 26,
  chain: 45,
  chest: 80,
  'climbers-kit': 50,
  'component-pouch': 32,
  'hunting-trap': 65,
  lock: 24,
  manacles: 38,
  tinderbox: 28,
  crowbar: 62,
  waterskin: 34,
  shovel: 100,
  oil: 27,
  'boots-of-elvenkind': 45,
  'goggles-of-night': 27,
  'immovable-rod': 52,
  'slippers-of-spider-climbing': 38,
  'leather-armor': 60,
  'chain-mail': 62,
  'studded-leather': 60,
  breastplate: 56,
  'plate-armor': 67,
  shield: 76,
  backpack: 58,
  'hempen-rope-50-feet': 34,
  longsword: 84,
  dagger: 28,
  shortbow: 108,
  rapier: 87,
  greatsword: 113,
  quarterstaff: 130,
  longbow: 170,
  torch: 38,
  bedroll: 61,
  'healers-kit': 28,
  'hooded-lantern': 34,
  rations: 23,
  tent: 82,
  'grappling-hook': 31,
  'bag-of-holding': 43,
  'spell-scroll-cantrip': 48,
  'potion-of-healing': 28,
  'potion-of-climbing': 26,
  'potion-of-growth': 34,
  'potion-of-heroism': 30,
  'potion-of-flying': 32,
  'cloak-of-protection': 48,
  'cloak-of-displacement': 48,
  'crystal-ball': 27,
  'ring-of-protection': 18,
  'ring-of-regeneration': 18,
  'ring-of-invisibility': 18,
  'staff-of-the-magi': 134,
  'dragon-orb': 36,
};

const comments: Record<string, string> = {
  acid: 'O último cliente perguntou se esse ácido tirava manchas. Tirou a mancha, a camisa e metade da mesa.',
  'alchemists-fire':
    'O fogo alquímico insiste em continuar queimando. Uma qualidade admirável, até você derrubar o frasco.',
  antitoxin:
    'Antitoxina. O acompanhamento ideal para aquele jantar oferecido pelo seu maior rival.',
  'ball-bearings':
    'Mil bolinhas de metal. Espalhe no chão e até um cavaleiro respeitado aprende a dançar.',
  basket:
    'Esse cesto já carregou maçãs, cogumelos e um familiar mal-humorado. Recomendo começar pelas maçãs.',
  bell: 'Toque esse sino se precisar de ajuda. Dentro de uma masmorra, porém, não garanto quem vai atender.',
  blanket:
    'Um cobertor quentinho. Derrotar o mal é importante, mas ninguém merece fazê-lo espirrando.',
  book: 'Um livro de verdade: não precisa de encantamento para abrir. Entender o que está escrito já é outra aventura.',
  'glass-bottle':
    'A garrafa está vazia. Vendo esperança engarrafada também, mas aí cobro pelo conteúdo.',
  bucket:
    'Riram do aventureiro que levou um balde. Depois o barco começou a afundar e ele virou o líder.',
  caltrops:
    'Estrepes: quatro pontas e nenhuma simpatia. Marque onde espalhou, ou a emboscada vira uma surpresa para todos.',
  candle: 'A vela dura pouco, mas ilumina bastante. Meu aprendiz é exatamente o contrário.',
  chain:
    'Uma corrente robusta. Para prender monstros, verifique primeiro se eles concordam com o tamanho dos elos.',
  chest: 'O baú vai vazio. Se rosnar no caminho, volte aqui: entreguei o modelo errado.',
  'climbers-kit':
    'O kit de escalada inclui os equipamentos. A conversa com seus deuses, lá no alto, fica por sua conta.',
  'component-pouch':
    'Não cheire a bolsa de componentes. Magos fazem coisas maravilhosas com ingredientes que eu não serviria nem ao meu sogro.',
  'hunting-trap': 'Armadilha de caça. Arme longe da cama; acordar já é desagradável o suficiente.',
  lock: 'Esse cadeado afasta os curiosos. Contra um ladino talentoso, pelo menos rende alguns segundos de suspense.',
  manacles:
    'Algemas resistentes. A chave acompanha, porque da última vez esqueceram de perguntar e o reencontro foi constrangedor.',
  tinderbox:
    'Pederneira, aço e mecha. Para acender a fogueira sem gastar magia nem implorar ao dragão.',
  crowbar: 'Para portas que não entendem um pedido educado. Nem todo problema exige magia.',
  waterskin: 'Água para a viagem. Se colocar vinho, não me culpe pelas escolhas heroicas.',
  shovel: 'Serve para cavar tesouros. Espero que esse seja o seu plano.',
  oil: 'Óleo de lamparina. Não é tempero, mesmo que a ração esteja triste.',
  'boots-of-elvenkind': 'Passos silenciosos. Infelizmente, não silenciam o bardo do grupo.',
  'goggles-of-night': 'Para enxergar no escuro. O que estiver olhando de volta é problema seu.',
  'immovable-rod': 'Mais teimoso que eu. E olha que eu cobro preço cheio há décadas.',
  'slippers-of-spider-climbing': 'Pode subir pelas paredes. Só não use meu teto como provador.',
  'leather-armor': 'Couro bem curtido. Não evita toda pancada, mas você apanha com elegância.',
  'chain-mail': 'Ouça os elos. Malha boa não precisa de uma história enfeitada.',
  'studded-leather': 'Rebites firmes, costuras reforçadas. Pode examinar de perto.',
  breastplate: 'Um bom peitoral. Só não confunda coragem com invulnerabilidade.',
  'plate-armor': 'Belo trabalho de forja. Seu escudeiro vai conhecer bem esse peso.',
  shield: 'Um escudo confiável costuma voltar com mais histórias que a espada.',
  backpack: 'Cabe o necessário. Para levar a loja inteira, cobro o frete à parte.',
  'hempen-rope-50-feet': 'Leve corda. Todo aventureiro se lembra dela quando já está pendurado.',
  longsword: 'Fio bem cuidado. Só não teste na minha madeira.',
  dagger: 'Pequena e prática. Não precisa parecer grande para ser útil.',
  shortbow: 'Compacto para a estrada. A mira, infelizmente, não vem incluída.',
  rapier: 'Uma lâmina elegante. Pede uma mão firme, não pressa.',
  greatsword: 'Essa pede espaço. E distância das minhas prateleiras.',
  quarterstaff: 'Madeira firme, sem floreios. Às vezes, o simples basta.',
  longbow: 'Observe o comprimento. Esse arco não foi feito para um corredor apertado.',
  torch: 'Para quando a escuridão não aceita negociação.',
  bedroll: 'Depois de uma noite nas pedras, isso parece um palácio.',
  'healers-kit': 'Bandagens limpas. Melhor ter e não precisar.',
  'hooded-lantern': 'A luz fica protegida. A chama também merece algum conforto.',
  rations: 'Não é um banquete. Mas é melhor que negociar com o estômago vazio.',
  tent: 'Está dobrada para viagem. Não tente armá-la aqui dentro.',
  'grappling-hook': 'Ferro firme. Confira onde vai prender antes de confiar o pescoço.',
  'bag-of-holding': 'Por fora, discreta. Por dentro… bem, examine com respeito.',
  'spell-scroll-cantrip': 'Cuidado com os dedos. A tinta custou mais que o pergaminho.',
  'potion-of-healing': 'Para quando o plano “confia em mim” dá errado. Costumo vender aos pares.',
  'potion-of-climbing': 'Para quem prefere subir a dar a volta.',
  'potion-of-growth': 'Guarde para um lugar espaçoso. Meu teto é baixo.',
  'potion-of-heroism': 'Coragem engarrafada. Bom senso ainda é por sua conta.',
  'potion-of-flying': 'Leve com cuidado. Eu prefiro manter meus pés no chão.',
  'cloak-of-protection': 'Discreto e bem acabado. Pode sentir o tecido.',
  'cloak-of-displacement': 'O tecido prega peças nos olhos. Não é defeito.',
  'crystal-ball': 'Manuseie com as duas mãos. Vidro e pressa não são amigos.',
  'ring-of-protection': 'Pequeno o bastante para perder. Valioso demais para isso.',
  'ring-of-regeneration': 'Uma joia dessas merece uma mão cuidadosa.',
  'ring-of-invisibility': 'Se sumir com o anel, ainda vou lembrar da conta.',
  'staff-of-the-magi': 'Não bata a ponta no chão. Certas mercadorias exigem respeito.',
  'dragon-orb': 'Esse não é um enfeite. Até eu escolho as palavras perto dele.',
};
export function merchantComment(item: Item) {
  return comments[item.id] ?? `${item.name}. Examine à vontade antes de decidir.`;
}
