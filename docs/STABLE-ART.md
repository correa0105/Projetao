# Cenário e contato com o chão do estábulo

Arte ativa: `public/stable/paddock-camp-v2.webp`. Gerada com o imagegen integrado em 02/10/2026, usando `public/character-camp-v2.png` como referência de geografia e pintura e `public/stable/paddock-eye-level.png` como referência de composição. O PNG gerado foi convertido para WebP com qualidade 92. Nenhum animal está embutido no fundo.

A vista representa uma interpretação de outro ângulo do mesmo vale: grupo de picos recortados, ponte de pedra sobre o rio/lago e cidade fortificada no promontório direito. O primeiro plano é terra pisada, com grama nas bordas, para receber as montarias.

`MountArt` mede a borda inferior opaca de cada sprite em um canvas pequeno, ignorando halos transparentes, e coloca sombras de contato nos cascos. O resultado é armazenado por imagem, incluindo pelagens, selas e bardas. Uma sombra projetada suave e a tonalidade das montarias acompanham a luz do cenário sem deformar o desenho do animal.

## Prompt utilizado

Create a replacement stable paddock background for a medieval realistic RPG website, wide landscape 16:9 composition. Image 1 is the strict geography and artistic reference: same distinctive jagged snow-touched mountain silhouette, the same lake/river valley, the same multi-arch stone bridge across the water leading to the same compact fortified medieval city on the rocky promontory to the right. Image 2 is the layout reference: stable building at the far left edge, open dirt paddock occupying lower 45 percent, rail fence at the middle distance, distant valley behind. Reimagine as a viewpoint a short distance to the side of the camp in image 1, looking back at the SAME real landscape from a slightly different angle, not an unrelated generic mountain panorama. Preserve the peak group anatomy and city towers from image 1, with believable clustered stone/timber houses, walls, gates, a rising road from the bridge to the city, correct atmospheric scale, not enormous isolated towers or fantasy spires. Bridge MUST be clearly visible in the gap between mountains and city crossing the river with three to four arches. Early dusk light, warm muted light from upper left, cool gray blue mountains, restrained warm lamps in the stable. Natural dark brown trampled dirt in foreground for horse hooves, green grass at the edges and fence, avoid bright orange ground. Camera at human eye height, ground plane suitable for standing horses, wide open calm foreground in center and right, no animals, no people, no UI/text/logos. Cinematic realistic painted materials matching the camp image, detailed natural perspective and soft atmospheric depth.

## Validação

`scripts/test-stable-isolated.mjs` verifica compras e persistência em banco descartável, variantes de montarias/equipamentos, sombras de contato e seis viewports de 320×740 a 1920×1080. Capturas desktop e celular revisadas visualmente.
