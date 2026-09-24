# Mundo — relevo navegável

Direção pedida em 17/09/2026 após a rejeição do atlas plano V2. Mundo deve preencher a tela e permitir explorar a geografia por arraste/zoom. O enquadramento inicial foi posteriormente afastado para mostrar o mapa inteiro. O usuário manteve os três botões dos reinos e pediu cordilheiras, planaltos e biomas representativos como a leitura do atlas de Runeterra, além de nuvens. A silhueta anterior define a geografia; a escala do relevo não é literal.

Revisão posterior: o usuário aprovou a modelagem. Preservar as cadeias, costas, geografia e botões; os ajustes seguintes são de acabamento: pedra mais cinza, vegetação mais escura, detalhe de superfície mais realista, ondulações suaves nas planícies e nuvens um pouco mais densas/rápidas. Pedido vigente: antigo enquadramento de 142% passa a ser a base real de 100%; frustum e deslocamento recalibrados, preservando composição 8% mais baixa. Arrastar perto dos limites deve oferecer resistência progressiva e recuar suavemente ao soltar, sem uma parada seca.

## Componentes

- `src/world-ocean.ts`: oceano em plano único, com profundidade por fragmento (distância costeira half-float, filtro linear), transição irregular entre azul profundo e águas rasas e ondulações contínuas sem a grade das antigas ondas senoidais cruzadas. Substitui a antiga coloração interpolada dos vértices. `src/world-offshore.ts` fornece ilhotas e rochedos tanto ao mar raso quanto à geometria de `world-seascape.ts`; treze novas ilhotas em grupos assimétricos. O mapa completo e o zoom máximo foram conferidos em capturas; teste mundial desktop/celular aprovado. Textura, plano e material liberados no descarte.

- `src/WorldMap.tsx`: renderer Three.js, câmera ortográfica inclinada, arraste/zoom ancorado, toque, teclado, projeção dos marcadores, transição de entrada e limpeza de recursos.
- `src/world-relief.ts`: malha contínua com alturas e normais suaves, cordilheiras e biomas procedurais, rios e oceano estendido. Duas fotografias locais CC0 (`ground-color.jpg` e `rock-color.jpg`, cerca de 1,65 MB) entram como detalhe neutro de superfície por projeção em três eixos; cores dos biomas são preservadas. Carregamento falho ou acima de oito segundos conserva o detalhe procedural. O PNG V2 fornece máscara costeira e distribuição geral dos biomas; não é aplicado como textura de cor no material nem exibido em um elemento de imagem.
- `src/world-clouds.ts`: nove bancos de nuvens procedurais acima do terreno, com formas irregulares, deslocamento para leste e parallax ao navegar. Opacidade máxima 0,51 (levemente mais transparente, por solicitação posterior) e movimento 25% mais rápido que a primeira versão. Bancos e formas ampliados, posições mais espalhadas pelos mares, sem interceptar cliques.
- `src/world-map.css` e regras de Mundo em `src/journey.css`: palco sem moldura ocupando o viewport, cabeçalho/menu sobrepostos e controles discretos de navegação.
- `src/WorldAtlas.tsx`: apresenta os 22 territórios atuais, entrada no Reino do Norte, locais e painel de missões existente. Desde 23/09/2026 a cena interna do reino é [Canvas 2D com sprites](KINGDOM-2D.md), independente do relevo mundial.

Geografia normalizada (u, v): X=(u−0,5)×36; Y=(0,5−v)×20,25; altura no eixo Z. Os três marcadores mantêm Reino do Norte (0,30; 0,33), Northundria (0,69; 0,27) e Pomar Branco (0,81; 0,64). A cena regional permanece independente, sem alteração das coordenadas SQL ou do fluxo do mural.

Câmera mundial a 67° acima do plano, zoom 1–2,4648. O enquadramento inicial adapta largura e altura para mostrar o mapa completo, com margem para o relevo. Centralizar retorna ao zoom inicial vigente de 100% (equivalente ao antigo 142%) no viewport atual. Scroll usa interpolação curta com acumulação dos deltas; arraste, pinça e teclado movimentam a câmera. O arraste perde força perto dos limites e retorna suavemente para dentro ao soltar. Marcadores recebem a projeção das coordenadas e altura do terreno, mantendo o desenho aprovado. A seleção de Reino do Norte aproxima antes de abrir sua cena. Página oculta interrompe os frames; movimento reduzido desativa a atmosfera animada e torna transições imediatas.

## Limites e fontes

Removidos a orientação “Escolha um território para explorar” do cabeçalho, o título mundial duplicado e a orientação visível de arraste no rodapé. Instruções de teclado continuam acessíveis ao leitor de tela. O enquadramento inicial mede o cabeçalho via ResizeObserver, reserva 32 px além dele e 90 px inferiores, ajusta a escala e desloca o frustum para manter terra abaixo do painel e oceano atrás dele. Zoom e reset respeitam esse espaço em desktop/celular; visão do reino independente.

O acabamento é um atlas de fantasia com relevo representativo, não uma simulação geográfica. O recorte costeiro depende da referência raster e a malha possui resolução finita; o zoom é limitado. WebGL é necessário para o Mundo. A apresentação/login continuam com seus próprios ativos.

Referência artística e de interação: https://map.leagueoflegends.com/. Nenhum modelo, código ou textura da Riot foi incorporado. Origem da silhueta/PNG anterior em [ATLAS-WORLD-V2.md](ATLAS-WORLD-V2.md) e [ATTRIBUTION.md](ATTRIBUTION.md).

## Verificação

`npm run build` valida TypeScript e produção. `npm run test:atlas -- --world-map-only` cobre a navegação mundial e a entrada/retorno da visão do reino sem publicar missões. Inspecionar também capturas da visão inicial e aproximada: a presença de uma malha e os testes de câmera sozinhos não comprovam a qualidade visual.

Revisão de 17/09/2026: malha de 519.901 vértices, costas suavizadas em campo de distância, biomas interpolados, nove cordilheiras e onze rios/afluentes. Teste focado aprovado em desktop 1440 × 900 e celular 390 × 844: canvas até as bordas, zoom/arraste/reset responsivo, projeção dos botões, avisos dos territórios, entrada/retorno do Reino do Norte e ausência de erros de console/shader. Nenhuma missão publicada; contas temporárias removidas. Capturas de início, aproximação e arraste em `test-results/world-relief-*.png` (ignoradas pelo Git).

Refino posterior validado nos mesmos tamanhos: visão inicial completa, textura neutra de solo/rocha e planícies suaves; resistência progressiva e retorno para dentro em 546 ms desktop / 542 ms celular, com frames intermediários. Executar o teste com `ATLAS_BROWSER_GPU=1` (PowerShell: `$env:ATLAS_BROWSER_GPU='1'`) para usar a GPU normal do navegador. SwiftShader forçado tem desempenho insuficiente para validar a animação com estes materiais. Testes passaram em Edge com NVIDIA/ANGLE/D3D11, sem erros e sem contas temporárias restantes. O fallback de materiais também foi conferido com imagens indisponíveis.

Refino visual: nuvens mundiais levemente mais transparentes (alpha máximo 0,51), mantendo tamanho, distribuição e movimento.

### Acabamento mundial vigente — 17/09/2026

Base de câmera reduzida pelo fator 1,42: 100% mantém o enquadramento aprovado; limite máximo 3,5/1,42 preserva a aproximação física anterior. Verde e ocre mais vivos, montanhas cinza neutro, fotografias CC0 de solo/rocha em duas escalas com contraste e relevo de superfície reforçados. Nuvens deslocam-se cerca de 75% mais rápido e deformam-se continuamente; a espiral da tormenta gira mais rapidamente, com ruído também em rotação. Movimento reduzido continua respeitado. Fulkushima usa uma única malha contínua de cratera, encostas, baixadas e costa irregular (raio 2,9), com nove rochedos/ilhotas adjacentes, textura fotográfica e lava rebaixada dentro da cratera; área clicável acompanha a ilha ampliada, sem contorno circular. Build Docker/TypeScript e teste mundial desktop/celular aprovados; sem mudanças de SQL ou regras.
