# Montarias e mascotes no VTT — 09/10/2026

Em **Fichas**, **Montarias** e **Mascotes** ficam ao lado de **Personagens**. Cada cartão mostra a arte principal do animal, o nome escolhido pelo jogador, o personagem ao qual pertence, o nome do jogador e uma miniatura da vista superior. Clique ou arraste para colocar no mapa; a aba permanece aberta. Um animal já colocado na cena é selecionado ou movido sem duplicar o token.

As 25 combinações básicas de espécie/pelagem têm arte superior própria com transparência nativa: cavalos de montaria/guerra, pônei, mula e dez espécies de mascote, incluindo as variantes disponíveis. As imagens foram comparadas com as referências originais de cor e espécie; aves pousadas mantêm asas fechadas, patas ficam sob o corpo e serpentes não ganham membros. Prompts, fontes, hashes e revisão em `data/companion-token-art-20261009/published-manifest.json`.

O ilustrador agora produz um par: **arte principal + token visto de cima**, com a mesma pelagem e equipamento. A referência de identidade é a arte principal aprovada e a guia de câmera é o token básico da espécie/pelagem correspondente. Revisão verifica anatomia, câmera vertical, equipamentos e alfa. Só publica o par quando ambas as imagens são válidas; falha ou equipamento alterado conserva a cota e a arte anterior. A publicação atualiza somente tokens gerenciados pelo site, preservando posição, PV e imagens personalizadas pelo mestre.

Migration **087** adiciona `companion_artworks.token_image` e `vtt_assets.companion_art_source`. O documento reconhece `companionId`; protocolo **6** exige recarregar abas antigas antes de receber/salvar o novo formato. O acesso privado por `/companions/:characterId/:kind/:companionId/token` verifica ownership. Imagens dentro da sala respeitam participação e ocultação; espectadores não importam animais. Importação não atravessa paredes, nem move animais bloqueados/ocultos. Transações seguem dono → personagem → sala para evitar disputa com o ilustrador.

Validação: `scripts/test-vtt-companions-isolated.mjs`, banco descartável, confirma todas as 25 artes, titularidade, nomes/donos, clique/arraste em três larguras, posições enviadas, barreiras, ocultação, imagens privadas, publicação atômica, repetição, equipamento obsoleto e publicação/importação concorrentes. Um diário maior que 8 KiB confirma que o parser da importação não limita outros comandos do VTT. `tests/companion-token-illustrator.test.ts` usa CLI simulada para conferir as referências reais de cão/cavalo e reprovação da vista superior; nunca invoca geração paga em testes.

As duas artes vestidas que já existiam receberam tokens superiores próprios após revisão local. A vinculação conserva principal, revisões de equipamento/imagem e cota; antes de gravar compara hashes e revisões com a fonte revisada, evitando substituir uma geração mais nova.

A reconstrução 330×4 permanece pausada.
