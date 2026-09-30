# Materiais e vegetação no Mundo 3D

Em 30/09/2026, o usuário pediu que o realismo fosse construído no próprio 3D, sem colar o atlas ilustrado na superfície. `atlas-world-inkarnate-v1.webp` deixa de ser solicitado pelo renderer. A referência V2 continua fornecendo somente máscara costeira e categorias dos biomas; alturas, cores, vegetação e acabamento são produzidos pelo código.

- Rocha e solo: fotografias locais CC0 projetadas em três eixos, misturadas pela inclinação e altitude; luminância preserva a paleta dos biomas. Fissuras, estratos minerais irregulares e ondulações da areia são calculados em coordenadas do mundo e alteram a normal de iluminação. Sem sombras pintadas provenientes do atlas.
- Montanhas: pequenos esporões de erosão deslocam os vértices da malha existente. Altura final continua alimentando rios, pinos e seleção.
- Florestas: copas arredondadas e coníferas em duas malhas instanciadas, com posições, cores e tamanhos determinísticos. Costa, neve, inclinação e altitude limitam o povoamento; clareiras usam ruído orgânico. Copas recebem e projetam sombras, não interceptam seleção dos territórios. Geometrias, materiais e buffers das instâncias são liberados ao sair.
- Oceano: espuma irregular animada próxima da costa, mantendo o plano único, profundidade e ondas procedurais existentes.

A escala continua cartográfica e representativa. Copas usam geometria econômica para permitir visão mundial; não são modelos botânicos em escala real. A arte de referência tem um acabamento pintado que esta abordagem não reproduz pixel a pixel.

## Validação

Build TypeScript/Vite/servidor aprovado via Docker Compose. `ATLAS_BROWSER_GPU=1 node node_modules/tsx/dist/cli.mjs scripts/smoke-atlas.ts --world-map-only` verifica desktop e celular, câmera, zoom, pan elástico, territórios e entrada/retorno do reino. O smoke também rejeita qualquer solicitação da imagem Inkarnate. Conferir `test-results/world-relief-home-desktop.png`, `world-relief-detail-desktop.png` e `world-relief-home-mobile.png` para a qualidade visual.

## Refino de costa, árvores e deserto (30/09/2026)

Ondas costeiras agora têm cristas móveis acompanhando a costa, variação orgânica e espuma com antialias. Árvores menos densas (espaçamento 0,085 e probabilidade menor), copas menores e textura procedural de folhagem. Fronteiras do território em hover ficam mais largas e recebem passe transparente acima das copas, sem interceptar cliques. Deserto tem dunas assimétricas na geometria, grãos e ondulações no material. Por pedido explícito, o vulcão Fulkushima, lava, rochedos associados, águas rasas e marcador foram retirados do Mundo; as duas ilhotas cônicas no extremo sul também foram removidas. Os registros SQL e a tag mapa-3d-2026-09-30 são preservados. São 21 marcadores visíveis; a lista histórica continua com 22 IDs. Esta decisão substitui a antiga exigência de preservar o vulcão na cena.

Validação do refino: build Docker/TypeScript aprovado; smoke mundial completo em Edge com GPU aprovado em 1440 × 900 e 390 × 844, sem erros de shader/console. Capturas de hover, detalhe e celular revisadas. Navegação e retorno do reino preservados.

## Correção de ondas e copas (30/09/2026)

Usuário rejeitou as faixas brancas das ondas e o acabamento das árvores. Oceano deixa de usar frentes baseadas em distância costeira; ondas de vento em duas direções e ruído animado modificam a normal da água. Espuma restrita a manchas discretas no encontro com a costa. Copas refeitas com sete grupos de folhagem nas árvores largas e nove nas coníferas, tronco, proporções variáveis e detalhes de normal no material. Mantida densidade reduzida e fronteiras em hover acima das copas. Não restaurar os contornos brancos nem os modelos simples de esfera/cone.

Validação desta correção: build Docker/TypeScript e smoke mundial completo com GPU aprovados em desktop e celular, sem erros de shader/console. Captura aproximada revisada para confirmar ausência de faixas brancas e a nova silhueta das copas.
