import type { Page } from './types';

type Tutorial = { title: string; description: string; steps: { title: string; text: string }[] };

export const pageTutorials = {
  overview: {
    title: 'Seu próximo passo na Alvorada',
    description: 'Acompanhe os compromissos e encontre as áreas do portal.',
    steps: [
      {
        title: 'Confira sua agenda',
        text: 'Veja as aventuras próximas e abra uma publicação para conferir horário, patente e participantes.',
      },
      {
        title: 'Escolha quem vai jogar',
        text: 'Use o personagem selecionado para consultar a ficha e os recursos daquela jornada.',
      },
      {
        title: 'Explore pelo Menu',
        text: 'O Menu reúne Personagem, Mural, Loja, Explorar e Biblioteca. A ajuda de cada aba acompanha o que você abrir.',
      },
    ],
  },
  characters: {
    title: 'Seu acampamento',
    description: 'Crie e escolha os aventureiros da sua conta.',
    steps: [
      {
        title: 'Escolha uma vaga',
        text: 'Crie um personagem em uma vaga disponível e preencha suas escolhas de espécie, classe e antecedente.',
      },
      {
        title: 'Distribua os atributos',
        text: 'Confira os seis valores rolados, escolha onde usar cada um e finalize a ficha. As rolagens pertencem à vaga.',
      },
      {
        title: 'Cuide da jornada',
        text: 'Selecione o personagem antes de visitar outras abas. A partir do nível 5, a aposentadoria permite recomeçar ou encerrar sua jornada com Prestígio.',
      },
    ],
  },
  profile: {
    title: 'Conheça sua ficha',
    description: 'Consulte atributos, escolhas e recursos do personagem selecionado.',
    steps: [
      {
        title: 'Confira os valores',
        text: 'Atributos, perícias, salvaguardas e recursos ficam nas seções da ficha. Abra os detalhes de uma escolha para entender seu uso.',
      },
      {
        title: 'Finalize as escolhas',
        text: 'Complete as opções disponíveis para sua classe e origem antes de usar a ficha na mesa.',
      },
      {
        title: 'Revise o equipamento',
        text: 'Os itens equipados no Inventário alimentam os ataques da ficha. Recursos específicos da sessão são acompanhados na mesa virtual.',
      },
    ],
  },
  inventory: {
    title: 'Organize seus equipamentos',
    description: 'Mochila, cofre e itens equipados do personagem.',
    steps: [
      {
        title: 'Abra um item',
        text: 'Selecione a peça para consultar descrição, quantidade e propriedades. Use a busca para localizar seus bens.',
      },
      {
        title: 'Equipe as peças',
        text: 'Escolha as posições disponíveis para armas e armaduras. Equipamentos precisam estar na mochila e disponíveis para esse uso.',
      },
      {
        title: 'Organize o que sobra',
        text: 'Transfira bens entre mochila e cofre. Confira a quantidade e a confirmação antes de descartar um item.',
      },
    ],
  },
  achievements: {
    title: 'Exponha suas conquistas',
    description: 'Organize as marcas que sua jornada deixou.',
    steps: [
      {
        title: 'Veja o que conquistou',
        text: 'Consulte as conquistas liberadas pelo progresso do personagem e abra seus detalhes.',
      },
      {
        title: 'Monte a exposição',
        text: 'Use os espaços e prateleiras disponíveis para organizar as peças que deseja mostrar.',
      },
      {
        title: 'Confira sua apresentação',
        text: 'Revise a posição das conquistas e salve os ajustes oferecidos pela aba.',
      },
    ],
  },
  board: {
    title: 'Encontre sua próxima aventura',
    description: 'O mural reúne as publicações da comunidade.',
    steps: [
      {
        title: 'Procure uma publicação',
        text: 'Abra os avisos para conferir a proposta, a data, a dificuldade e a patente exigida.',
      },
      {
        title: 'Inscreva seu personagem',
        text: 'Escolha um personagem elegível e confirme a participação enquanto a missão estiver aberta.',
      },
      {
        title: 'Acompanhe a conclusão',
        text: 'O mestre inicia e conclui a missão. Ouro, progresso e Créditos do Bastião entram após a conclusão registrada.',
      },
    ],
  },
  missions: {
    title: 'Acompanhe suas missões',
    description: 'Consulte as aventuras e o histórico de participação.',
    steps: [
      {
        title: 'Escolha a missão',
        text: 'Confira o estado da publicação e abra seus detalhes para ver a proposta e a agenda.',
      },
      {
        title: 'Confira a patente',
        text: 'O personagem precisa atender à patente e aos requisitos da missão. Testes de promoção seguem requisitos próprios.',
      },
      {
        title: 'Veja o resultado',
        text: 'Depois que o mestre concluir, consulte o resumo e o registro das recompensas.',
      },
    ],
  },
  hooks: {
    title: 'Siga os ganchos da história',
    description: 'Descubra caminhos deixados pelas aventuras anteriores.',
    steps: [
      {
        title: 'Leia a proposta',
        text: 'Abra um gancho para conhecer a situação, os envolvidos e as possibilidades de continuidade.',
      },
      {
        title: 'Consulte a origem',
        text: 'Quando houver vínculo com uma missão ou lugar do mundo, veja o registro para conhecer o contexto.',
      },
      {
        title: 'Leve a ideia à mesa',
        text: 'Combine a continuidade com o mestre. A participação e as recompensas pertencem à missão publicada.',
      },
    ],
  },
  shop: {
    title: 'Compre no Empório',
    description: 'Escolha equipamentos e confira o carrinho antes de pagar.',
    steps: [
      {
        title: 'Explore as prateleiras',
        text: 'Filtre a categoria ou procure um item pelo nome. Abra seus detalhes para consultar propriedades e variantes.',
      },
      {
        title: 'Monte o carrinho',
        text: 'Adicione os itens e as quantidades desejadas. Confira qual personagem está selecionado e o valor total.',
      },
      {
        title: 'Confirme e equipe',
        text: 'Finalize a compra com ouro. Os itens vão para a mochila e podem ser equipados pelo Inventário. Selecione o vendedor para conversar.',
      },
    ],
  },
  reliquias: {
    title: 'Descubra as Relíquias',
    description: 'Use o Prestígio da conta para adquirir recompensas.',
    steps: [
      {
        title: 'Escolha uma prateleira',
        text: 'Consulte armas de Prestígio, skins, bordas e companheiros. Clique na arte para ampliar e ler os detalhes.',
      },
      {
        title: 'Confira quem recebe',
        text: 'Armas e companheiros vão para o personagem escolhido. As armas mostram o nível exigido e seus estágios de evolução.',
      },
      {
        title: 'Use sua coleção',
        text: 'A sacola abre suas compras para aplicar skins e bordas. A Tabela de Prestígio mostra as recompensas de aposentadoria configuradas.',
      },
    ],
  },
  cristais: {
    title: 'A Loja de Cristais abrirá depois',
    description: 'Esta área está reservada para uma próxima etapa do servidor.',
    steps: [
      {
        title: 'Consulte as áreas disponíveis',
        text: 'O Empório oferece equipamentos por ouro e Relíquias reúne as recompensas de Prestígio.',
      },
      {
        title: 'Acompanhe os avisos',
        text: 'A abertura da Torre e da sua loja será informada pelo portal quando esta etapa estiver disponível.',
      },
    ],
  },
  tower: {
    title: 'A Torre abrirá depois',
    description: 'As expedições da Torre estão bloqueadas nesta etapa do servidor.',
    steps: [
      {
        title: 'Encontre uma missão',
        text: 'Use o Mural para consultar as aventuras disponíveis e se inscrever com seu personagem.',
      },
      {
        title: 'Acompanhe a abertura',
        text: 'As expedições, os cristais e a loja da Torre serão disponibilizados em uma próxima etapa.',
      },
    ],
  },
  stable: {
    title: 'Escolha sua montaria',
    description: 'Encontre um companheiro de viagem e cuide de seu equipamento.',
    steps: [
      {
        title: 'Conheça os modelos',
        text: 'Compare as montarias, pelagens e preços. Abra os detalhes antes de confirmar a compra.',
      },
      {
        title: 'Prepare a viagem',
        text: 'Equipe acessórios e bardas compatíveis pelo inventário da montaria.',
      },
      {
        title: 'Leve para a mesa',
        text: 'Montarias adquiridas podem ser colocadas na mesa virtual. Consulte seu auxílio e suas limitações antes de usá-los.',
      },
    ],
  },
  pets: {
    title: 'Encontre seu mascote',
    description: 'Escolha e apresente o companheiro do seu personagem.',
    steps: [
      {
        title: 'Escolha o companheiro',
        text: 'Veja as espécies, aparências e valores disponíveis. Confira os detalhes e o auxílio de cada mascote.',
      },
      {
        title: 'Cuide dos equipamentos',
        text: 'Use os acessórios compatíveis com o animal e consulte seus próprios itens.',
      },
      {
        title: 'Use na aventura',
        text: 'Coloque o mascote na mesa virtual quando fizer sentido para a cena. Os auxílios seguem o efeito e a frequência descritos.',
      },
    ],
  },
  events: {
    title: 'Participe dos eventos',
    description: 'Confira os encontros preparados pela comunidade.',
    steps: [
      {
        title: 'Veja os encontros',
        text: 'Abra um evento para consultar proposta, data, horário e condições de participação.',
      },
      {
        title: 'Confira sua inscrição',
        text: 'Use as ações disponíveis no evento e veja quais personagens podem participar.',
      },
      {
        title: 'Acompanhe os registros',
        text: 'Consulte as publicações relacionadas e as missões vinculadas para seguir o andamento do evento.',
      },
    ],
  },
  titles: {
    title: 'Escolha como será conhecido',
    description: 'Consulte os títulos do seu personagem.',
    steps: [
      {
        title: 'Confira os títulos',
        text: 'Veja os títulos disponíveis e as condições apresentadas na aba.',
      },
      {
        title: 'Escolha sua apresentação',
        text: 'Use as opções liberadas para definir o título exibido junto ao nome do personagem.',
      },
      {
        title: 'Revise o perfil',
        text: 'Confira como o nome e o título aparecem na apresentação do aventureiro.',
      },
    ],
  },
  cards: {
    title: 'Entre no Salão das Cartas',
    description: 'Explore as cartas e as ações disponíveis no salão.',
    steps: [
      {
        title: 'Escolha o personagem',
        text: 'Confira o aventureiro selecionado e o saldo antes de usar uma opção de compra ou abertura.',
      },
      {
        title: 'Escolha uma carta',
        text: 'Abra o catálogo do Anfitrião, compare as cartas e seus níveis e confira o preço antes de comprar.',
      },
      {
        title: 'Equipe até três cartas',
        text: 'Escolha um dos três espaços sobre a mesa para equipar uma carta da coleção. Você pode trocar a carta ou esvaziar o espaço.',
      },
    ],
  },
  'character-cards': {
    title: 'As cartas que acompanham você',
    description: 'Consulte o acervo de cartas do personagem selecionado.',
    steps: [
      {
        title: 'Encontre sua carta',
        text: 'Use Buscar na coleção para filtrar pelo nome ou pela família e abra a carta que deseja consultar.',
      },
      {
        title: 'Leia os detalhes',
        text: 'Confira a arte, o nível e a história da carta. As cartas adquiridas no Salão das Cartas ficam neste acervo.',
      },
      {
        title: 'Escolha os espaços',
        text: 'Use Equipar no espaço para escolher quais cartas acompanham o personagem. Os três espaços selecionados aparecem na coleção e no Salão.',
      },
    ],
  },
  vtt: {
    title: 'Prepare sua mesa virtual',
    description: 'Entre na sessão e use os recursos da cena.',
    steps: [
      {
        title: 'Entre na mesa',
        text: 'Abra uma sala ou use o convite do mestre. Escolha a participação oferecida pela sessão.',
      },
      {
        title: 'Coloque seu personagem',
        text: 'Abra Fichas para importar os personagens e companheiros disponíveis. Selecione seu token para acessar suas ações.',
      },
      {
        title: 'Jogue e acompanhe',
        text: 'Use chat, dados, ataques e recursos da ficha. Confirme o alvo e o resultado antes de aplicar dano. O mestre organiza mapas e cenas.',
      },
    ],
  },
  hall: {
    title: 'Conheça as jornadas da comunidade',
    description: 'Explore os registros dos aventureiros.',
    steps: [
      {
        title: 'Escolha um aventureiro',
        text: 'Abra uma apresentação para conhecer o personagem e sua jornada.',
      },
      {
        title: 'Veja as conquistas',
        text: 'Consulte as informações públicas e as marcas reunidas pelo aventureiro.',
      },
      {
        title: 'Continue explorando',
        text: 'Use as opções da aba para conhecer outros perfis e registros da comunidade.',
      },
    ],
  },
  profiles: {
    title: 'Encontre outros jogadores',
    description: 'Conheça os perfis e suas apresentações públicas.',
    steps: [
      {
        title: 'Procure um perfil',
        text: 'Use a lista e a busca disponíveis para encontrar alguém da comunidade.',
      },
      {
        title: 'Conheça os personagens',
        text: 'Abra o perfil para consultar sua apresentação e os aventureiros expostos.',
      },
      {
        title: 'Converse com amigos',
        text: 'Use os recursos sociais disponíveis. As conversas privadas dependem da amizade aceita.',
      },
    ],
  },
  house: {
    title: 'Encontre a comunidade no lobby',
    description: 'Um espaço compartilhado para conversar e interpretar.',
    steps: [
      {
        title: 'Entre no cenário',
        text: 'Escolha o personagem e consulte as áreas disponíveis no lobby.',
      },
      {
        title: 'Participe da conversa',
        text: 'Use o chat da área para conversar e interpretar com quem está presente.',
      },
      {
        title: 'Respeite o espaço',
        text: 'Interaja com as opções disponíveis na cena. A House particular fica na aba House do menu Explorar.',
      },
    ],
  },
  house2: {
    title: 'Construa seu lugar na vila',
    description: 'Escolha um terreno, decore a casa e acompanhe sua horta.',
    steps: [
      {
        title: 'Escolha onde morar',
        text: 'Entre em uma vizinhança e selecione um lote. Terreno, casa e mobília são adquiridos com Créditos do Bastião.',
      },
      {
        title: 'Decore seu terreno',
        text: 'Coloque os objetos pela Minha coleção. Arraste as peças, gire e ajuste o tamanho pelas bordas. Use Salvar para guardar as posições.',
      },
      {
        title: 'Cuide da horta',
        text: 'Abra Horta e posicione o canteiro e o fermentador. Plante e regue para começar. As plantas mudam de aparência em horas reais e podem render cura ou ouro.',
      },
    ],
  },
  guild: {
    title: 'Reúna sua companhia',
    description: 'Participe de uma guilda e acompanhe o progresso coletivo.',
    steps: [
      {
        title: 'Entre na companhia',
        text: 'Consulte as guildas e use as opções de criação, convite ou participação disponíveis para o personagem.',
      },
      {
        title: 'Conheça o bastião',
        text: 'Explore as salas, os objetos e os benefícios de cada instalação. Abra seus detalhes para consultar os níveis.',
      },
      {
        title: 'Contribua para evoluir',
        text: 'A Ferraria recebe ouro dos membros. A Ferramenta de Expedição usa as tags de monstros acumuladas pela guilda. O fundador autoriza a evolução quando os requisitos estiverem cumpridos.',
      },
    ],
  },
  world: {
    title: 'Explore o mundo',
    description: 'Encontre lugares, histórias e publicações no atlas.',
    steps: [
      {
        title: 'Navegue pelo mapa',
        text: 'Arraste para explorar e use o zoom para aproximar as regiões que deseja conhecer.',
      },
      {
        title: 'Abra os lugares',
        text: 'Selecione os pontos disponíveis para consultar descrições, informações e histórias.',
      },
      {
        title: 'Siga as aventuras',
        text: 'Consulte as publicações vinculadas aos locais para encontrar missões e ganchos daquela região.',
      },
    ],
  },
  lore: {
    title: 'Consulte as histórias da Alvorada',
    description: 'Leia o cenário e acompanhe seus acontecimentos.',
    steps: [
      {
        title: 'Escolha um assunto',
        text: 'Explore as pastas e páginas para encontrar povos, lugares, personagens e histórias.',
      },
      {
        title: 'Abra a leitura',
        text: 'Selecione uma página e consulte o texto e as imagens. Use os vínculos disponíveis para conhecer o contexto.',
      },
      {
        title: 'Acompanhe a cronologia',
        text: 'Consulte os acontecimentos registrados para seguir a história do cenário.',
      },
    ],
  },
  rules: {
    title: 'Encontre a regra que precisa',
    description: 'O códice reúne as mecânicas e os acordos do portal.',
    steps: [
      {
        title: 'Escolha o capítulo',
        text: 'Abra o sumário para navegar entre criação, progressão, economia, aventuras e vida na comunidade.',
      },
      {
        title: 'Consulte o artigo',
        text: 'Leia os procedimentos, valores e tabelas. As seções explicam como usar as mecânicas atuais.',
      },
      {
        title: 'Volte quando precisar',
        text: 'Use a busca e os capítulos para consultar uma regra durante a preparação da aventura.',
      },
    ],
  },
} satisfies Record<Page, Tutorial>;
