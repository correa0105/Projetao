# Mundo — atlas ilustrado V2 (histórico)

Esta entrega plana foi rejeitada pelo usuário. A direção vigente é o [Mundo com relevo navegável](ATLAS-WORLD-RELIEF.md), sem moldura, preenchendo a tela. O arquivo V2 é conservado como fonte da silhueta e dos biomas; a tela atual não o exibe como imagem. As instruções, dimensões e testes abaixo documentam somente a revisão anterior.

Direção da época desta revisão: **Mundo** era a visão geral ilustrada e a **visão do reino** continuava em 3D. Ambas as decisões foram substituídas depois: Mundo voltou ao relevo navegável; em 23/09/2026 o reino passou ao [cenário 2D com sprites](KINGDOM-2D.md).

Arte final: `public/atlas-world-v2.png`. Referência geográfica fornecida pelo usuário preservada em `docs/references/world-silhouette.png`, para continuidade entre máquinas. A referência define a disposição e os recortes dos continentes, mares interiores, estreitos, faixa de gelo e formação circular no sudoeste. A pintura remove nomes e cartela do mapa de referência; rótulos são HTML interativo.

Gerada/editada pela ferramenta **imagegen integrada**, sem API/CLI externo. Dimensão nativa recebida: **1672 × 941 px**; o pedido de 3840 × 2160 do prompt não foi atendido. O arquivo não foi ampliado artificialmente. Zoom usa interpolação do navegador e não cria detalhe infinito. Nenhum asset da Riot foi incorporado; seu atlas serviu como direção de relevo pintado e biomas representativos, sem escala literal.

## Navegação e enquadramento

`src/WorldMap.tsx` renderiza a arte em HTML/CSS, sem Three.js no Mundo. Zoom de 1 a 3 pelo scroll, botões ou gesto com dois dedos; arraste limitado e teclado. O zoom mínimo usa `contain`, calculado pela dimensão real da imagem e pela área útil, com cabeçalho, controles e menu fora dela. A altura acompanha o espaço disponível na janela. Centralizar volta ao zoom 1 e reposiciona a arte no viewport atual, inclusive depois de redimensionamento.

Três marcadores HTML acompanham as coordenadas normalizadas da arte: Reino do Norte (0,30; 0,33), Northundria (0,69; 0,27) e Pomar Branco (0,81; 0,64). Selecionar Reino do Norte aproxima e carrega a visão do reino existente; os demais mantêm o aviso de exploração futura. Cidades, coordenadas regionais, missões e SQL não foram alterados.

Teste focado: `npm run test:atlas -- --world-map-only`. Verifica encaixe completo em desktop, notebook e celular, zoom ancorado, limites de pan, marcadores alinhados, ausência de WebGL/PBR antes da região, entrada na visão do reino e retorno. Não publica missões.

Validação em 17/09/2026: build Docker/TypeScript e teste focado aprovados no build final; 1440 × 900, 1280 × 720 e 390 × 844. Capturas `test-results/world-map-*.png` revisadas. Reset é validado contra o viewport atual, que pode mudar ao redimensionar, e os marcadores permanecem alinhados à arte com precisão de 1 px. Um novo pointerdown libera a seleção deliberada imediatamente após arrastar; apenas o clique residual do próprio arraste é suprimido. Nenhum erro inesperado, nenhuma missão publicada e contas temporárias removidas.

## Prompt final

```text
Use case: style-transfer.
Asset: production fantasy WORLD ATLAS background for an interactive tabletop RPG website, image only, landscape 16:9. Edit the supplied map image, treating it as the STRICT geographic template. Preserve the exact large and small coastline silhouettes, their positions, proportions, orientation, enclosed seas, channels, northern icy coast, western sweeping continent, northeast continent and long southeast hooked continent. Do not rearrange, simplify into oval islands, rotate, invent a different world, crop or add new continents. Preserve the small southwestern circular island formation and the narrow channels and inland seas. The geographic silhouette is the highest-priority invariant.
Replace the rendering only: produce a beautiful sophisticated realistic relief-painted terrain atlas, the high-end dark fantasy cartographic visual language of League of Legends Runeterra's interactive world map. This is top-down geographical artwork with softly sculpted mountains and believable textures, NOT low-poly objects or cartoon terrain. Large readable biome regions: pale northern snow and glacier ridges at the reference positions, desaturated moss/olive forests and temperate plains, weathered ochre/sand deserts in the existing central and western dry regions, fine river networks and dramatic but representative mountain ridges with soft directional shadows. Retain the geography and general placement of biomes shown in the input. Rich sharp fine terrain detail at zoom, yet calm and readable from full-world view.
Dark midnight blue ocean with delicate coastal bathymetry, restrained organic currents, subtle mist at the perimeter only; no heavy clouds obscuring continents. Earthy moss, weathered stone, pale ivory snow, muted sand. No vivid green. No perspective tilt: full atlas top down, entire silhouette visible with original margins and canvas composition. No cropping.
Remove ALL lettering, names, map title plaque at bottom, compass symbols, legends, grid lines, political borders, scale, UI and decorative frames from the input. Repaint those areas as continuous ocean or terrain. Absolutely no text, no labels, no watermark or signature. Keep all land and coast geography intact while removing the text.
Output highest native resolution available, request 3840x2160 landscape, crisp and finely textured (do not blur or emulate pixelated source). This will be zoomed up to 3x in a web atlas; restore fine geographic surface detail without changing the shore outlines. The reference is an edit target/geographic constraint, not merely loose inspiration.
```
