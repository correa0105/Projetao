-- Rename only exact known seed values. Player-authored changes, accounts and game state are preserved.

UPDATE world_entries SET
  id = CASE WHEN id = 'terras-do-norte' THEN 'dominios-da-alvorada' ELSE id END,
  title = CASE WHEN title = 'As Terras do Norte' THEN 'Os Domínios da Alvorada' ELSE title END,
  body = CASE WHEN body = 'Cumes de gelo, fortalezas de pedra e caminhos riscados pelo vento. Entre a Cordilheira de Ferro e o Mar Pálido, a Marca do Norte protege os viajantes que ousam cruzar esta fronteira. Aqui, uma promessa vale mais que uma coroa.' THEN 'Cumes de gelo, fortalezas de pedra e caminhos riscados pelo vento. Entre a Cordilheira de Ferro e o Mar Pálido, a Alvorada Cinzenta protege os viajantes que ousam cruzar esta fronteira. Aqui, uma promessa vale mais que uma coroa.' ELSE body END
WHERE id = 'terras-do-norte';

UPDATE world_entries SET
  body = CASE WHEN body = 'Erguida sob as muralhas do Bastião da Marca, Vigília é o último porto seguro antes dos passos gelados. Ferreiros, cartógrafos e viajantes dividem suas ruas. É aqui que a guilda Marca do Norte reúne seus aventureiros.' THEN 'Erguida sob as muralhas do Bastião da Alvorada, Vigília é o último porto seguro antes dos passos gelados. Ferreiros, cartógrafos e viajantes dividem suas ruas. É aqui que a guilda Alvorada Cinzenta reúne seus aventureiros.' ELSE body END
WHERE id = 'vigilia';

UPDATE world_entries SET
  title = CASE WHEN title = 'A primeira marca' THEN 'A primeira alvorada' ELSE title END,
  subtitle = CASE WHEN subtitle = 'Crônicas da Marca · Capítulo I' THEN 'Crônicas da Alvorada · Capítulo I' ELSE subtitle END,
  body = CASE WHEN body = 'Quando a nevasca apagou todas as trilhas, sete viajantes gravaram uma rosa dos ventos na pedra. Ao redor dela fizeram um juramento: nenhum companheiro ficaria para trás. Dessa promessa nasceu a Marca do Norte. O brasão ainda aponta para o mesmo destino: seguir juntos.' THEN 'Quando a nevasca apagou todas as trilhas, sete viajantes gravaram uma rosa dos ventos na pedra. Ao redor dela fizeram um juramento: nenhum companheiro ficaria para trás. Dessa promessa nasceu a Alvorada Cinzenta. O brasão ainda aponta para o mesmo destino: seguir juntos.' ELSE body END
WHERE id = 'fundacao';

UPDATE world_entries SET
  title = CASE WHEN title = 'O juramento do norte' THEN 'O juramento da alvorada' ELSE title END,
  subtitle = CASE WHEN subtitle = 'Crônicas da Marca · Capítulo II' THEN 'Crônicas da Alvorada · Capítulo II' ELSE subtitle END,
  body = CASE WHEN body = 'Honre a palavra. Partilhe o abrigo. Deixe uma marca para quem vier depois. Estes votos estão talhados nos portões do Bastião. Não importa de onde um aventureiro vem; ao cruzar esses portões, ele passa a fazer parte da Marca do Norte.' THEN 'Honre a palavra. Partilhe o abrigo. Deixe uma marca para quem vier depois. Estes votos estão talhados nos portões do Bastião. Não importa de onde um aventureiro vem; ao cruzar esses portões, ele passa a fazer parte da Alvorada Cinzenta.' ELSE body END
WHERE id = 'pacto';

UPDATE world_entries SET
  title = CASE WHEN title = 'Bastião da Marca' THEN 'Bastião da Alvorada' ELSE title END,
  body = CASE WHEN body = 'Acima de Vigília, o Bastião da Marca guarda a sede da guilda Marca do Norte. Estandartes de azul profundo e cobre marcam suas torres. Entre a sala dos mapas e a grande lareira, aventureiros planejam a próxima expedição. Casas particulares, baús compartilhados e melhorias serão implementados em uma próxima etapa.' THEN 'Acima de Vigília, o Bastião da Alvorada guarda a sede da guilda Alvorada Cinzenta. Estandartes de azul profundo e cobre marcam suas torres. Entre a sala dos mapas e a grande lareira, aventureiros planejam a próxima expedição. Casas particulares, baús compartilhados e melhorias serão implementados em uma próxima etapa.' ELSE body END
WHERE id = 'bastiao';

UPDATE world_entries SET
  body = CASE WHEN body = 'Uma batedora experiente nas trilhas do Terras do Norte. Conhece as rotas de caravanas e os sinais deixados pelos animais da névoa. Personagem de demonstração; contratação e regras de companheiros serão implementadas depois.' THEN 'Uma batedora experiente nas trilhas dos Domínios da Alvorada. Conhece as rotas de caravanas e os sinais deixados pelos animais da névoa. Personagem de demonstração; contratação e regras de companheiros serão implementadas depois.' ELSE body END
WHERE id = 'mira';

UPDATE board_posts SET
  location = CASE WHEN location = 'Bastião da Marca' THEN 'Bastião da Alvorada' ELSE location END
WHERE id = '33333333-3333-4333-8333-333333333333';

UPDATE board_posts SET
  location = CASE WHEN location = 'Bastião da Marca' THEN 'Bastião da Alvorada' ELSE location END
WHERE id = '44444444-4444-4444-8444-444444444444';
