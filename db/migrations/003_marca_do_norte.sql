-- Atualiza apenas o conteúdo inicial conhecido. Preserva alterações de jogadores, IDs de missões, inscrições e status.
UPDATE world_entries SET
  id = CASE WHEN id = 'vale-cinzento' THEN 'terras-do-norte' ELSE id END,
  title = CASE WHEN title = 'O Vale Cinzento' THEN 'As Terras do Norte' ELSE title END,
  subtitle = CASE WHEN subtitle = 'Uma fronteira entre o conhecido e o impossível.' THEN 'Além dos últimos mapas, começa a nossa história.' ELSE subtitle END,
  body = CASE WHEN body = 'Ao norte das Montanhas de Vidro, pequenas vilas sobrevivem entre antigas estradas élficas. O Vale Cinzento é o cenário original desta guilda. A névoa chega ao anoitecer; o que vem com ela muda a cada estação.' THEN 'Cumes de gelo, fortalezas de pedra e caminhos riscados pelo vento. Entre a Cordilheira de Ferro e o Mar Pálido, a Marca do Norte protege os viajantes que ousam cruzar esta fronteira. Aqui, uma promessa vale mais que uma coroa.' ELSE body END,
  tag = CASE WHEN tag = 'Região' THEN 'Fronteira' ELSE tag END
WHERE id = 'vale-cinzento';

UPDATE world_entries SET
  id = CASE WHEN id = 'porto-aurora' THEN 'vigilia' ELSE id END,
  title = CASE WHEN title = 'Porto Aurora' THEN 'Vigília' ELSE title END,
  subtitle = CASE WHEN subtitle = 'Todo caminho começa em uma boa taverna.' THEN 'Uma cidade de pedra. Mil histórias por contar.' ELSE subtitle END,
  body = CASE WHEN body = 'Uma cidade mercante nas margens do Rio Âmbar. A Casa das Lanternas abriga o mural da guilda, um mercado movimentado e viajantes de todos os reinos. É o ponto de partida das aventuras de demonstração.' THEN 'Erguida sob as muralhas do Bastião da Marca, Vigília é o último porto seguro antes dos passos gelados. Ferreiros, cartógrafos e viajantes dividem suas ruas. É aqui que a guilda Marca do Norte reúne seus aventureiros.' ELSE body END
WHERE id = 'porto-aurora';

UPDATE world_entries SET
  title = CASE WHEN title = 'Bosque dos Sussurros' THEN 'Pinhal dos Ecos' ELSE title END
WHERE id = 'bosque';

UPDATE world_entries SET
  title = CASE WHEN title = 'A primeira lanterna' THEN 'A primeira marca' ELSE title END,
  subtitle = CASE WHEN subtitle = 'Crônicas da guilda · Capítulo I' THEN 'Crônicas da Marca · Capítulo I' ELSE subtitle END,
  body = CASE WHEN body = 'Dizem que a guilda nasceu quando sete viajantes acenderam uma lanterna em uma estrada sem fim. Ao redor daquela luz, desconhecidos dividiram histórias, pão e a promessa de que ninguém precisaria caminhar sozinho. Hoje, cada novo membro recebe a mesma promessa.' THEN 'Quando a nevasca apagou todas as trilhas, sete viajantes gravaram uma rosa dos ventos na pedra. Ao redor dela fizeram um juramento: nenhum companheiro ficaria para trás. Dessa promessa nasceu a Marca do Norte. O brasão ainda aponta para o mesmo destino: seguir juntos.' ELSE body END
WHERE id = 'fundacao';

UPDATE world_entries SET
  title = CASE WHEN title = 'O pacto dos caminhos' THEN 'O juramento do norte' ELSE title END,
  subtitle = CASE WHEN subtitle = 'Crônicas da guilda · Capítulo II' THEN 'Crônicas da Marca · Capítulo II' ELSE subtitle END,
  body = CASE WHEN body = 'Respeite a palavra dada. Divida os perigos antes de dividir o ouro. Deixe um sinal para quem vier depois. Esses são os três votos gravados na entrada da Casa das Lanternas.' THEN 'Honre a palavra. Partilhe o abrigo. Deixe uma marca para quem vier depois. Estes votos estão talhados nos portões do Bastião. Não importa de onde um aventureiro vem; ao cruzar esses portões, ele passa a fazer parte da Marca do Norte.' ELSE body END
WHERE id = 'pacto';

UPDATE world_entries SET
  id = CASE WHEN id = 'casa' THEN 'bastiao' ELSE id END,
  title = CASE WHEN title = 'Casa das Lanternas' THEN 'Bastião da Marca' ELSE title END,
  subtitle = CASE WHEN subtitle = 'O refúgio da guilda em Porto Aurora.' THEN 'Pedra contra o inverno. Abrigo para os nossos.' ELSE subtitle END,
  body = CASE WHEN body = 'Por enquanto, a Casa das Lanternas é o ponto de encontro narrativo dos aventureiros: uma mesa grande, uma lareira acesa e um lugar para planejar a próxima expedição. Casas particulares, baús compartilhados e melhorias entram em uma próxima etapa.' THEN 'Acima de Vigília, o Bastião da Marca guarda a sede da guilda Marca do Norte. Estandartes de azul profundo e cobre marcam suas torres. Entre a sala dos mapas e a grande lareira, aventureiros planejam a próxima expedição. Casas particulares, baús compartilhados e melhorias serão implementados em uma próxima etapa.' ELSE body END,
  tag = CASE WHEN tag = 'Refúgio inicial' THEN 'Sede da guilda' ELSE tag END
WHERE id = 'casa';

UPDATE world_entries SET
  body = CASE WHEN body = 'Uma batedora experiente nas trilhas do Vale Cinzento. Conhece as rotas de caravanas e os sinais deixados pelos animais da névoa. Personagem de demonstração; contratação e regras de companheiros serão implementadas depois.' THEN 'Uma batedora experiente nas trilhas do Terras do Norte. Conhece as rotas de caravanas e os sinais deixados pelos animais da névoa. Personagem de demonstração; contratação e regras de companheiros serão implementadas depois.' ELSE body END
WHERE id = 'mira';

UPDATE world_entries SET
  body = CASE WHEN body = 'Veterano da guarda de Porto Aurora. Valoriza contratos claros e companheiros que não fogem ao primeiro rugido. Personagem de demonstração; contratação e regras de companheiros serão implementadas depois.' THEN 'Veterano da guarda de Vigília. Valoriza contratos claros e companheiros que não fogem ao primeiro rugido. Personagem de demonstração; contratação e regras de companheiros serão implementadas depois.' ELSE body END
WHERE id = 'borin';

UPDATE board_posts SET
  title = CASE WHEN title = 'Ecos no Bosque dos Sussurros' THEN 'Ecos no Passo da Geada' ELSE title END,
  description = CASE WHEN description = 'As lanternas da antiga trilha se apagaram. A cartógrafa Elara procura aventureiros para investigar o observatório e trazer notícias de sua expedição. Uma boa primeira jornada para um grupo de nível 1.' THEN 'O sino da torre de vigia silenciou. A cartógrafa Elara procura aventureiros para subir o passo, investigar o observatório e encontrar a expedição desaparecida. Uma primeira jornada para um grupo de nível 1.' ELSE description END,
  location = CASE WHEN location = 'Bosque dos Sussurros' THEN 'Passo da Geada' ELSE location END
WHERE id = '11111111-1111-4111-8111-111111111111' AND author_id IS NULL;

UPDATE board_posts SET
  title = CASE WHEN title = 'A última caravana' THEN 'A caravana do desfiladeiro' ELSE title END,
  description = CASE WHEN description = 'Uma caravana de suprimentos não chegou a Porto Aurora. Encontre o carregamento na Estrada do Âmbar e descubra o que assustou os cavalos. Procure o mercador Tomas na ponte velha.' THEN 'Suprimentos para o inverno não chegaram a Vigília. Siga os marcos de pedra pela Estrada do Ferro, encontre a caravana e descubra o que assustou os cavalos. O mercador Tomas aguarda no portão sul.' ELSE description END,
  location = CASE WHEN location = 'Estrada do Âmbar' THEN 'Estrada do Ferro' ELSE location END
WHERE id = '22222222-2222-4222-8222-222222222222' AND author_id IS NULL;

UPDATE board_posts SET
  title = CASE WHEN title = 'Noite das mil lanternas' THEN 'Vigília do primeiro inverno' ELSE title END,
  description = CASE WHEN description = 'A cidade se prepara para celebrar os viajantes que voltaram para casa. Traga uma história para a fogueira da guilda. Um evento narrativo de demonstração, sem data agendada.' THEN 'O Bastião abre seus portões para celebrar os viajantes que retornaram. Traga uma história para a grande lareira e grave sua marca na mesa da guilda. Evento narrativo de demonstração, sem data agendada.' ELSE description END,
  location = CASE WHEN location = 'Porto Aurora' THEN 'Bastião da Marca' ELSE location END
WHERE id = '33333333-3333-4333-8333-333333333333' AND author_id IS NULL;

UPDATE board_posts SET
  title = CASE WHEN title = 'Uma carta sem remetente' THEN 'O norte que a bússola esqueceu' ELSE title END,
  description = CASE WHEN description = 'Uma carta lacrada apareceu sob a porta da guilda. Dentro, apenas um mapa incompleto e a frase: “A sétima lanterna nunca se apagou”. Quem vai seguir essa pista?' THEN 'Uma bússola antiga chegou ao Bastião envolta em um mapa rasgado. Sua agulha aponta para uma montanha que nenhum cartógrafo conhece. No verso, uma inscrição: “Nem todo norte está nos mapas”.' ELSE description END,
  location = CASE WHEN location = 'Casa das Lanternas' THEN 'Bastião da Marca' ELSE location END
WHERE id = '44444444-4444-4444-8444-444444444444' AND author_id IS NULL;

