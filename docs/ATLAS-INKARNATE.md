# Acabamento do Mundo — 30/09/2026

Pedido: transformar o mapa visto de cima em cartografia realista inspirada no Inkarnate. Arte criada com imagegen integrado, usando `public/atlas-world-v2.png` como alvo de edição. Saída nativa 1672 × 941, conservada sem ampliação e codificada como `public/atlas-world-inkarnate-v1.webp`.

A nova arte é aplicada às coordenadas UV da malha de relevo existente. Máscara, biomas e alturas continuam derivados da fonte V2: a arte não redefine territórios ou costa. Permanecem oceano procedural, nuvens, arraste, zoom e seleção dos 22 territórios. O carregamento usa limite de oito segundos e conserva cores procedurais se a textura falhar; a textura é liberada no descarte.

## Prompt final

```text
Use case: style-transfer. Edit target: supplied world atlas. Transform its rendering into a highly detailed realistic fantasy world map inspired by Inkarnate's premium realistic cartography. STRICTLY preserve exact coastline silhouettes, positions, proportions, all islands, inland seas, channels, southwest concentric island formation, mountain range locations and biome placement. Entire original composition viewed directly from above, no perspective tilt. Finely painted natural terrain, coherent craggy grey mountain ridges with subtle shadows, individually detailed dark moss forests, muted olive grassland, warm weathered sand deserts, pale glacier ice, fine river networks, clear richly textured deep midnight-blue ocean and turquoise shallow shorelines. Sophisticated hand-painted geographic realism, subtle organic cartographic texture, high detail suitable for zoom. No parchment frame or border; map fills entire canvas. No labels, lettering, icons, compass, settlements, UI, watermark. Do not invent or move land. Retain original framing and aspect ratio. Request highest available native resolution 3840x2160.
```

## Validação

Build TypeScript/cliente/servidor aprovado via Docker Compose. Smoke mundial com ATLAS_BROWSER_GPU=1 aprovado em Edge/NVIDIA, desktop 1440 × 900 e celular 390 × 844: zoom, pan, retorno elástico, reset, territórios e entrada/retorno do reino. Capturas world-relief-detail-desktop.png e world-relief-home-mobile.png inspecionadas. Nenhuma missão publicada.

