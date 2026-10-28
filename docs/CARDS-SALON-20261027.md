# Salão das Cartas

A sala é um gabinete escuro e sóbrio, com madeira envelhecida, poucas decorações, luz fria da janela e velas localizadas. O Anfitrião fica um pouco afastado, sentado em poltrona atrás de uma mesa retangular. Preservar sua máscara preta de bico de corvo, olhos âmbar discretos, cartola e capa de penas. Evitar cores muito saturadas, cristais luminosos, excesso de dourado e aparência de salão luxuoso.

Três espaços pequenos e centralizados no tapete representam as cartas equipadas. Clicar em um espaço abre somente a coleção real do personagem; selecionar e confirmar equipa a carta ali. É possível inspecionar antes e retirar uma carta do espaço. Mover uma carta de outro espaço usa a API existente e remove a posição anterior sem duplicá-la. Falha mantém a seleção aberta e a mesa anterior. O baralho separado, próximo ao Anfitrião, abre o acervo com as oito definições e filtros. Comprar exige a ação explícita na inspeção; abrir um espaço nunca mostra cartas não possuídas como opções de equipamento.

Cada cenário tem uma superfície lógica projetada pelos quatro cantos calibrados do tampo. A projeção acompanha o recorte `center / cover` e o redimensionamento. Os três espaços usam a mesma escala, alinhamento e perspectiva; o conjunto tem margens equilibradas e não ocupa todo o tapete. Áreas transparentes maiores facilitam o toque sem aumentar a arte. Desktop usa o cenário horizontal; até 900 px usa o retrato com seu próprio plano. PNGs preservados na resolução e qualidade nativas.

A iluminação pintada fornece sombras, reflexos e feixe volumétrico. Uma camada Canvas acrescenta difusão discreta e oscilação das velas, além de poeira esparsa somente na região do feixe. Coordenadas acompanham o mesmo recorte da imagem. Movimento reduzido mantém luz estática, sem partículas; aba oculta e desmontagem interrompem os quadros. Densidade e resolução limitadas, sem filtros animados sobre a tela inteira.

A revelação usa giro, brilho e partículas, com papel e harmônicos sintetizados originalmente em Web Audio. Respeita o volume/silenciamento global de efeitos, interrompe o áudio ao fechar/ocultar e reduz animações conforme a preferência do sistema. Inspeção conserva Escape, retorno do foco, rotação por teclado e prévias dos três níveis.

As oito definições, quatro cartas compráveis, preços, três espaços e APIs de compra/equipamento existentes são preservados. Não foram acrescentados upgrades, drops, migrações ou concessões de bens.

Validação: TypeScript, build Vite e teste geométrico do plano e dos três espaços em oito dimensões. Revisão no Edge em seis tamanhos (1920 × 1080 a 320 × 740): seleção somente de cartas próprias, troca entre espaços sem duplicação, retirada, falha de equipamento sem atualização indevida, coleção vazia, compra, recarga, inspeção/verso, filtros, conversa, áudio/mute e movimento reduzido. APIs simuladas, sem compras ou alterações em dados reais. Capturas e resultados privados em `test-results/cards-table-slots-20261027/`.

Artes finais: `public/cards/host-shadow-study-20261027.png` e `public/cards/host-shadow-study-mobile-20261027.png`, geradas com a ferramenta integrada image_gen a partir da composição de mesa e referência de máscara do usuário; verso e gravuras são SVGs próprios. Prompts exatos em [CARDS-SALON-SCENE-PROMPTS-20261027.txt](CARDS-SALON-SCENE-PROMPTS-20261027.txt). Rascunhos permanecem em `.local/cards-salon-drafts-20261027/` e na pasta original de gerações; artes publicadas anteriores são preservadas.

Publicação de cliente derivada da imagem vigente, preservando servidor, assets antigos e ilustrador. Backup de banco e configuração antes da troca, com retorno automático à imagem anterior se a aplicação não ficar saudável.
