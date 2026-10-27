# Salão das Cartas

A sala usa oito cartas pretas com gravuras douradas próprias, dispostas em arco sobre o feltro, com baralho ao centro. O Anfitrião fica de frente para o jogador, um pouco afastado e sentado em poltrona visível atrás da mesa. Preservar sua máscara preta angular, olhos âmbar, cartola e capa de penas. Filtros e três espaços equipados têm controles discretos; descrição, preço e ações aparecem somente ao revelar a carta.

Cada cenário tem uma superfície lógica projetada pelos quatro cantos calibrados do tampo. A projeção acompanha exatamente o recorte `center / cover` do fundo e o redimensionamento da sala. As cartas giram somente dentro desse plano para formar o arco; não aplicar inclinação 3D independente. O conjunto se redistribui ao filtrar a coleção. Desktop usa o cenário horizontal; até 900 px usa o retrato, com seu próprio plano. Os PNGs gerados permanecem na resolução nativa, sem conversão ou compressão.

A revelação usa giro, brilho e partículas, com papel e harmônicos sintetizados originalmente em Web Audio. Respeita o volume/silenciamento global de efeitos, interrompe o áudio ao fechar/ocultar e reduz animações conforme a preferência do sistema. Inspeção conserva Escape, retorno do foco, rotação por teclado e prévias dos três níveis.

As oito definições, quatro cartas compráveis, preços, três espaços e APIs de compra/equipamento existentes são preservados. Não foram acrescentados upgrades, drops, migrações ou concessões de bens.

Validação: TypeScript, build Vite e teste geométrico dos cantos sobre o feltro em oito dimensões. Revisão no Edge em seis tamanhos (1920 × 1080 a 320 × 740), incluindo inspeção, verso, filtros, três espaços, conversa, compra/equipamento com API simulada, áudio/mute e movimento reduzido. Capturas e resultados privados em `test-results/cards-salon-20261027/`.

Artes finais: `public/cards/host-reading-masked-20261027.png` e `public/cards/host-reading-masked-mobile-20261027.png`, geradas com a ferramenta integrada image_gen; verso e gravuras são SVGs próprios. Identidade conferida em `docs/references/companions/card-host.png`, incluindo a máscara. Prompts exatos em [CARDS-SALON-SCENE-PROMPTS-20261027.txt](CARDS-SALON-SCENE-PROMPTS-20261027.txt). Rascunhos permanecem em `.local/cards-salon-drafts-20261027/` e na pasta original de gerações, fora do release.

Publicação de cliente derivada da imagem vigente, preservando servidor, assets antigos e ilustrador. Backup de banco e configuração antes da troca, com retorno automático à imagem anterior se a aplicação não ficar saudável.
