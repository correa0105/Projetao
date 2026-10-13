# Grama, cartas e orientação de mobília — 13/10/2026

## Pintura do VTT

A grama usa uma nova arte de pintura baixa, com detalhes mais suaves e manchas
de verde, terra e vegetação seca. Variações amplas de cor são ancoradas nas
coordenadas do mapa e compostas nos tiles do cache, sem movimento com a câmera.
O material adicional **Grama pedregosa** mistura vegetação, solo e focos de
pedras, usando o mesmo sistema de camadas, escala, opacidade, formas e borracha.
O servidor aceita `rocky-grass`; IDs e traços antigos permanecem válidos.

Árvores do catálogo recebem uma base transparente de terra, folhas e sombra de
contato, abaixo dos personagens e das copas. A base acompanha posição, escala,
giro e espelhos da árvore. Sua máscara inclui apenas a grama visível pintada:
outros materiais, camadas ocultas e borracha removem a integração. Árvores
ocultas não deixam pistas para jogadores. O acabamento não é aplicado a um
background enviado que não tenha grama pintada.

Materiais e integração ficam em tiles de 512 px, na densidade do zoom/DPR.
Todas as superfícies persistentes adicionais contam no limite LRU de 96 MiB;
máscaras têm orçamento separado de 24 MiB. Navegação e movimento de personagens
reutilizam a composição. Durante um traço ativo, o acabamento da árvore fica
suspenso somente nos tiles atingidos, até confirmar a pintura, evitando replay
do histórico a cada ponto. O cache diferencia textura e escala.

Originais e prompts: `data/vtt/terrain-v4-reviewed-20261013.json`.
PNG nativo preservado em `data/vtt/terrain-v4-sources-20261013`;
WebP de 1024 × 1024 em `public/vtt/terrain-v4-20261013`.
As outras cinco texturas v3 permanecem.

## Salão das cartas

O catálogo exibe no máximo quatro cartas por página, em duas linhas.
Anterior/próxima e o contador respeitam o filtro e o total; trocar filtro ou
personagem retorna à primeira página. A ficha fica ao lado das quatro cartas
no desktop e abaixo no celular. Compra, três espaços e equipamento permanecem.

Oito artes individuais de gravura surreal substituem o atlas antigo na
apresentação. Tinta escura, pergaminho envelhecido, rostos e símbolos incomuns
com pequenos detalhes de latão seguem as referências enviadas pelo usuário.
Os nomes continuam como texto da interface. Não há novas cartas, preços,
benefícios ou formas de obtenção inventadas.

Originais e prompts: `data/cards/tarot-v2-reviewed-20261013.json`.
PNG nativo preservado em `data/cards/tarot-v2-sources-20261013`;
WebP de 700 × 1000 em `public/cards/tarot-v2-20261013`.
Artes geradas individualmente com `image_gen`, modo generate, referências
utilizadas somente para estilo. Manifests guardam SHA-256, caminhos e prompts.

## Decoração da guilda

O painel explica três passos: escolher a vista real, apoiar os pés no piso e
conferir as linhas da sala. Abrir perspectiva mostra guias e uma linha dourada
de apoio. Setas de vistas continuam disponíveis com as guias abertas.
Alinhar à esquerda/direita aplica um ajuste limitado a 12%, mantendo o centro
inferior de apoio. Os quatro cantos ficam em **Refinar pelos cantos**; calibração
e restauração continuam disponíveis. Só ações explícitas alteram o móvel.

A projeção de uma ilustração 2D é uma aproximação: para ver outra lateral,
é preciso escolher outra vista real. Os presets e guias podem ser calibrados;
o sistema não reconstrói a geometria 3D da sala ou do móvel.

## Validação

- `scripts/verify-vtt-terrain-art.mjs`: sete materiais e integração no renderer.
- `scripts/verify-vtt-ground-integration.mjs`: máscara de grama, caminhos,
  camadas, borracha, movimento, privacidade e reaproveitamento do cache.
- `scripts/verify-vtt-brush-performance.mjs`: histórico de 120 traços/9.600
  pontos, três formatos, pan, commit, undo e limite de memória.
- `scripts/verify-tarot-art.mjs`: oito artes distintas, hashes, proporção,
  nomes na interface e screenshot do baralho.
- `scripts/smoke-vtt-map-editor.ts`: interface real, compra/equipamento de
  cartas, paginação/filtros, desktop/celular e ferramentas do mapa.
- `scripts/smoke-guilds-profiles.ts`: guias, vistas, cantos sem salto,
  persistência e quatro larguras, em banco isolado descartável.
- `tests/guild-perspective.test.ts`: validade da projeção e centro de apoio.

Deploy incremental preserva mídias anteriores e banco de usuários. Nenhum
teste escreve no banco de produção; nenhum layout salvo é recalibrado sozinho.
