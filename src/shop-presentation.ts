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
  'immovable-rod':
    'Aperte o botão e o bastão se recusa a sair do lugar. Mais teimoso que eu, e olha que cobro preço cheio há décadas.',
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
  'bag-of-holding':
    'Cabe mais nessa bolsa do que o tamanho dela sugere. Já na minha loja, espaço continua caro: nada de despejar a mochila no balcão.',
  'spell-scroll-cantrip':
    'Um truque escrito em pergaminho. Não confunda a simplicidade do feitiço com o trabalho de copiá-lo; meu escriba não aceita pagamento em elogios.',
  'potion-of-healing': 'Para quando o plano “confia em mim” dá errado. Costumo vender aos pares.',
  'potion-of-climbing':
    'Escalada engarrafada, para quem olha um paredão e vê um atalho. Se era só para buscar algo na prateleira, eu tinha uma escada mais barata.',
  'potion-of-growth': 'Guarde para um lugar espaçoso. Meu teto é baixo.',
  'potion-of-heroism': 'Coragem engarrafada. Bom senso ainda é por sua conta.',
  'potion-of-flying':
    'Voo em um frasco. Antes de pensar na vista lá de cima, escolha onde vai pousar; nunca confiei num plano que termina com “depois eu vejo”.',
  'cloak-of-protection':
    'O manto parece discreto, mas a proteção faz parte do encanto. Gosto de mercadoria que trabalha sem anunciar sua chegada a uma rua inteira.',
  'cloak-of-displacement': 'O tecido prega peças nos olhos. Não é defeito.',
  'crystal-ball':
    'Esta bola serve à vidência, não à decoração da sala. Se conseguir ver o futuro, me avise antes do próximo aumento de impostos.',
  'ring-of-protection':
    'Um aro pequeno, com proteção que vai além do enfeite. Guarde bem: procurar uma joia perdida é a aventura menos lucrativa que conheço.',
  'ring-of-regeneration':
    'A regeneração é mérito do anel. A teimosia de voltar com novos ferimentos costuma ser do dono; conheço bem essa espécie de cliente.',
  'ring-of-invisibility':
    'O anel pode esconder você dos olhos alheios. Da minha caderneta, só pagando; tenho ótima memória para quem desaparece antes de acertar a conta.',
  'staff-of-the-magi':
    'Um cajado desses pertence às mãos de um conjurador, não ao canto das bengalas. Não bata a ponta no chão; já tenho problemas suficientes sem irritar a mercadoria.',
  'dragon-orb': 'Esse não é um enfeite. Até eu escolho as palavras perto dele.',
  'cosmetic-cape':
    'Essa capa não tem encantamento, só um caimento que ajuda a entrar na taverna com alguma dignidade. O resto depende de como você sai de lá.',
  'cosmetic-necklace':
    'Prata e uma pequena gema azul. Não guarda feitiço nem segredo real; às vezes um colar bonito já é motivo suficiente para gastar moedas.',
  'cosmetic-tiara':
    'A gema azul fica bem no centro, como convém a quem quer ser notado. A tiara não dá autoridade; para isso, infelizmente, ainda pedem juízo.',
  'cosmetic-gloves':
    'Luvas de couro castanho. Deixam o aperto de mão mais apresentável, mas não tornam um mau acordo menos ruim.',
  'cosmetic-boots':
    'Botas de viagem, sem o encanto das élficas. Se fizerem barulho na entrada, diga que chegou com presença; sai mais barato que magia.',
  cigar:
    'Enrolado à mão, para quem prefere fazer a conversa durar na taverna. Acenda longe dos meus pergaminhos; não cobro perdas em baforadas.',
};
export function merchantComment(item: Item) {
  return (
    comments[item.id] ??
    item.merchant_comment ??
    `${item.name}. Examine à vontade antes de decidir.`
  );
}
