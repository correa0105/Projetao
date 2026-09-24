# Mundo — territórios e mar contínuo

## Subdivisões vigentes — 18/09/2026

O Mundo contém **22 territórios**, com vinte divisões terrestres e os dois destinos marítimos preservados. As fronteiras continuam finas, irregulares e acompanhadas pelo destaque da área selecionada. Agrupamento de referência das novas divisões:

| Área anterior | Territórios atuais |
| --- | --- |
| Reino do Norte | Reino do Norte, Coroa da Geada, Vale dos Pinheiros |
| Costa Cinzenta | Costa Cinzenta, Falésias de Sal |
| Northundria | Northundria, Altos de Boreal, Campos de Vésper |
| Pomar Branco | Pomar Branco, Terras de Âmbar, Península de Lume |
| Valdrakken | Valdrakken, Escarpas de Cinábrio |
| Skelliege | Skelliege, Vigias do Gelo |
| Marchas do Poente | Marchas do Poente, Vale do Cervo |
| Dunas de Auren | Dunas de Auren, Portas de Arenito, Ermos de Sálvia |
| Destinos marítimos | Olho da Tormenta, Fulkushima |

São regiões independentes; a tabela acima descreve a repartição visual, sem criar uma hierarquia de estados no banco. Migration `009_smaller_world_regions.sql` insere doze registros novos, sem atualizar/deletar regiões, locais ou missões existentes. As novas regiões têm `available=false`; somente Reino do Norte continua abrindo seu mapa interno. Cada novo destino já aceita hover/clique e apresenta o aviso de exploração futura. A divisão por proximidade recalcula as fronteiras nas áreas vizinhas. Shader e CPU preservam os mesmos índices da lista completa, inclusive com destinos marítimos entre entradas terrestres.

Validação: build Docker/TypeScript, dez testes API/SQL e teste mundial desktop/celular aprovados; todas as doze novas regiões selecionadas, destaque de Coroa da Geada conferido na captura `world-subdivision-hover.png`. A descrição abaixo registra a primeira expansão de três para dez territórios; o oceano atual está em `world-ocean.ts`, com profundidade por fragmento.

Revisão solicitada após aprovação do relevo: ampliar o espaço marítimo, eliminar a emenda no mar, acrescentar ilhotas/vulcão/tormenta e substituir a leitura de somente três destinos por várias demarcações clicáveis.

- `world-relief.ts` usa um único oceano de 240 × 200 unidades. A grade é densa junto às costas e se expande offshore; o antigo par de planos sobrepostos foi removido. A cor costeira desaparece gradualmente junto aos limites da máscara de geografia.
- O enquadramento e os limites navegáveis reservam mais 15% da largura original em cada lateral e 15% da altura na base / 20% no topo. Isso resulta em 46,8 × 27,3375 unidades, com centro visual deslocado ao norte. A silhueta original e as cordilheiras permanecem. A margem do cabeçalho também permanece.
- `world-territories.ts` define os pontos geográficos dos dez territórios. Oito divisões terrestres usam proximidade com deformação suave para fronteiras irregulares, recortadas pela costa; dois destinos marítimos possuem áreas de interação sem contornos circulares visíveis. A geografia não altera as coordenadas internas da visão do reino.
- As fronteiras e o destaque são calculados analiticamente no shader, sem textura de IDs. A distância até a fronteira usa derivadas de tela para uma linha fina com antialiasing. O cursor segue a mesma divisão calculada na CPU; arraste não seleciona territórios e os marcadores continuam acessíveis por teclado.
- `world-seascape.ts` cria ilhotas com geometria e costa irregular, Fulkushima com cratera/lava e Olho da Tormenta com nuvens espirais animadas. As nuvens comuns abrem levemente sobre os dois destinos para permitir a leitura. Movimento reduzido congela as animações, e os recursos são liberados ao sair.
- Legendas mundiais mais compactas, sem “Em breve” repetido embaixo de cada nome. Detecção de colisão oculta legendas sobrepostas; hover/foco revela a legenda correspondente. Nomes acessíveis permanecem nos botões.

## Dados e disponibilidade

Migration `008_world_territories.sql` acrescenta Valdrakken, Skelliege, Marchas do Poente, Dunas de Auren, Costa Cinzenta, Olho da Tormenta e Fulkushima em `world_regions`. Mantém Reino do Norte, Northundria e Pomar Branco. Somente Reino do Norte tem exploração interna disponível; os outros destinos exibem aviso ao selecionar. Nenhum local ou missão existente foi movido, duplicado ou apagado. Não criar missões em regiões indisponíveis.

## Validação

Build Docker/TypeScript e dez testes API/SQL aprovados. `ATLAS_BROWSER_GPU=1 npm run test:atlas -- --world-map-only` passou em desktop e celular: dez marcadores, hover e clique direto em terreno fora dos botões, seleção dos novos nomes, arraste/zoom/reset, mola e entrada/retorno do Reino do Norte. Capturas `world-relief-home-*` e `world-territory-hover.png` em `test-results`. Sem erros de shader/JavaScript no teste. Os efeitos marítimos foram conferidos visualmente; o mapa continua sendo uma representação de fantasia, sem escala geográfica literal.

## Revisão de enquadramento e contornos

Refino vigente: tormenta centralizada em UV (0,156; 0,673), com arquipélago próprio, separado da seleção do Reino do Norte. Removidos os círculos da tormenta e do vulcão. Fronteiras analíticas finas com antialiasing por derivadas de tela substituem a textura de IDs pixelada. CPU e shader usam os mesmos pontos/equações. Zoom inicial/reset e mínimo em 100%, equivalente ao antigo 142% pela recalibração do frustum; composição 8% mais baixa preservada, máximo 246,48% (mesma aproximação física do antigo 350%). Foco de mouse não move pinos durante o clique. Build e teste mundial desktop/celular aprovados, sem erros de shader/JavaScript; detalhe conferido até o zoom máximo. Nenhuma mudança no banco ou regras nesta revisão.

### Acabamento mundial vigente — 17/09/2026

Base de câmera reduzida pelo fator 1,42: 100% mantém o enquadramento aprovado; limite máximo 3,5/1,42 preserva a aproximação física anterior. Verde e ocre mais vivos, montanhas cinza neutro, fotografias CC0 de solo/rocha em duas escalas com contraste e relevo de superfície reforçados. Nuvens deslocam-se cerca de 75% mais rápido e deformam-se continuamente; a espiral da tormenta gira mais rapidamente, com ruído também em rotação. Movimento reduzido continua respeitado. Fulkushima usa uma única malha contínua de cratera, encostas, baixadas e costa irregular (raio 2,9), com nove rochedos/ilhotas adjacentes, textura fotográfica e lava rebaixada dentro da cratera; área clicável acompanha a ilha ampliada, sem contorno circular. Build Docker/TypeScript e teste mundial desktop/celular aprovados; sem mudanças de SQL ou regras.
