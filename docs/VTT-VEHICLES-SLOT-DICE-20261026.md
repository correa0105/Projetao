# Veículos comprados no VTT e atributos por slot — 26/10/2026

Pedido: os veículos da loja devem poder ser puxados pelo mestre para o VTT, com vista superior, proporções próprias e cobertura transparente sobre personagens. Rolar atributos antes da aparência/Vestir, conservando resultados e progresso no slot quando o personagem for excluído antes do nível 4.

## Uso

Comprar no Empório deposita o veículo no inventário do personagem, usando a compra transacional existente. No VTT, abrir **Fichas → Veículos**, junto de Personagens, Montarias e Mascotes. O mestre vê os veículos de seus personagens e dos jogadores participantes da mesa; clique coloca ou seleciona, arraste escolhe a posição. Atualizar compras consulta novamente os inventários. Várias unidades oferecem Exemplar; puxar a mesma unidade novamente seleciona/reposiciona a existente. Não consome nem concede itens.

A aba de equipamentos da ficha também mostra os veículos adquiridos, sua vista superior e o caminho para o mestre. Inventários de outras mesas e de espectadores não são expostos. Jogadores/espectadores não importam veículos; permissões verificadas no servidor, independente de administrador global.

Veículos entram na camada Mapa como cenário, sem sangue ou ficha de criatura. O mestre pode girar, dimensionar e usar os vínculos existentes para transportar tokens. Base/deck fica abaixo dos personagens; velas, mastros, teto da carruagem e balão ficam na frente. A cobertura inteira reduz para 12% de opacidade quando um personagem visível toca pixels opacos dela, respeitando rotação, espelhamento e névoa/visão. O piso conserva a opacidade original. Sair de baixo restaura a cobertura. Nenhum efeito mecânico de viagem, tripulação ou dano foi inventado.

## Arte e escala

São 12 PNGs originais transparentes, gerados pela ferramenta embutida `image_gen`: carruagem, carroça pequena, biga, trenó, carroça, dirigível, galé, barco de quilha, drácar, barco a remo, navio à vela e navio de guerra. Originais preservados sem conversão, redimensionamento ou compressão. Salvos em `public/vtt/vehicles-20261026/<id>-v1.png`; fontes locais, prompts finais completos, edições de alfa e SHA-256 em `data/vtt/vehicles-20261026.json`. Os recortes e o registro das camadas são aplicados apenas pelo Canvas, a partir de `shared/vtt-vehicle-art.json`.

Comprimentos visuais em pés: trenó/barco a remo 10; carroça pequena/biga 12; carruagem 15; carroça 16; barco de quilha 60; drácar 70; dirigível 80; navios à vela/de guerra 100; galé 130. Larguras incluem remos/velas/balão quando presentes; o casco pode ser mais estreito. A conversão usa tamanho/escala/unidade da grade, inclusive metros. Limites de 8–8000 px conservam a razão entre largura e comprimento.

Dimensões dos cascos marítimos foram conferidas nas fontes primárias [galé](https://www.dndbeyond.com/vehicles/galley), [barco de quilha](https://www.dndbeyond.com/vehicles/keelboat), [drácar](https://www.dndbeyond.com/vehicles/longship), [navio à vela](https://www.dndbeyond.com/vehicles/sailing-ship) e [navio de guerra](https://www.dndbeyond.com/vehicles/warship). O [SRD 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf) continua sendo a referência das compras e estatísticas existentes. Tamanhos terrestres/dirigível e extensão das coberturas são convenções visuais deste acervo, ajustáveis pelo mestre, sem mudar os itens da loja.

## Dados por slot

Cada conta mantém dois slots. A nova criação começa por escolher o slot e confirmar seis resultados em 3D; origem/aparência ficam disponíveis depois disso. Os 24 d6 são definidos uma única vez no servidor e as confirmações avançam uma por vez. Repetir requisições, recarregar, abrir outra aba ou excluir o personagem conserva os dados e quantas rolagens já foram confirmadas. A ficha recebe esses mesmos dados quando a arte termina, permitindo distribuir os resultados sem nova rolagem.

O bloqueio inclui Vestir/Nova imagem de fichas antigas que ainda não rolaram e confirmaram os atributos; a interface informa onde concluir. Pedidos de arte já pendentes e retomadas legadas continuam recuperáveis. A regra existente de 4d6, descarte do menor, piso 8 e soma 72–90 antes dos bônus permanece. Dados legados com piso 0 conservam sua interpretação.

Alcançar nível 4 marca o slot como liberado **para a próxima criação depois da exclusão**, sem sortear ou alterar atributos do personagem atual. Não exige que o personagem continue no nível 4; o marco fica persistido. A geração do slot é verificada também ao concluir/retomar uma imagem, impedindo reaproveitar pedidos de uma criação anterior.

Migration `127_character_slot_rolls.sql` reconstrói os slots cronologicamente incluindo excluídos, conserva dados anteriores do mesmo slot até um marco de nível 4 e reserva pedidos em andamento. Resultados antigos existentes são tratados como confirmados, pois o progresso antigo só existia no navegador. Fichas, bônus, distribuição, ouro, inventário, imagens, histórico e quantidade máxima de personagens permanecem preservados. O gatilho guarda resultados/progresso na exclusão e o marco de nível 4. Nenhuma API recebe resultados de dados arbitrários do cliente.

## Verificações

`scripts/test-vehicles-slots-isolated.mjs`: banco PostgreSQL com UUID descartável. Migração de um histórico realista até 126, reutilização de vaga, histórico com/sem nível 4, jobs pendentes, preservação integral das fichas, rolagem concorrente, privacidade, confirmação parcial, exclusão/recriação, bloqueio de Vestir, compra efetiva, escala, quantidade, permissões de mesa, cópia idempotente e hashes/alfa dos 12 originais.

`scripts/test-sheet-isolated.mjs --api`: seis testes de ficha/atributos, incluindo finalização apenas depois de confirmar os dados, regras anteriores e manutenção explícita do piso. 24 testes de criação, vínculo, copas, escala/luz e movimento também passaram. TypeScript e builds de cliente/servidor verificados.

`scripts/test-vehicles-slots-isolated.mjs --browser`: navegador real em 1440/1024/768/390 px, retomada na terceira rolagem, mesmos dados ao concluir, bloqueio da aparência e troca de slot, 12 artes carregadas, importação real pelo mestre e cobertura com personagens, rotação/ocultos e alfa do renderer. Evidências em `test-results/vehicles-slots/`.

Protocolo VTT 26 requer recarregar clientes antigos antes de editar o novo campo opcional `token.vehicle`. Documentos e assets anteriores continuam válidos. Publicação incremental deve conservar todos os arquivos das releases anteriores, fazer backup completo, aplicar 127 e recarregar o ilustrador somente com as duas filas ociosas. Conferir hashes de mesas/hotbars/arquivos privados, fichas/imagens/inventário e o heartbeat antes/depois.
