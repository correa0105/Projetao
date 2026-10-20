# Biblioteca de objetos individuais e pincel de chão

Escopo vigente de 12/10/2026: **25 artes novas em cada uma de dez categorias, total de 250**. O usuário substituiu o pedido inicial de 1.000 e depois descartou expressamente todo o primeiro acervo. Nenhuma arte da primeira produção entra nesta entrega. A biblioteca fornecida em Downloads/assets continua como referência de materiais, acabamento e projeção superior; arquivos FA não são incorporados ao produto.

Casa, Acampamento, Floresta, Masmorra, Construções, Taverna, Cidade, Natureza, Objetos e Templo têm 25 assuntos distintos cada. O foco são objetos individuais: mesas e bancos vazios, cadeiras, livros, tapetes, árvores, arbustos, galhos, pedras, ferramentas e utensílios. Não há fontes, sarcófagos ou conjuntos de balcões. Cada imagem representa uma peça independente com transparência, não uma composição de vários objetos.

## Produção

Estado: **EM PRODUÇÃO**. O plano não conta como arte concluída. `data/vtt/scenery-v2-plan-20261012.json` registra os 250 assuntos e prompts; fontes nativas, hash, dimensões e câmera estão em `data/vtt/scenery-v2-completed-20261012`. As seis texturas também são novas e têm registros em `data/vtt/terrain-v2-completed-20261012`.

Artes exportadas em `public/vtt/scenery-v2-20261012`, WebP transparente de até 768 px, qualidade 94; pisos opacos 768 × 768, qualidade 95. A escala nominal distingue um pequeno livro de uma mesa ou árvore, mantendo a proporção exata da imagem.

A revisão visual por ID e hash está em `data/vtt/scenery-v2-reviewed-20261012.json`. Peças com grupos indevidos ou câmera inclinada são geradas novamente e ficam fora do catálogo enquanto pendentes. `scripts/refresh-scenery-catalog.mjs` inclui somente artes novas concluídas e aprovadas pelo hash atual. `scripts/verify-scenery-assets.mjs` verifica 250 arquivos, 25 por categoria, unicidade, transparência, proporção, proveniência e revisão.

## Ferramentas

Biblioteca → Assets oferece categorias, busca por palavras sem acentos, favoritos locais, prévia, escala pela grade e arraste para o mapa. Miniaturas são carregadas em grupos de 40. Somente o mestre coloca objetos ou pinta; jogadores podem consultar as peças.

Pincel e borracha incluem raio, suavidade, opacidade e escala da textura. Grama, terra, areia, pedra, madeira e neve têm arte própria. A borracha e Limpar pintura afetam somente o chão pintado; fundo e objetos permanecem. Desfazer/refazer recupera também a pintura limpa. Escape cancela e sai do pincel mesmo com um botão focado.

`scene.terrain` é validado pelo servidor e usa `[]` para mapas antigos. Protocolo VTT 13 exige atualizar clientes antigos; nenhuma migration é necessária. A composição usa cache por cena, câmera e texturas, limita superfícies ao viewport e traços à sua área visível, e recorta a pintura aos limites do mapa. Clonar o documento sem mudar os traços preserva o cache.

## Validação e publicação

TypeScript/build e o smoke da implementação passaram em PostgreSQL UUID descartável: pintura/borracha por pixels, desfazer/refazer, limpar sem remover objetos, salvar/recarregar, categorias, busca, escala, arraste nativo, protocolo antigo 409, textura inválida 400 e jogador 403. Interface inspecionada em 1440, 760 e 390 px. Reexecutar com o novo catálogo e novas texturas antes da publicação.

Ensaio local com 1.000 traços/20 visíveis em viewport 1000 × 800: reconstrução com documento clonado ~2,8 ms, quadro em cache ~0,009 ms, rascunho ~1,7 ms e pan ~17 ms. São medidas locais; script e resultados em `scripts/review-terrain-performance.mjs` e `data/vtt/terrain-performance-20261012.json`.

Release isolado exclui o protótipo de monstros pausado e trabalhos independentes. A auditoria confirmou que o servidor-base compilado é byte a byte igual ao servidor instalado; preservar catálogo/mídia windmill-side-v5 já publicados. A imagem de publicação é aditiva sobre a versão instalada e acrescenta somente os bundles, servidor, HTML e acervo v2, com backup e verificação dos dados existentes.
