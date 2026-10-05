# Reforma da Casa dos mascotes — 04/10/2026

Atualização de 05/10: riscos animados retirados, falas renovadas, dez aparências
clássicas v3 e ambas as corujas sem poleiro. Direção e prompts vigentes em
[PET-SHOP-REFINEMENT.md](PET-SHOP-REFINEMENT.md); as artes v2 abaixo são históricas.

Direção atual do usuário: refazer a página inteira, retirar o esqueleto, diminuir Garalho, colocar a placa nas patas e corrigir proporções e recortes de todos os mascotes. Substitui a composição anterior com Baguncinha no jardim.

O cenário ocupa somente o jardim superior, preservando as proporções da casa independentemente da altura do catálogo. Garalho usa duas poses pintadas com a placa integrada às patas: escreve por 2,5 s com movimento pequeno da pata/lápis, apresenta a placa em 480 ms e exibe a resposta na madeira. Não mover o gato inteiro como efeito de escrita. “Ler placa” abre a mesma mensagem ampliada. Os olhos separados, mochila mecânica, capa, miados, perguntas, compras, nomes e sons por espécie permanecem.

As dez espécies e sete aparências têm viewports individuais em src/pet-art.ts. SVG mantém xMidYMid meet e clipPath explícito no retângulo da silhueta. Só o viewBox não basta: em caixas largas, os vizinhos da prancha apareciam nas margens. Não restaurar células CSS iguais nem esticar imagens. O catálogo e o inventário usam o mesmo PetArt, preservando orelhas, patas e caudas. No cenário, larguras variam por espécie; sapo/rato não têm o tamanho de um cão. Selecionar um animal leva o jogador de volta ao jardim.

## Geração das artes

Validação: TypeScript e build; seis testes de contratos em PostgreSQL descartável;
Edge real com compras/aparências/inventário/miados/vozes e silenciar. SVG rasterizado
em caixas largas verifica que não há pixels de animais vizinhos nas margens e que
as silhuetas mantêm espaço até o corte. Comparação de pixels com/sem animal verifica
que o navegador o pinta no jardim após cada troca. Placa e overflow em 320/390/768 px,
com revisão visual dos screenshots e preferência de movimento reduzido respeitada.

Modo: ferramenta integrada image_gen (skill imagegen); não utilizado CLI/API. Todos os arquivos finais foram salvos em public/pets. PNGs preservam transparência. O fundo foi exportado em WebP com qualidade 94; artes anteriores v1 ficam preservadas.

### petshop_cottage_v2

Arquivo final: [public/pets/garalho-cottage-v2.webp](../public/pets/garalho-cottage-v2.webp).

Transparência: não. Referências: 1.

Prompt final:

```text
Use case: precise-object-edit. Edit target: supplied fantasy cottage painting. Remove completely the humanoid skeleton, its chair, coffee cup, saucer and every bone from outside the cottage. Replace their area with natural stone paving, low moss and a few small plants seamlessly continuing the existing garden. Preserve the charming large stone cottage, wooden arched door, curved grass roof, lantern light, dark forest, entire original composition and the detailed semi-realistic hand-painted medieval fantasy aesthetic. Broad warm lantern lighting over the empty foreground where small characters will stand. No people, no animals, no skeleton, no furniture, no lettering, no signs. Wide landscape game background, warm restrained earth tones, realistic painterly stone and wood, no bright outline halos.
```

### garalho_sign_ready_v2

Arquivo final: [public/pets/garalho-sign-ready-v2.png](../public/pets/garalho-sign-ready-v2.png).

Transparência: sim. Referências: 1.

Prompt final:

```text
Use case: identity-preserve. Asset: transparent full-body game character for an existing painted fantasy RPG website. Supplied image is the identity/design reference for GARALHO. Repaint this exact little black cat merchant: preserve his unusual WIDELY SEPARATED, slightly asymmetrical large golden eyes, short feline muzzle, black ears, battered russet-red cloak and tan high collar, green verdigris mechanical backpack with circular gauge and red top valve, wrapped little paws, curled tail. Keep premium detailed semi-realistic painted fantasy texture, natural cloth, fur, aged copper and soft warm lantern lighting. Change the pose: he now holds a broad rectangular wooden writing board across his chest with BOTH small black paws visibly gripping its left and right edges from the FRONT. The board is close to his body, clearly carried in his hands, absolutely not floating. The wooden board is fully blank, smooth dark warm walnut with visible subtle grain, no text, no marks, no carved lettering. Front-facing board nearly straight to camera so editable text can be rendered over it. Full body, paws, ears, tail, backpack and board completely inside the transparent canvas with at least 7 percent padding on every edge. Suggested composition: square canvas; cat ears around 12 percent of image height, feet around 91 percent; blank rectangular board around x17%-80%, y40%-65%. Board large enough for a few short handwritten sentences, but does not obscure cat face. Cat remains compact and feline, not humanoid-tall. No backdrop, no floor, no cast shadow, no outline glow, no extra characters. Genuine transparent background.
```

### garalho_sign_writing_v2

Arquivo final: [public/pets/garalho-sign-writing-v2.png](../public/pets/garalho-sign-writing-v2.png).

Transparência: sim. Referências: 1.

Prompt final:

```text
Use case: identity-preserve. Edit target: supplied transparent full-body GARALHO holding a wooden board. Produce the WRITING pose frame for the same character animation. Preserve EXACT same canvas dimensions, identity, widely separated asymmetrical golden eyes, cat body size and position, ears, feet, tail, clothes, mechanical backpack, lighting, painting detail, and wooden board size/location. Do not zoom, reframe, add padding or move his body. Only change his small forepaws and head subtly: left paw grips the board; right paw holds a short wooden pencil touching the board near its upper-right middle. His head tilts gently downward to follow the pencil, still unmistakably the same cat, ears and eyes visible. The board tilts gently toward him as he writes, still supported close to his chest by the paws. We see unmarked wood; absolutely no text or scratches painted on the board, text is animated by code. Same full body, natural compact feline proportions, same palette and actual transparent background. No scene, no glow, no shadows outside subject, no extra objects or characters.
```

### pets_atlas_v2

Arquivo final: [public/pets/animals-v2.png](../public/pets/animals-v2.png).

Transparência: sim. Referências: 1.

Prompt final:

```text
Use case: precise-object-edit. Repaint the supplied transparent animal sprite sheet for a high quality medieval fantasy RPG website. Preserve exactly each animal's species, markings, distinctive design and position/order on the sheet. Improve natural anatomy and muted painted texture; restrained warm light, no bright glowing rims or cartoon outlines. CRUCIAL: every animal must be COMPLETELY visible with entire ears, tail, wings, feet and perch, surrounded by GENEROUS transparent empty margins. Continuous empty corridors separate all cells horizontally and vertically. Each animal occupies AT MOST 70% of its cell width and 75% of its cell height; do not enlarge animals to fill cells. No clipping at image boundaries, no parts crossing into neighboring cells, no text, background, frames, grid, floor or large cast shadows. Natural proportions, do not stretch the species to a tall portrait shape. Actual transparent background. EXACT FIVE columns and TWO rows, ten animals. Top row: golden-brown friendly dog sitting, gray tabby cat sitting, cream rabbit with tall ears, brown owl with short branch, red fox sitting with entire curling tail. Bottom row: black raven standing on small branch, olive-green frog, earth-brown nonvenomous snake coiled with closed mouth, natural small gray rat with ENTIRE long bare tail, chestnut-and-white guinea pig. Keep all ten well-separated and centered inside independent equal cells.
```

### pets_variants_a_v2

Arquivo final: [public/pets/variants-a-v2.png](../public/pets/variants-a-v2.png).

Transparência: sim. Referências: 1.

Prompt final:

```text
Use case: precise-object-edit. Repaint the supplied transparent animal sprite sheet for a high quality medieval fantasy RPG website. Preserve exactly each animal's species, markings, distinctive design and position/order on the sheet. Improve natural anatomy and muted painted texture; restrained warm light, no bright glowing rims or cartoon outlines. CRUCIAL: every animal must be COMPLETELY visible with entire ears, tail, wings, feet and perch, surrounded by GENEROUS transparent empty margins. Continuous empty corridors separate all cells horizontally and vertically. Each animal occupies AT MOST 70% of its cell width and 75% of its cell height; do not enlarge animals to fill cells. No clipping at image boundaries, no parts crossing into neighboring cells, no text, background, frames, grid, floor or large cast shadows. Natural proportions, do not stretch the species to a tall portrait shape. Actual transparent background. EXACT TWO columns and TWO rows. Top left full-body standing black-and-tan German shepherd with upright ears and complete tail; top right orange long-haired cat, gold eyes, tufted ears, cream mane, reddish markings and completely visible curled bushy tail. Bottom left white rabbit with subtle gray arcane spirals/rune markings and gold eyes; bottom right gray/white great horned owl, orange eyes, black-orange ear tufts, fine feather barring, perched on short wooden stump. Keep distinguishing designs from reference, with natural painterly detail and more restrained color saturation. Entire curly cat tail and entire rabbit ears/feet stay inside their cells with clear transparent margins.
```

### pets_variants_b_v2

Arquivo final: [public/pets/variants-b-v2.png](../public/pets/variants-b-v2.png).

Transparência: sim. Referências: 1.

Prompt final:

```text
Use case: precise-object-edit. Repaint the supplied transparent animal sprite sheet for a high quality medieval fantasy RPG website. Preserve exactly each animal's species, markings, distinctive design and position/order on the sheet. Improve natural anatomy and muted painted texture; restrained warm light, no bright glowing rims or cartoon outlines. CRUCIAL: every animal must be COMPLETELY visible with entire ears, tail, wings, feet and perch, surrounded by GENEROUS transparent empty margins. Continuous empty corridors separate all cells horizontally and vertically. Each animal occupies AT MOST 70% of its cell width and 75% of its cell height; do not enlarge animals to fill cells. No clipping at image boundaries, no parts crossing into neighboring cells, no text, background, frames, grid, floor or large cast shadows. Natural proportions, do not stretch the species to a tall portrait shape. Actual transparent background. EXACT TWO columns and TWO rows. Top left full-body black raven with soft violet-gray feather sheen and entire beak, tail and feet. Top right olive-green coiled fantasy snake with S-curved tall neck, open mouth and visible fangs, ENTIRE head, coils and pointed tail. Bottom left fluffy long-haired white/smoky-gray rat with round black eyes, pink ears and ENTIRE curved bare pink tail. Bottom right cell is completely empty transparent. Preserve all identifying reference designs. All three complete animal silhouettes must have generous transparent space away from every cell edge.
```
