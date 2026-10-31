export type TowerRoom = 'reception' | 'atlas' | 'expeditions' | 'crystals' | 'treasures';
export type TowerTopic =
  | 'welcome'
  | 'tower'
  | 'discoveries'
  | 'expeditions'
  | 'return'
  | 'crystals'
  | 'trade'
  | 'uses'
  | 'treasures';
export const towerRooms: {
  id: TowerRoom;
  name: string;
  title: string;
  description: string;
  image: string;
  portrait: string;
  topic: TowerTopic;
}[] = [
  {
    id: 'reception',
    name: 'Recepção',
    title: 'Diretoria da Torre',
    description: 'Um registro antes da jornada.',
    image: '/tower/headquarters-reception-room-20261030.webp',
    portrait: '/tower/headquarters-lia-reception-20261030.webp',
    topic: 'welcome',
  },
  {
    id: 'expeditions',
    name: 'Expedições',
    title: 'Sala de expedições',
    description: 'Companhias, preparativos e registros da subida.',
    image: '/tower/headquarters-expeditions-room-20261030.webp',
    portrait: '/tower/headquarters-lia-expeditions-20261030.webp',
    topic: 'expeditions',
  },
  {
    id: 'atlas',
    name: 'Arquivo da Torre',
    title: 'Arquivo da Torre',
    description: 'Os registros do que já foi descoberto.',
    image: '/tower/headquarters-atlas-window-20261030.webp',
    portrait: '/tower/headquarters-lia-atlas-20261030.webp',
    topic: 'discoveries',
  },
  {
    id: 'crystals',
    name: 'Cristais',
    title: 'Gabinete de cristais',
    description: 'O registro do que você trouxe do Véu.',
    image: '/tower/headquarters-crystals-room-20261030.webp',
    portrait: '/tower/headquarters-lia-crystals-20261030.webp',
    topic: 'crystals',
  },
  {
    id: 'treasures',
    name: 'Tesouros',
    title: 'Mesa de retorno',
    description: 'Tesouros e recompensas da sua jornada.',
    image: '/tower/headquarters-treasures-room-20261030.webp',
    portrait: '/tower/headquarters-lia-treasures-20261030.webp',
    topic: 'treasures',
  },
];
type Answer = {
  title: string;
  paragraphs: string[];
  action?: { label: string; room: TowerRoom };
  related: TowerTopic[];
};
export const towerAnswers: Record<TowerTopic, Answer> = {
  welcome: {
    title: 'Como posso ajudar?',
    paragraphs: [
      'Seja bem-vindo à Diretoria da Torre. Sou Lia, a escrivã responsável pelos registros. Antes de partir, vale conhecer o caminho e a companhia que vai com você.',
      'Posso explicar a Torre, mostrar as expedições ou consultar o que você trouxe da última subida.',
    ],
    related: ['tower', 'expeditions', 'crystals', 'treasures'],
  },
  tower: {
    title: 'O que é a Torre do Véu?',
    paragraphs: [
      'São cem andares, organizados em vinte regiões. A cada subida, sua companhia avança pelo que ainda não conhece.',
      'O mestre prepara os encontros e conduz a jornada. Aqui no arquivo, os registros de criaturas, desafios e armadilhas só são revelados após a conquista do andar.',
    ],
    action: { label: 'Acompanhar Lia até o arquivo', room: 'atlas' },
    related: ['discoveries', 'expeditions'],
  },
  discoveries: {
    title: 'O que podemos consultar no arquivo?',
    paragraphs: [
      'O arquivo reúne os cem andares da Torre. A primeira região tem nome conhecido; as demais continuam marcadas como ???.',
      'Criaturas, guardiões, desafios e armadilhas ficam sob sigilo até o andar ser concluído. Uma conquista pessoal ou da guilda torna esses registros disponíveis. Inscrever-se numa expedição não revela os encontros.',
    ],
    action: { label: 'Consultar os registros da Torre', room: 'atlas' },
    related: ['tower', 'expeditions', 'return'],
  },
  expeditions: {
    title: 'Como preparo uma expedição?',
    paragraphs: [
      'O mestre abre uma companhia em preparação. Os jogadores entram com seus próprios personagens, até oito aventureiros por grupo. Cada personagem participa de uma expedição aberta ou ativa de cada vez.',
      'Com o grupo pronto, o mestre inicia a ascensão e confirma os andares vencidos em sequência. Quando houver guardião, sua derrota também precisa ser confirmada.',
    ],
    action: { label: 'Ir à sala de expedições', room: 'expeditions' },
    related: ['return', 'discoveries', 'crystals'],
  },
  return: {
    title: 'O que acontece quando voltamos?',
    paragraphs: [
      'Depois de ao menos um andar concluído, o mestre pode confirmar o retorno. Cada participante recebe a recompensa de ouro e cristais correspondente ao progresso registrado.',
      'Há também um tesouro adicional, revelado por um d100. O grau considera os guardiões realmente vencidos; os valores e itens seguem a tabela registrada no retorno. Cada recompensa é entregue uma única vez.',
    ],
    action: { label: 'Consultar meus tesouros de retorno', room: 'treasures' },
    related: ['treasures', 'crystals', 'expeditions'],
  },
  crystals: {
    title: 'O que são os cristais?',
    paragraphs: [
      'São a moeda própria da Torre. O registro pertence ao seu personagem: você recebe cristais pelo retorno confirmado de uma expedição e pode receber mais ao revelar um tesouro.',
      'O saldo deste gabinete é o mesmo saldo registrado após suas jornadas. Consultar os documentos ou conversar comigo não consome cristais.',
    ],
    action: { label: 'Acompanhar Lia ao gabinete de cristais', room: 'crystals' },
    related: ['trade', 'uses', 'return'],
  },
  trade: {
    title: 'Como os cristais são comercializados?',
    paragraphs: [
      'O entreposto ainda não está aberto. Nesta sede, ainda não há venda de cristais, troca por ouro ou mercadorias que possam ser compradas com esse saldo.',
      'Por enquanto, os cristais conquistados ficam guardados no registro do personagem. Posso mostrar seu saldo e os tesouros que deram origem às recompensas.',
    ],
    action: { label: 'Ver meu registro de cristais', room: 'crystals' },
    related: ['uses', 'crystals', 'treasures'],
  },
  uses: {
    title: 'Em que posso usar meus cristais?',
    paragraphs: [
      'Hoje, os cristais são acumulados como moeda da Torre. Ainda não existe um serviço de gasto, compra ou aprimoramento com eles nesta sede.',
      'Eles não concedem atributos, experiência, cartas ou melhorias automaticamente. As relíquias sem um item vinculado também permanecem colecionáveis. Quando um tesouro inclui um item do catálogo, ele é entregue ao inventário pelas regras da recompensa.',
    ],
    action: { label: 'Consultar cristais e registros', room: 'crystals' },
    related: ['trade', 'treasures', 'return'],
  },
  treasures: {
    title: 'Como revelo um tesouro?',
    paragraphs: [
      'Os tesouros aparecem depois do retorno confirmado da expedição. Cada participante pode revelar o seu resultado no d100, uma única vez.',
      'O prêmio segue a tabela guardada no retorno: alterações posteriores não reescrevem o que você conquistou. Ouro e cristais extras são adicionais; itens vinculados são entregues ao inventário.',
    ],
    action: { label: 'Ir à mesa de retorno', room: 'treasures' },
    related: ['return', 'crystals', 'uses'],
  },
};
export const towerQuestionLabels: Record<TowerTopic, string> = {
  welcome: 'Outras perguntas',
  tower: 'Quero conhecer a Torre.',
  discoveries: 'O que já podemos descobrir?',
  expeditions: 'Quero preparar uma expedição.',
  return: 'Como funciona o retorno?',
  crystals: 'O que são os cristais?',
  trade: 'Como funciona o comércio de cristais?',
  uses: 'Em que os cristais são usados?',
  treasures: 'Como recebo meus tesouros?',
};
