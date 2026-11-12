import type { RuleChapter } from './rulebook';

export const currentRuleChapters: RuleChapter[] = [
  {
    id: 'jornadas',
    title: 'Vagas, aposentadoria e Prestígio',
    description: 'Como encerrar ou recomeçar uma jornada.',
    symbol: 'crest',
    articles: [
      {
        id: 'jornadas-vagas',
        title: 'Dados e continuidade da vaga',
        summary: 'A vaga conserva as rolagens durante as primeiras jornadas.',
        tag: 'Personagem',
        blocks: [
          {
            id: 'jornadas-vagas-texto',
            type: 'text',
            text: 'A conta possui duas vagas por padrão. Ampliações concedidas à conta aparecem no acampamento. A rolagem gera seis valores por 4d6, descartando o menor dado de cada grupo. Cada resultado tem mínimo 8 antes dos bônus, e a soma ajustada dos seis fica entre 72 e 90. O jogador distribui esses resultados entre os atributos e recebe os bônus do antecedente.',
          },
          {
            id: 'jornadas-vagas-exclusao',
            type: 'text',
            text: 'Excluir um personagem pela opção comum libera sua vaga e não concede Prestígio. Se ele ainda não atingiu o nível 4, a próxima criação daquela vaga utiliza os mesmos resultados. Atingir o nível 4 libera uma nova rolagem para a próxima criação na vaga.',
          },
        ],
      },
      {
        id: 'jornadas-aposentadoria',
        title: 'Aposentar ou iniciar outra jornada',
        summary: 'Prestígio está disponível a partir do nível 5.',
        tag: 'Prestígio',
        blocks: [
          {
            id: 'jornadas-aposentadoria-passos',
            type: 'list',
            ordered: true,
            items: [
              'A partir do nível 5, abra a aposentadoria do personagem e consulte a recompensa exibida para o nível atual.',
              'Escolha recomeçar no nível 1 ou aposentar definitivamente. A confirmação mostra o personagem e a recompensa.',
              'Ao recomeçar, escolha a classe, mantenha os resultados antigos ou use a nova rolagem oferecida. Distribua os atributos e finalize as escolhas da ficha de nível 1.',
              'O recomeço conserva identidade, história, bens e vínculo com a guilda. A jornada e seu progresso voltam ao início.',
              'A aposentadoria definitiva arquiva a jornada e libera a vaga. O fundador precisa indicar outro personagem ativo para representar a guilda quando necessário.',
            ],
          },
          {
            id: 'jornadas-aposentadoria-pontos',
            type: 'text',
            text: 'O Prestígio pertence à conta e é concedido uma vez pela jornada aposentada. A administração configura a tabela por nível, com saltos nos marcos 5, 9, 13 e 17. Consulte Loja → Relíquias → Tabela de Prestígio. Valores ainda sem configuração aparecem como A definir.',
          },
        ],
      },
    ],
  },
  {
    id: 'reliquias-e-companheiros',
    title: 'Relíquias e companheiros',
    description: 'Compras de Prestígio, armas evolutivas e auxílios dos animais.',
    symbol: 'swords',
    articles: [
      {
        id: 'reliquias-colecao',
        title: 'Comprar e usar Relíquias',
        summary: 'Armas, aparências e companheiros são recebidos conforme a oferta.',
        tag: 'Loja',
        blocks: [
          {
            id: 'reliquias-colecao-lista',
            type: 'list',
            ordered: false,
            items: [
              'O saldo de Prestígio é compartilhado pela conta. Abra a arte para consultar descrição, preço, nível exigido e estágios da arma.',
              'Armas de Prestígio são entregues à mochila do personagem escolhido. Cada modelo pode ser comprado uma vez por conta.',
              'As skins mudam a aparência de armas compatíveis. A coleção permite aplicar a skin a uma arma que o personagem possui.',
              'Bordas são equipadas pela coleção. Montarias e mascotes são entregues ao personagem selecionado. Ofertas podem exigir um nome para o companheiro.',
              'O bônus de uma arma evolutiva acompanha o nível atual de quem a equipa. Depois de um recomeço, seus efeitos aguardam o nível exigido.',
            ],
          },
          {
            id: 'reliquias-armas-tabela',
            type: 'table',
            columns: ['Arma', 'Bônus', 'Efeito adicional'],
            rows: [
              [
                'Espada da Aurora Velada',
                '+1 no nível 5, +2 no 11 e +3 no 17',
                'A partir do nível 11, soma 1d4 de dano ao crítico.',
              ],
              [
                'Arco do Eclipse',
                '+1 no nível 5 e +2 no 13',
                '+2 de dano contra um alvo entre 40 e 150 pés.',
              ],
              [
                'Martelo da Sentinela',
                '+2 a partir do nível 9',
                '+2 de dano com o portador a metade dos PV ou menos.',
              ],
              [
                'Rapieira da Ressaca',
                '+1 a partir do nível 5',
                '+1 de dano contra um alvo a metade dos PV ou menos.',
              ],
            ],
          },
        ],
      },
      {
        id: 'companheiros-auxilios',
        title: 'Montarias, mascotes e seus auxílios',
        summary: 'Cada modelo possui um auxílio próprio, com limite de uso.',
        tag: 'Companheiros',
        blocks: [
          {
            id: 'companheiros-auxilios-texto',
            type: 'text',
            text: 'Consulte o efeito do animal no Estábulo, nos Mascotes ou nos detalhes da oferta. Na mesa virtual, coloque o companheiro e use o painel de auxílio quando a situação descrita ocorrer. O portal registra o uso e suas rolagens conforme o efeito. O mestre confirma a aplicação na cena.',
          },
          {
            id: 'companheiros-equipamento',
            type: 'text',
            text: 'Os animais possuem inventários e equipamentos compatíveis. Uma peça entregue ao animal fica reservada enquanto estiver com ele. Bardas de montaria são peças inteiras. Retrato e token da criatura servem à apresentação e à mesa.',
          },
        ],
      },
    ],
  },
  {
    id: 'moradia',
    title: 'House, decoração e horta',
    description: 'Terreno, casa, mobília e cultivo em horas reais.',
    symbol: 'coins',
    articles: [
      {
        id: 'moradia-propriedade',
        title: 'Seu terreno na vizinhança',
        summary: 'Compras usam Créditos do Bastião; o proprietário organiza o espaço.',
        tag: 'House',
        blocks: [
          {
            id: 'moradia-propriedade-texto',
            type: 'text',
            text: 'Em Explorar → House, escolha uma vizinhança e um terreno disponível. O terreno, a casa e a mobília são compras próprias, pagas com Créditos do Bastião. A confirmação mostra o custo antes do pagamento. A coleção guarda os objetos adquiridos.',
          },
          {
            id: 'moradia-organizar',
            type: 'list',
            ordered: true,
            items: [
              'Selecione seu terreno e coloque um objeto pela Minha coleção.',
              'Arraste o objeto, use o giro livre e ajuste seu tamanho pelas bordas ou controles.',
              'Mantenha a peça inteira dentro do terreno, inclusive quando estiver girada.',
              'Use Salvar para registrar as posições ou Descartar para abandonar os ajustes. Guardar um objeto o devolve à coleção.',
            ],
          },
          {
            id: 'moradia-permissoes',
            type: 'text',
            text: 'O proprietário pode editar a decoração. Visitantes conhecem a vizinhança e as casas conforme as opções de acesso da área. A casa possui posição fixa no lote, enquanto os móveis, o canteiro e o fermentador podem ser ajustados.',
          },
        ],
      },
      {
        id: 'moradia-horta',
        title: 'Plantar e acompanhar o crescimento',
        summary: 'Cada casa possui um canteiro e um fermentador.',
        tag: 'Horta',
        blocks: [
          {
            id: 'moradia-horta-passos',
            type: 'list',
            ordered: true,
            items: [
              'Abra Horta em seu terreno e use Posicionar canteiro no terreno ou Posicionar fermentador no terreno.',
              'Escolha o local, arraste, gire, ajuste o tamanho e salve. O canteiro permanece vinculado à horta da casa.',
              'Compre a semente com o ouro do personagem e regue para iniciar o cultivo.',
              'A aparência passa de sementes a brotos, plantas em crescimento e colheita pronta. O tempo conta em horas reais e continua com o site fechado ou a peça guardada.',
              'Quando estiver pronta, escolha preparar o item de cura disponível ou vender a colheita por ouro. A confirmação registra a recompensa uma vez.',
            ],
          },
          {
            id: 'moradia-horta-tabela',
            type: 'table',
            columns: ['Planta', 'Semente', 'Após regar', 'Colheita'],
            rows: [
              ['Erva-bálsamo', '5 PO', '8 horas', '1 Poção de Cura ou venda por 12 PO'],
              ['Raiz-dourada', '8 PO', '12 horas', 'Venda por 20 PO'],
            ],
          },
          {
            id: 'moradia-adubo',
            type: 'text',
            text: 'Cascas de fruta custam 3 PO, fermentam em 2 horas e reduzem o cultivo em 2 horas. Composto de folhas custa 6 PO, fermenta em 4 horas e reduz o cultivo em 4 horas. Cada planta aceita uma aplicação de adubo já fermentado. A aplicação consome o lote de adubo.',
          },
        ],
      },
    ],
  },
  {
    id: 'companhias',
    title: 'Guildas e evolução coletiva',
    description: 'Participação, tesouro e melhorias das instalações.',
    symbol: 'oath',
    articles: [
      {
        id: 'companhias-participacao',
        title: 'Participar de uma companhia',
        summary: 'O personagem representa sua participação na guilda.',
        tag: 'Guilda',
        blocks: [
          {
            id: 'companhias-participacao-texto',
            type: 'text',
            text: 'A comunidade pode criar e reunir diferentes guildas. As opções de fundação, participação e convites aparecem na aba Guilda. A companhia mantém suas salas, decoração, tesouros, agenda e registros coletivos. O fundador administra as ações que exigem sua autorização.',
          },
          {
            id: 'companhias-moedas',
            type: 'text',
            text: 'Créditos do Bastião servem à criação, decoração e às compras indicadas pela interface. O ouro contribuído para a Ferraria possui saldo próprio. A pontuação de patente da guilda é um registro de evolução e não corresponde a uma carteira de moedas.',
          },
        ],
      },
      {
        id: 'companhias-evolucao',
        title: 'Evoluir as instalações',
        summary: 'A Ferraria usa ouro e a Ferramenta de Expedição usa tags de monstros.',
        tag: 'Evolução',
        blocks: [
          {
            id: 'companhias-evolucao-lista',
            type: 'list',
            ordered: true,
            items: [
              'Abra os detalhes do objeto da instalação para ver o benefício atual e o próximo nível.',
              'Na Ferraria, os membros contribuem com ouro de seus personagens. A contribuição alimenta o tesouro de ouro da guilda.',
              'Na Ferramenta de Expedição, as tags conquistadas pelos membros nas missões contam para as metas da companhia. O total de tags ou os tipos exigidos aparecem na evolução.',
              'As tags são metas acumuladas e permanecem no histórico. O ouro exigido é debitado ao evoluir.',
              'O fundador confirma a melhoria quando a sala está liberada e os requisitos do nível foram cumpridos. Cada instalação evolui um nível por vez.',
            ],
          },
          {
            id: 'companhias-configuracao',
            type: 'text',
            text: 'A administração configura benefícios e requisitos de cada nível. Níveis que aguardam definição aparecem como A definir. Os benefícios vigentes são consultados nos detalhes da instalação. As conquistas coletivas registradas continuam na guilda quando um membro sai.',
          },
        ],
      },
    ],
  },
  {
    id: 'portal-e-mesa',
    title: 'Mesa virtual e uso do portal',
    description: 'Ações da sessão, privacidade e áreas disponíveis.',
    symbol: 'compass',
    articles: [
      {
        id: 'portal-mesa',
        title: 'Jogar na mesa virtual',
        summary: 'O mestre prepara a cena e os jogadores usam suas fichas.',
        tag: 'Mesa virtual',
        blocks: [
          {
            id: 'portal-mesa-lista',
            type: 'list',
            ordered: false,
            items: [
              'A mesa possui cenas, mapas, iluminação, tokens, chat e dados. O mestre administra a sessão e a visibilidade das informações.',
              'Jogadores usam os tokens e fichas que controlam. Espectadores acompanham a visão permitida pela mesa.',
              'Ataques usam as armas equipadas e podem registrar alvo, acerto e dano. As armas de Prestígio calculam seus efeitos implementados no fluxo de ataque.',
              'O consumo de itens retira as unidades correspondentes do inventário. Recursos de combate e descansos são acompanhados na sessão.',
              'O mestre confirma condições, efeitos e decisões que exigem interpretação. A descrição de um item deve ser consultada antes do uso.',
            ],
          },
        ],
      },
      {
        id: 'portal-aparencia',
        title: 'Artes, perfis e coleção',
        summary: 'Retrato, token e apresentação acompanham o personagem.',
        tag: 'Apresentação',
        blocks: [
          {
            id: 'portal-aparencia-texto',
            type: 'text',
            text: 'O retrato e o token superior são artes próprias para apresentação e mesa. A criação inicial possui a arte prevista pelo sistema. A conta dispõe de cinco gerações mensais compartilhadas entre os personagens; a interface mostra o uso e a cota disponível. Ao receber uma nova versão para substituir a atual, o dono escolhe qual manter. Mascotes e montarias possuem sua própria disponibilidade de geração.',
          },
          {
            id: 'portal-perfil-privacidade',
            type: 'text',
            text: 'O perfil público apresenta os personagens e conquistas expostos. Mochila, cofre, ouro e dados privados ficam na conta do dono. Mensagens privadas dependem da amizade aceita. Lore, títulos, cartas e histórias registram a apresentação e os acontecimentos da comunidade.',
          },
        ],
      },
      {
        id: 'portal-disponibilidade',
        title: 'Áreas e ajuda de cada aba',
        summary: 'Consulte os tutoriais e acompanhe as etapas do servidor.',
        tag: 'Portal',
        blocks: [
          {
            id: 'portal-disponibilidade-texto',
            type: 'text',
            text: 'A Torre e a Loja de Cristais ficam bloqueadas nesta etapa do servidor. A evolução da guilda utiliza os recursos descritos neste livro. A abertura de etapas seguintes será comunicada pelo portal.',
          },
          {
            id: 'portal-tutoriais',
            type: 'text',
            text: 'Cada aba possui um tutorial com seus primeiros passos. A opção Não mostrar novamente nesta aba guarda a preferência na conta. O botão de ajuda permite reabrir o guia quando necessário.',
          },
        ],
      },
    ],
  },
];
