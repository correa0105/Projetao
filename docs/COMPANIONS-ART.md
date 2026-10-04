# Arte dos mascotes, eventos, cartas e Lore

Gerada com a skill imagegen e a ferramenta nativa, sem alterar as referências originais. Modo com referências para Garalho, casa, variantes e Anfitrião; geração nova para atlas clássico, salão de Eventos, panorama da Lore e artes das cartas. PNG transparente para personagens/animais; fundos e cartas opacos exportados em WebP com Sharp, sem redesenho ou mudança de composição. Originais permanecem no diretório de imagens geradas do Codex.

## Arquivos ativos

- `public/pets/garalho-v1.png`: gato da referência, olhos afastados e assimétricos preservados; capa vermelha, mochila mecânica e lápis na pata.
- `public/pets/garalho-cottage-v1.webp`: casa e Baguncinha sentado, tomando café.
- `public/pets/animals-v1.png`: cinco colunas e duas linhas; cão, gato, coelho, coruja, raposa / corvo, sapo, cobra, rato, porquinho-da-índia.
- `public/pets/variants-a-v1.png`: duas colunas e duas linhas; pastor, gato de pelo longo / coelho rúnico, coruja de olhos âmbar.
- `public/pets/variants-b-v1.png`: duas colunas e duas linhas; corvo, serpente esmeralda / rato de pelo longo, vazio.
- `public/events/hall-v1.webp`: salão medieval dos encontros.
- `public/cards/moonlit-room-v1.webp`: Anfitrião sentado junto à janela sob meia luz.
- `public/cards/arcana-art-v1.webp`: quatro colunas e duas linhas, correspondentes ao catálogo em shared/cards.ts.
- `public/lore-world-v1.webp`: panorama de mundo, mares, reinos, florestas e terras distantes.

Referências fornecidas pelo usuário preservadas em `docs/references/companions/`. A pintura de Gina foi usada só como guia de acabamento para os animais; as características dos animais vieram das referências próprias.

## Briefings anteriores

Garalho: recriar o gato preto da referência em pintura de fantasia detalhada, corpo inteiro, fundo transparente, mantendo os olhos dourados bem separados e assimétricos, capa vermelha e mochila verde com válvula e relógio. Pata segurando lápis; sem placa ou texto na própria ilustração. Casa: reimaginar a moradia de pedra com teto coberto de vegetação, bosque escuro e luz âmbar; Baguncinha, esqueleto humanoide, sentado em cadeira do lado de fora, segurando café junto à boca e pires no colo. Espaço escuro à esquerda para o catálogo, sem gato embutido. Atlas clássico: dez animais inteiros independentes, cinco colunas e duas linhas, fundo transparente e margem entre células, pintura detalhada com luz quente discreta e cores naturais dessaturadas.

## Prompts enviados nesta etapa

### Aparências dos animais — atlas A e B

```text
Transparent background premium detailed semi-realistic painted fantasy game sprite atlas, EXACT TWO columns and TWO rows of equal size, square overall composition. Each independent full-body animal centered in its cell with generous transparent padding, entire ears, tails, feet visible. NO backgrounds, grid, frames, text, signature, floor or cast shadows, no animal crossing cell boundaries. Cohesive with the LAST supplied reference: natural detailed fur, feather and scale texture, muted earth palette, soft warm rim light and deep painterly shadows. Reimagine supplied animal references, preserving their exact identifying designs and unusual features while translating the flat artwork to the site's high-detail painterly style. First FOUR supplied images are animal design references. TOP LEFT: full-body standing black-and-tan German shepherd, black saddle, upright ears, pink tongue, entire curved tail. TOP RIGHT: standing orange long-haired cat with tufted ears, gold eyes, cream mane, reddish spotted/striped markings and luxurious curling bushy tail. BOTTOM LEFT: white rabbit with gold eyes, subtle pale-gray arcane spirals and rune markings in fur across flank and forehead. BOTTOM RIGHT: pale gray/white great horned owl with tall black-orange ear tufts, fiery orange eyes, fine black feather barring, folded wings, perched on a short isolated wooden stump.
```

Fundo transparente: sim. Referências: 5.

```text
Transparent background premium detailed semi-realistic painted fantasy game sprite atlas, EXACT TWO columns and TWO rows of equal size, square overall composition. Each independent full-body animal centered in its cell with generous transparent padding, entire ears, tails, feet visible. NO backgrounds, grid, frames, text, signature, floor or cast shadows, no animal crossing cell boundaries. Cohesive with the LAST supplied reference: natural detailed fur, feather and scale texture, muted earth palette, soft warm rim light and deep painterly shadows. Reimagine supplied animal references, preserving their exact identifying designs and unusual features while translating the flat artwork to the site's high-detail painterly style. First THREE supplied images are design references. TOP LEFT: glossy black raven standing full body, entire tail/feet, smoky-gray and purplish feather sheen. TOP RIGHT: olive green coiled viper with high long S-curved neck, open mouth and fangs, entire coils and pointed tail, subtle amber light along scales; preserve reference design as a fantasy companion. BOTTOM LEFT: unusually fluffy long-haired white/smoky-gray rat with black round eyes, pink ears, full body and long curved bare pink tail, silky fine fur. BOTTOM RIGHT: absolutely empty transparent cell. No cartoon black outlines.
```

Fundo transparente: sim. Referências: 4.

### Salão dos eventos

```text
Create a premium high-detail semi-realistic painted fantasy background for the Alvorada Cinzenta RPG EVENTS page. Wide cinematic 16:9 composition: an imposing medieval guild celebration hall at blue-hour dusk, deep dark stone, carved walnut beams, aged bronze/copper details, candle chandeliers centered high in the hall, tall arch windows on the far RIGHT opening to twilight mountain fortress and a few delicate distant sky fireworks, long festival banners in muted midnight blue and copper. On the right-middle an impressive old bronze astronomical armillary sphere with gilded mechanisms beside a candlelit medieval table, flowers and sealed scrolls, tactile materials and atmospheric haze. Lower left and middle-left should be deliberately dark quiet uncluttered space for readable event text overlays. Elegant immersive oil-painted fantasy realism matching detailed RPG shop and stable backdrops, restrained gold lighting, deep shadows, no bright green, no cartoon shapes, no UI, no typography, no writing, no logos, no people or humanoids. Full-bleed page background, artistically rich but restrained, environment tells a story of a gathering about to begin.
```

Fundo transparente: não. Referências: 0.

### Sala das cartas e panorama da Lore

```text
Reimagine the supplied character as a restrained, mysterious seated host in a premium semi-realistic dark fantasy RPG environment. Wide cinematic 16:9 FULL PAGE BACKGROUND, nighttime. Preserve his elegant black top hat, dark feathered cloak, gloves, pale partly shadowed face, small luminous golden eyes and formal blue/black outfit. He is SMALL IN THE DISTANCE at x72%, y60%, seated naturally in a luxurious carved walnut and velvet armchair beside a GREAT arched glass window at the right. Moonlight streams through the glass and illuminates ONLY HALF of his face/body; the rest blends into the shadow, not a brightly lit foreground portrait. Large elegant moonlit medieval study with dark blue and warm aged copper tones, rich carved wood, velvet, a few candles, shelves and a card table, nocturnal sky outside glass. Left 45% and bottom-left deliberately quiet dark low-detail space to overlay card management UI. Host is clearly legible when looking toward him but enigmatic and tucked back. Detailed painterly material texture and natural anatomy, matching premium painted fantasy shop/stable backgrounds. No cartoon outlines, no electric neon, no user interface, text, numbers, logos or watermarks. Do not duplicate host or floating hands; exact one seated person. The image is the environment containing the host, not a cutout.
```

Fundo transparente: não. Referências: 1.

```text
Create an expansive cinematic 16:9 illustrated world panorama for the LORE cover of Alvorada Cinzenta fantasy RPG. Premium highly detailed semi-realistic painted fantasy environment, deep atmospheric perspective, muted midnight blue and warm aged copper, stone gray, desaturated moss greens. The whole world feels vast and varied: foreground edge of an ancient carved stone overlook with a weathered closed manuscript and small brass astrolabe low at the right, immense central sea with distant sailboats and rocky islands, several faraway lands with blue mountain ranges and tall peaks, distant walled kingdom, dense shadowy forest, terraced valleys, one hazy arid landscape at far right. A dramatic dawn sky with layered clouds suggests ancient eras and unexplored history. Balanced unified believable world panorama, not a collage, no globe, no literal parchment map, no giant creature, no tentacle, no stable or single shop. Top and lower middle must have dark calm space for website heading. The world itself is the subject, contrasting civilizations and mysteries subtly in a cohesive epic landscape. Painterly tactile premium fantasy game quality, refined subdued palette, no bright green. Full bleed, no borders, UI, lettering, signs, labels, watermarks or logo.
```

Fundo transparente: não. Referências: 0.

### Artes das oito cartas

```text
Create a premium detailed fantasy RPG card-art sprite atlas with EXACT FOUR COLUMNS and TWO ROWS, eight equally sized rectangular panels arranged seamlessly. Wide 2:1 overall image. Each panel is a DIFFERENT dark cinematic semi-realistic painted fantasy illustration to be cropped as the art within a collectible card, NO TEXT, NO LETTERING, NO NUMBERS, NO card borders, NO logos or frames. Cohesive restrained night-blue, old copper and parchment palette, tactile realistic oil painting quality, moonlight/warm light details. Exact assignment TOP ROW left-to-right: (1) a small burning candle protected in a heavy old bronze lantern in a stormy medieval alley, (2) a majestic raven with smoky black feathers under moonlight on a ruined arch, (3) a shattered old hand mirror with moonlit silver shards and subtle mist, (4) an enormous silver moon above night mountains with a small traveler silhouette. BOTTOM ROW: (5) tangled roots of a huge ancient oak with delicate gold runes and old moss, (6) worn copper anchor beside deep ocean waves in moonlight, (7) dark steel sword catching a sharp line of light, on antique cloth, (8) an empty carved noble throne half illuminated by moonlight. Center the main subject clearly INSIDE each cell, no objects crossing boundaries. These must feel like elegant illustrated game artifacts from the same medieval fantasy world, not cartoon icons or photographs. Each cell has a quietly dark upper and lower edge to allow overlays in the website later.
```

Fundo transparente: não. Referências: 0.
