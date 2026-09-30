# Materiais e vegetação no Mundo 3D

Em 30/09/2026, o usuário pediu que o realismo fosse construído no próprio 3D, sem colar o atlas ilustrado na superfície. `atlas-world-inkarnate-v1.webp` deixa de ser solicitado pelo renderer. A referência V2 continua fornecendo somente máscara costeira e categorias dos biomas; alturas, cores, vegetação e acabamento são produzidos pelo código.

- Rocha e solo: fotografias locais CC0 projetadas em três eixos, misturadas pela inclinação e altitude; luminância preserva a paleta dos biomas. Fissuras, estratos minerais irregulares e ondulações da areia são calculados em coordenadas do mundo e alteram a normal de iluminação. Sem sombras pintadas provenientes do atlas.
- Montanhas: pequenos esporões de erosão deslocam os vértices da malha existente. Altura final continua alimentando rios, pinos e seleção.
- Florestas: copas arredondadas e coníferas em duas malhas instanciadas, com posições, cores e tamanhos determinísticos. Costa, neve, inclinação e altitude limitam o povoamento; clareiras usam ruído orgânico. Copas recebem e projetam sombras, não interceptam seleção dos territórios. Geometrias, materiais e buffers das instâncias são liberados ao sair.
- Oceano: espuma irregular animada próxima da costa, mantendo o plano único, profundidade e ondas procedurais existentes.

A escala continua cartográfica e representativa. Copas usam geometria econômica para permitir visão mundial; não são modelos botânicos em escala real. A arte de referência tem um acabamento pintado que esta abordagem não reproduz pixel a pixel.

## Validação

Build TypeScript/Vite/servidor aprovado via Docker Compose. `ATLAS_BROWSER_GPU=1 node node_modules/tsx/dist/cli.mjs scripts/smoke-atlas.ts --world-map-only` verifica desktop e celular, câmera, zoom, pan elástico, territórios e entrada/retorno do reino. O smoke também rejeita qualquer solicitação da imagem Inkarnate. Conferir `test-results/world-relief-home-desktop.png`, `world-relief-detail-desktop.png` e `world-relief-home-mobile.png` para a qualidade visual.
