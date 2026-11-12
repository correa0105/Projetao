import type { Page } from './types';

type Tutorial = { title: string; description: string; steps: { title: string; text: string }[] };

export const pageTutorials = {
  overview: {
    title: 'Como usar o Início',
    description: 'Leia os avisos e encontre os compromissos da guilda.',
    steps: [
      {
        title: 'Abra uma notícia',
        text: 'Role a página para ler os avisos. Quando uma publicação tiver o botão Explorar, clique nele ou na imagem para abrir o conteúdo vinculado.',
      },
      {
        title: 'Consulte uma missão da agenda',
        text: 'Clique no nome de uma aventura na agenda. Você será levado ao mural de missões; abra o aviso correspondente para conferir data, horário e participação.',
      },
      {
        title: 'Guarde um encontro no seu calendário',
        text: 'Nos avisos de encontro, clique em Adicionar ao calendário. Abra o arquivo baixado no seu aplicativo de agenda para incluir o compromisso.',
      },
      {
        title: 'Abra outra área',
        text: 'Clique em Menu na navegação inferior e escolha um grupo, como Personagem ou Loja. Depois clique na aba desejada. O botão Início traz você de volta.',
      },
    ],
  },
  characters: {
    title: 'Como usar Personagens',
    description: 'Crie, selecione e organize os personagens do acampamento.',
    steps: [
      {
        title: 'Crie em uma vaga livre',
        text: 'Clique na silhueta com o sinal de +. Preencha Nome do personagem e as escolhas de criação. Se todas as vagas estiverem ocupadas, abra Personagens e slots para consultar seus personagens.',
      },
      {
        title: 'Escolha quem está ativo',
        text: 'Clique na imagem do personagem no acampamento. Ele fica selecionado para Ficha, Inventário e compras; o mesmo clique abre a prévia do token usado na mesa.',
      },
      {
        title: 'Feche a prévia do token',
        text: 'Use Fechar ou pressione Escape para voltar ao acampamento. A imagem do token é uma prévia: abrir ou fechar essa janela não coloca o personagem em uma mesa.',
      },
      {
        title: 'Troque quem aparece no acampamento',
        text: 'Clique em Trocar personagem abaixo de um aventureiro e escolha outro para aquela posição. Personagens e slots abre a relação completa; retirar alguém da tela não exclui sua ficha.',
      },
      {
        title: 'Conclua a ficha antes de gerar a arte',
        text: 'Abra Menu → Personagem → Ficha e confirme a distribuição dos atributos. Depois volte ao acampamento para usar as opções de imagem do personagem.',
      },
    ],
  },
  profile: {
    title: 'Como usar a Ficha',
    description: 'Finalize os atributos e consulte as seções do personagem.',
    steps: [
      {
        title: 'Complete as escolhas iniciais',
        text: 'Se a ficha ainda estiver em criação, preencha as opções exibidas e clique em Salvar escolhas. Quando disponível, Rolar os seis atributos inicia a etapa dos dados.',
      },
      {
        title: 'Distribua os resultados',
        text: 'Revele as seis rolagens. Em Resultado para cada atributo, escolha qual resultado será usado; depois distribua os bônus do antecedente. Revise e clique em Confirmar distribuição e abrir ficha: essa confirmação é definitiva.',
      },
      {
        title: 'Troque a seção da ficha',
        text: 'Clique em Atributos, Combate, Magias, História ou Equipamento. Cada botão muda o conteúdo mostrado; Equipamento permite consultar os bens, enquanto as trocas de itens são feitas no Inventário.',
      },
      {
        title: 'Registre recursos e anotações',
        text: 'Em Combate, ajuste os campos permitidos e clique em Salvar recursos. Em História, escreva em Anotações e use o botão de salvar da seção para guardar o texto.',
      },
    ],
  },
  inventory: {
    title: 'Como usar o Inventário',
    description: 'Equipe itens e mova seus bens entre mochila e cofre.',
    steps: [
      {
        title: 'Leia os detalhes de um item',
        text: 'Clique na imagem de um item na Mochila ou no Cofre. O cartão aberto mostra descrição, quantidade, peso e valor; sair dele fecha a consulta.',
      },
      {
        title: 'Equipe uma arma ou armadura',
        text: 'Em Itens equipados, clique na posição desejada e escolha um item compatível da mochila. No computador, também é possível arrastar o item para essa posição. Itens no cofre precisam ser levados à mochila primeiro.',
      },
      {
        title: 'Guarde ou retire itens',
        text: 'Abra os detalhes do item e clique em Guardar no cofre ou Levar para a mochila. Na janela de transferência, informe a Quantidade e clique em Transferir.',
      },
      {
        title: 'Retire uma peça equipada',
        text: 'Abra a posição ocupada em Itens equipados e use a ação de desequipar. A peça continua sendo sua e volta a ficar disponível na mochila.',
      },
      {
        title: 'Selecione um companheiro ou confira o token',
        text: 'Na área de montarias e mascotes, escolha qual aparecerá no acampamento. Clique na imagem do personagem em Itens equipados para ver a prévia do token do VTT.',
      },
      {
        title: 'Exclua somente quando tiver certeza',
        text: 'Nos detalhes, Excluir item abre uma confirmação de quantidade. Confira o item e a quantidade antes de concluir: excluir não é o mesmo que guardá-lo no cofre.',
      },
    ],
  },
  achievements: {
    title: 'Como usar Conquistas',
    description: 'Escolha as peças da estante e salve sua exposição.',
    steps: [
      {
        title: 'Encontre uma conquista liberada',
        text: 'Role até Catálogo de conquistas. Digite em Buscar conquista por nome ou use o filtro Desbloqueadas para mostrar as peças que já pode expor.',
      },
      {
        title: 'Coloque uma peça na estante',
        text: 'Escolha Prateleira 1, 2 ou 3 e clique em Exibir na estante na conquista desejada. Se ela já estiver exposta em outra prateleira, use Mover para esta prateleira.',
      },
      {
        title: 'Ajuste a posição',
        text: 'Arraste a peça na estante ou selecione-a em Peça na estante para usar os controles. Trazer para frente e Enviar para trás mudam a sobreposição entre as peças.',
      },
      {
        title: 'Salve ou retire uma peça',
        text: 'Clique em Salvar estante para guardar as posições. Para tirar uma peça da exposição, selecione-a, use Remover da prateleira e salve novamente; a conquista continua desbloqueada.',
      },
      {
        title: 'Escolha seu título',
        text: 'Na seção Títulos do personagem, clique em Exibir título em uma honraria recebida. Posição do título permite escolher Abaixo do nome ou Ao lado do nome.',
      },
    ],
  },
  board: {
    title: 'Como usar o Mural',
    description: 'Abra os avisos e encontre missões, ganchos e eventos.',
    steps: [
      {
        title: 'Abra um aviso ou uma lista',
        text: 'Clique em um papel preso ao mural para ler o aviso. As placas Missões, Ganchos e Eventos abrem listas por categoria; a placa de eventos pode ficar desativada quando não houver evento disponível.',
      },
      {
        title: 'Localize uma publicação',
        text: 'Na lista, use Atuais, Todos ou Histórico e o campo Buscar aviso por nome. Clique no aviso desejado para abrir seu conteúdo completo.',
      },
      {
        title: 'Entre em uma missão',
        text: 'Abra uma missão e confira patente, data e horário. Com um personagem elegível selecionado, clique em Participar. Se o botão estiver desativado, leia a condição mostrada no próprio aviso.',
      },
      {
        title: 'Publique uma missão',
        text: 'Abra a placa Missões e clique em Registrar missão. Preencha o formulário apresentado e revise os dados antes de publicar. O aviso passa a aparecer no mural.',
      },
      {
        title: 'Organize seus próprios avisos',
        text: 'Arraste um aviso seu para outra posição no mural ou selecione-o e use as setas do teclado. Aguarde o fim da mensagem Salvando posição antes de sair.',
      },
    ],
  },
  missions: {
    title: 'Como consultar Missões',
    description: 'Encontre uma missão e acompanhe sua participação.',
    steps: [
      {
        title: 'Abra a lista de missões',
        text: 'Clique na placa Missões do mural. Use Atuais para os avisos vigentes, Todos para a lista completa ou Histórico para consultar os registros anteriores.',
      },
      {
        title: 'Busque e abra um aviso',
        text: 'Digite o nome em Buscar aviso por nome e clique no resultado. Leia a data, o horário, a patente e a proposta antes de se inscrever.',
      },
      {
        title: 'Confirme a participação',
        text: 'Selecione o aventureiro que vai jogar e clique em Participar no aviso. A ação fica indisponível se ele já estiver inscrito ou não cumprir os requisitos apresentados.',
      },
      {
        title: 'Consulte o resultado',
        text: 'Depois da conclusão registrada pelo mestre, abra o mesmo aviso pelo Histórico. O Resumo da missão e as recompensas aparecem no registro da publicação.',
      },
    ],
  },
  hooks: {
    title: 'Como usar os Ganchos',
    description: 'Leia continuações de histórias e registre um novo gancho.',
    steps: [
      {
        title: 'Encontre um gancho',
        text: 'Clique na placa Ganchos e use Buscar aviso por nome para filtrar a lista. Abra um aviso para ler a situação proposta.',
      },
      {
        title: 'Consulte a missão de origem',
        text: 'No registro, procure o vínculo com a missão que deu origem ao gancho. Leia esse contexto antes de combinar uma continuação com o mestre.',
      },
      {
        title: 'Registre uma continuação',
        text: 'Na lista de Ganchos, clique em Registrar gancho. Escolha a Missão de origem do gancho e preencha a proposta. Se não houver uma missão elegível, esse botão ficará desativado.',
      },
      {
        title: 'Volte aos avisos anteriores',
        text: 'Use os filtros Todos e Histórico para reencontrar registros. Fechar lista de avisos retorna à visão do mural.',
      },
    ],
  },
  shop: {
    title: 'Como comprar no Empório',
    description: 'Escolha o modelo, monte o carrinho e finalize a compra.',
    steps: [
      {
        title: 'Encontre o item',
        text: 'Clique em uma categoria de Prateleiras ou digite em Procurar item. Clique na arte ou no botão de informações para consultar o que o produto faz.',
      },
      {
        title: 'Escolha o modelo e adicione',
        text: 'Quando houver seletores de modelo, tipo ou cor, escolha a variante desejada. Clique em Comprar para adicioná-la ao carrinho; esse clique ainda não encerra a compra.',
      },
      {
        title: 'Revise o carrinho',
        text: 'Clique no ícone de carrinho ao lado da busca. Ajuste Quantidade, retire o que não quer e confira o total. Produtos de animais podem exigir a escolha do Destino.',
      },
      {
        title: 'Pague e equipe',
        text: 'Confira o personagem selecionado e clique em Finalizar compra. Os equipamentos comprados para ele ficam na mochila. Abra Menu → Personagem → Inventário para equipá-los.',
      },
    ],
  },
  reliquias: {
    title: 'Como usar Relíquias',
    description: 'Compre com Prestígio e aplique as peças da coleção.',
    steps: [
      {
        title: 'Escolha a prateleira',
        text: 'Selecione a categoria de relíquias e clique na arte de uma oferta para ampliar e consultar os detalhes. Armas mostram os requisitos de uso e os estágios de evolução.',
      },
      {
        title: 'Confirme a compra',
        text: 'Clique em Comprar na oferta. Confira o custo em Prestígio e o personagem destinatário quando houver; depois clique em Confirmar compra. Para montarias, preencha também o nome solicitado.',
      },
      {
        title: 'Abra o que já comprou',
        text: 'Clique na sacola ao lado do saldo para abrir Minha coleção. Selecione a borda ou skin e use a opção de aplicação ao personagem ou item indicado.',
      },
      {
        title: 'Confira o ganho por aposentadoria',
        text: 'Abra Tabela de Prestígio para consultar os valores por nível. A aposentadoria em si é feita em Personagens, pelo botão Aposentar do aventureiro elegível.',
      },
    ],
  },
  cristais: {
    title: 'Loja de Cristais em breve',
    description: 'Esta loja está bloqueada nesta etapa.',
    steps: [
      {
        title: 'Volte à loja disponível',
        text: 'Se a tela mostrar Loja de Cristais em breve, clique em Voltar. O botão abre o Empório, onde é possível comprar equipamentos com ouro.',
      },
      {
        title: 'Abra as outras lojas pelo Menu',
        text: 'Use Menu → Loja → Relíquias para consultar as compras com Prestígio. A Loja de Cristais não permite compras enquanto estiver bloqueada.',
      },
    ],
  },
  tower: {
    title: 'Torre em breve',
    description: 'As expedições estão bloqueadas nesta etapa.',
    steps: [
      {
        title: 'Saia da tela de espera',
        text: 'Na tela Torre em breve, clique em Voltar para abrir o Mural. Não é possível iniciar uma expedição enquanto esta área estiver bloqueada.',
      },
      {
        title: 'Encontre uma aventura disponível',
        text: 'No Mural, clique na placa Missões, abra um aviso e confira os requisitos. Use Participar com um personagem elegível para se inscrever.',
      },
    ],
  },
  stable: {
    title: 'Como comprar uma montaria',
    description: 'Escolha a montaria, a pelagem e o nome antes de confirmar.',
    steps: [
      {
        title: 'Escolha o animal e a pelagem',
        text: 'Use os seletores do Estábulo para escolher a montaria e clique em uma opção de Pelagem. A prévia muda para mostrar a combinação selecionada.',
      },
      {
        title: 'Dê um nome e confira o total',
        text: 'Preencha Dê um nome à sua montaria. Confira o personagem selecionado, o preço total e o saldo; sem nome ou saldo suficiente, a compra ficará indisponível.',
      },
      {
        title: 'Confirme a aquisição',
        text: 'Clique em Comprar montaria. Na janela seguinte, confira o nome, o animal, a pelagem e o custo; depois clique em Confirmar compra.',
      },
      {
        title: 'Mostre a montaria no acampamento',
        text: 'Abra Menu → Personagem → Inventário e encontre sua coleção de montarias. Escolha a que deseja mostrar no acampamento; os equipamentos compatíveis também são organizados pelo Inventário.',
      },
    ],
  },
  pets: {
    title: 'Como comprar um mascote',
    description: 'Escolha o companheiro e vincule-o ao personagem certo.',
    steps: [
      {
        title: 'Selecione a espécie e a aparência',
        text: 'Clique em um animal na lista Mascotes à venda. Se houver opções de Aparência, escolha a desejada e confira a mudança na prévia e a descrição do auxílio.',
      },
      {
        title: 'Escreva o nome',
        text: 'Preencha Nome do mascote. Confira qual personagem está selecionado e compare o preço mostrado com os PO disponíveis.',
      },
      {
        title: 'Compre o companheiro',
        text: 'Clique em Levar este companheiro. Aguarde a confirmação da compra; o mascote passa a pertencer ao personagem selecionado.',
      },
      {
        title: 'Escolha quem aparece com você',
        text: 'Clique em Ver meus mascotes no inventário. Na coleção, use Mostrar no acampamento no mascote desejado para exibi-lo junto ao personagem.',
      },
    ],
  },
  events: {
    title: 'Como consultar Eventos',
    description: 'Confira o estado da área antes de procurar um encontro.',
    steps: [
      {
        title: 'Confira se a área está disponível',
        text: 'Se aparecer Eventos em manutenção, clique em Voltar ao mural. Essa tela de manutenção não possui inscrição em eventos.',
      },
      {
        title: 'Procure avisos no mural',
        text: 'No Mural, clique na placa Eventos quando ela estiver habilitada e abra o aviso desejado. Confira a data, o horário e a descrição; use as missões vinculadas para consultar a participação.',
      },
    ],
  },
  titles: {
    title: 'Como exibir um título',
    description: 'Mostre uma honraria recebida junto ao nome do personagem.',
    steps: [
      {
        title: 'Encontre a seção de títulos',
        text: 'Abra Conquistas e role até Títulos do personagem. As honrarias bloqueadas mostram o requisito e, quando disponível, o progresso para conquistá-las.',
      },
      {
        title: 'Escolha uma honraria recebida',
        text: 'Clique em Exibir título no título liberado que deseja usar. Ele passa a aparecer na apresentação do personagem.',
      },
      {
        title: 'Mude a posição ou oculte',
        text: 'Em Posição do título, escolha Abaixo do nome ou Ao lado do nome. Para retirar a exibição, clique em Em exibição · ocultar na honraria selecionada.',
      },
    ],
  },
  cards: {
    title: 'Como usar o Salão das cartas',
    description: 'Abra o acervo, compre cartas e ocupe os três espaços da mesa.',
    steps: [
      {
        title: 'Abra o catálogo',
        text: 'Clique no baralho com a indicação Acervo, sobre a mesa. Escolha uma carta do acervo do Anfitrião para abrir a arte e os detalhes.',
      },
      {
        title: 'Compre uma carta',
        text: 'Nos detalhes, selecione o nível desejado quando essa opção aparecer. Confira o preço e o personagem selecionado; clique em Comprar carta para incluí-la na coleção.',
      },
      {
        title: 'Ocupe um espaço da mesa',
        text: 'Feche o catálogo e clique em Escolher carta em um dos três espaços da mesa. Na coleção, selecione a carta que quer usar naquele lugar.',
      },
      {
        title: 'Troque ou retire uma carta',
        text: 'Abra uma carta da coleção, escolha o número em Espaço para equipar e clique em Equipar no espaço correspondente. Esvaziar espaço retira a carta da mesa sem apagá-la da coleção.',
      },
    ],
  },
  'character-cards': {
    title: 'Como usar sua coleção de cartas',
    description: 'Encontre uma carta e escolha os espaços que acompanham o personagem.',
    steps: [
      {
        title: 'Filtre a coleção',
        text: 'Digite um nome ou uma família em Buscar na coleção. A lista mostra as cartas adquiridas pelo personagem selecionado.',
      },
      {
        title: 'Leia uma carta',
        text: 'Clique na carta da lista. O registro mostra sua arte, nível, história e comentário do Anfitrião.',
      },
      {
        title: 'Equipe em um dos três espaços',
        text: 'No registro da carta, clique em Equipar no espaço 1, 2 ou 3. Se aquele espaço já estiver ocupado, a carta escolhida substitui a anterior.',
      },
      {
        title: 'Retire de um espaço',
        text: 'Na área Três cartas selecionadas, use o botão de retirar da carta desejada. Ela continua no acervo e pode ser equipada de novo; as escolhas também aparecem no Salão das cartas.',
      },
    ],
  },
  vtt: {
    title: 'Como entrar e jogar no VTT',
    description: 'Configure a exibição, entre em uma mesa e identifique seus controles.',
    steps: [
      {
        title: 'Configure a exibição',
        text: 'Se a tela de efeitos aparecer, escolha quais quer exibir e clique em Entrar no VTT. Você pode rever essas preferências nas configurações da mesa.',
      },
      {
        title: 'Entre pelo convite',
        text: 'Em Entrar em uma mesa, cole o Link ou código de convite enviado pelo mestre. Marque Jogador para participar ou Espectador para assistir e clique em Entrar na mesa.',
      },
      {
        title: 'Abra sua mesa como mestre',
        text: 'Para preparar uma sessão sua, use Abrir minha mesa no quadro Minha mesa. Entrar como jogador em outra sala não torna você mestre dela.',
      },
      {
        title: 'Coloque e selecione o personagem',
        text: 'Dentro da sessão, abra Fichas para acessar os personagens disponíveis conforme sua permissão. Clique no seu token no mapa para selecioná-lo e usar os controles permitidos.',
      },
      {
        title: 'Use as ações durante a sessão',
        text: 'Com o token selecionado, consulte a ficha e a barra de ações para ataques e recursos. Confira o alvo antes de aplicar dano. Espectadores não podem mover tokens nem usar ações de jogo.',
      },
    ],
  },
  hall: {
    title: 'Como usar o Hall da Fama',
    description: 'Troque o ranking e visite a apresentação de um aventureiro.',
    steps: [
      {
        title: 'Escolha o ranking',
        text: 'Clique em Menu do Hall da Fama. Selecione Geral, Conquistas, Prestígio, Aventureiros, Melhores perfis ou Honrarias para mudar o critério da classificação.',
      },
      {
        title: 'Encontre um personagem',
        text: 'Digite o nome do personagem, do jogador ou da classe em Buscar personagem no Hall da Fama. Use a paginação para consultar os demais resultados.',
      },
      {
        title: 'Visite o perfil',
        text: 'Clique no personagem ou na entrada do ranking. O perfil público abre com a apresentação e os personagens que a pessoa escolheu expor.',
      },
      {
        title: 'Entenda a classificação',
        text: 'Abra Como a pontuação é calculada abaixo do ranking. A explicação mostra os critérios usados para aquela classificação.',
      },
    ],
  },
  profiles: {
    title: 'Como usar Perfis',
    description: 'Encontre uma pessoa, visite seu acampamento e converse com amigos.',
    steps: [
      {
        title: 'Procure um jogador',
        text: 'Em Nome do jogador ou ID do perfil, digite quem procura. Clique em Visitar perfil no resultado; Carregar mais perfis mostra outras pessoas da lista.',
      },
      {
        title: 'Consulte um personagem exposto',
        text: 'No acampamento do perfil, clique na imagem de um personagem para selecionar sua apresentação. As informações exibidas são públicas; mochila, ouro e e-mail não ficam disponíveis na visita.',
      },
      {
        title: 'Envie ou aceite uma amizade',
        text: 'Use a ação de amizade no perfil. Em Amigos e mensagens, confira Pedidos recebidos e use Aceitar para liberar a amizade.',
      },
      {
        title: 'Abra uma conversa',
        text: 'Depois de a amizade ser aceita, abra Amigos e mensagens e clique em Conversar com a pessoa. Escreva em Mensagem privada e use o botão de envio.',
      },
    ],
  },
  house: {
    title: 'Como usar o Lobby de RP',
    description: 'Abra uma casa acessível e use o painel de interpretação.',
    steps: [
      {
        title: 'Escolha uma casa',
        text: 'Abra o botão House, que tem o rótulo Menu da House. Em Escolher casa, selecione uma casa sua ou um convite aceito. Se a opção estiver disponível para seu personagem, Criar minha casa cria o espaço inicial.',
      },
      {
        title: 'Explore o cenário',
        text: 'Arraste a cena para os lados para ver o ambiente. Abra o menu House novamente para acessar as ferramentas e a seleção dos cômodos disponíveis.',
      },
      {
        title: 'Converse no painel RP',
        text: 'No menu da casa, clique em RP. Com um personagem selecionado, escreva em Escreva sua mensagem de RP e clique na seta Enviar.',
      },
      {
        title: 'Salve as mudanças da sua casa',
        text: 'Se você for o dono, use Decorar para organizar as peças e depois clique em Salvar mudanças. Convidados respeitam as permissões da casa; o botão Descartar abandona ajustes ainda não salvos.',
      },
    ],
  },
  house2: {
    title: 'Como usar a House',
    description: 'Escolha um terreno, construa e organize sua casa.',
    steps: [
      {
        title: 'Entre em uma vizinhança',
        text: 'Digite em Pesquisar vizinhanças se quiser filtrar a lista e clique no cartão da vizinhança. No mapa, arraste para explorar e use Aproximar mapa ou Afastar mapa.',
      },
      {
        title: 'Compre um terreno',
        text: 'Clique em um Terreno disponível e abra Terrenos nos controles da vizinhança. Confira o custo em Créditos do Bastião e clique em Comprar terreno; revise a confirmação antes de concluir.',
      },
      {
        title: 'Escolha a casa e a mobília',
        text: 'Com seu terreno selecionado, abra Casas vazias para escolher a construção. Mobília abre a loja de objetos; Minha coleção reúne as peças que você já comprou.',
      },
      {
        title: 'Posicione e salve',
        text: 'Em Minha coleção, escolha uma peça para colocar no terreno. Arraste-a e use os controles de rotação e tamanho para ajustar. Clique em Salvar para guardar a disposição; Descartar abandona o rascunho.',
      },
      {
        title: 'Plante na horta',
        text: 'Com seu terreno e uma casa construída selecionados, abra Horta. Use Posicionar canteiro no terreno, escolha Plantar na semente desejada e clique em Regar para iniciar o tempo de crescimento.',
      },
      {
        title: 'Colha quando estiver pronto',
        text: 'Volte a Horta para ver o tempo restante. Quando a planta estiver pronta, use Colher e vender ou, nas plantas compatíveis, Colher e preparar Poção de Cura.',
      },
    ],
  },
  guild: {
    title: 'Como usar a Guilda',
    description: 'Encontre sua companhia e aprenda a usar a sede.',
    steps: [
      {
        title: 'Encontre ou abra sua guilda',
        text: 'Digite em Procurar guildas e clique em uma entrada para visitar. Se já participar de uma companhia, Minha guilda abre sua sede. Convites recebidos podem ser aceitos na área de convites.',
      },
      {
        title: 'Funde uma companhia',
        text: 'Se estiver elegível, clique em Fundar uma guilda. Preencha Nome da guilda, escolha o Personagem fundador, configure a apresentação e confira o custo em CB antes de clicar em Fundar guilda.',
      },
      {
        title: 'Abra as funções da sede',
        text: 'Clique em Menu da sede. Companhia mostra os membros; Missões e tesouro abre os registros e contribuições; Salas da sede permite consultar as instalações.',
      },
      {
        title: 'Contribua para uma instalação',
        text: 'Abra a instalação e confira Próxima evolução. Na Ferraria, expanda Ouro da Ferraria, informe a contribuição e use Contribuir para a guilda. A Ferramenta de Expedição mostra as tags de monstros exigidas.',
      },
      {
        title: 'Autorize uma evolução',
        text: 'O fundador deve abrir a instalação, conferir os requisitos e usar Evoluir para o nível indicado quando o botão estiver habilitado. Os membros podem consultar o progresso sem autorizar a evolução.',
      },
    ],
  },
  world: {
    title: 'Como usar o Mundo',
    description: 'Abra o reino, consulte um lugar e encontre as missões ligadas a ele.',
    steps: [
      {
        title: 'Entre no reino',
        text: 'Clique no Reino do Norte no mapa do mundo. Dentro do reino, arraste a imagem para explorar a área. Voltar ao mundo retorna ao mapa geral.',
      },
      {
        title: 'Abra um ponto do mapa',
        text: 'Clique em um marcador de local. O painel lateral mostra o nome e a descrição; Fechar lista de missões recolhe o painel e deixa o mapa livre.',
      },
      {
        title: 'Consulte missões ou história',
        text: 'No painel do local, clique em Missões para ver os avisos ligados àquele lugar ou em História para ler seus registros. Abra um aviso para consultar a aventura.',
      },
      {
        title: 'Publique no local escolhido',
        text: 'Para anunciar uma aventura ali, clique em Registrar missão aqui. O formulário já recebe o local selecionado; complete e revise a missão antes de publicar.',
      },
    ],
  },
  lore: {
    title: 'Como consultar a Lore',
    description: 'Navegue por região e pasta ou procure uma crônica pelo nome.',
    steps: [
      {
        title: 'Abra o sumário',
        text: 'Clique em Abrir sumário se a lista estiver recolhida. Escolha a Região e depois uma pasta; Todas as crônicas volta à lista de registros daquela região.',
      },
      {
        title: 'Procure uma crônica',
        text: 'Digite um termo em Buscar no arquivo. Para retirar o filtro, use o X com o rótulo Limpar busca de crônicas.',
      },
      {
        title: 'Abra e leia o registro',
        text: 'Clique no título de uma crônica na lista. O texto e as imagens aparecem na área de leitura; a trilha acima do título indica a pasta a que ela pertence.',
      },
      {
        title: 'Volte à lista',
        text: 'Clique em Voltar ao arquivo para escolher outra crônica. Use o sumário para mudar de pasta ou região.',
      },
    ],
  },
  rules: {
    title: 'Como consultar as Regras',
    description: 'Abra capítulos e artigos ou encontre um termo no códice.',
    steps: [
      {
        title: 'Escolha um capítulo',
        text: 'No Índice do códice, clique no nome do capítulo para expandir seus artigos. Clique no título de um artigo para abri-lo na área de leitura.',
      },
      {
        title: 'Busque uma regra',
        text: 'Digite o assunto em Buscar no livro. Abra o resultado correspondente para ler a regra no contexto do artigo.',
      },
      {
        title: 'Leia tabelas no celular',
        text: 'Quando uma tabela for mais larga que a tela, deslize a própria tabela para os lados para ver as outras colunas. Role a área de leitura para continuar o artigo.',
      },
      {
        title: 'Limpe o filtro para continuar',
        text: 'Use o X com o rótulo Limpar busca para voltar ao índice completo. Expanda outro capítulo e escolha o próximo artigo.',
      },
    ],
  },
} satisfies Record<Page, Tutorial>;
