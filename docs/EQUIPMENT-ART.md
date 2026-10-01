# Artes de equipamentos — 01/10/2026

## Acessórios independentes — versão vigente

Luvas cosméticas, colar, tiara e charuto foram refeitos por pedido do usuário,
com a ferramenta integrada ImageGen e sem imagens de referência. Esses objetos
não pertencem à identidade visual da full plate. Arquivos transparentes em
`public/shop/equipment/`; o catálogo aponta para as versões v2, evitando cache
das imagens antigas. IDs dos itens, compras e equipamentos já possuídos permanecem.

| Arquivo vigente | Subject usado no prompt |
| --- | --- |
| cosmetic-gloves-v2.png | a matched pair of ordinary soft dark brown leather adventurer gloves, supple leather fingers, hand sewn stitching and modest leather cuffs with simple leather fastening, entirely leather, practical everyday clothing |
| cosmetic-necklace-v2.png | a delicate silver necklace with a small oval blue gemstone pendant in a simple polished silver setting on a fine silver chain, elegant civilian jewelry |
| cosmetic-tiara-v2.png | a slim delicate silver tiara with a small central blue gemstone, airy understated civilian jewelry with thin curved silver wire, no heavy ornamental crown |
| cigar-v2.png | a single natural hand rolled tobacco cigar, rich brown tobacco leaf wrapper with visible organic veins, a tiny ember at one tip and a wispy curl of smoke, plain tobacco throughout without any band, casing or decoration |

Prompt completo por arquivo, substituindo `{subject}` pela coluna acima:

> Create an independent medieval fantasy RPG inventory cutout asset of {subject}. Semirealistic painterly item illustration, finely rendered natural materials, three-quarter view, clearly readable silhouette at thumbnail size. Draw only the item or matched pair, centered and occupying approximately 80 percent of a square canvas, on a truly transparent alpha background. This is an ordinary standalone accessory, with its own design. No armor, armored metal plates, military design, gold brass edging, gold rivets, fleur-de-lis motifs or matching suit emblems. No person, mannequin, hands holding the object, extra objects, text, logo, frame, scenery or ground shadow.

## Peças de placas e histórico da primeira versão

Geradas com a ferramenta integrada ImageGen, usando `public/shop/items/plate-armor.png`
como referência visual. Nove PNGs 1254 × 1254 com alfa real, inspecionados sobre fundo
escuro. Arquivos em `public/shop/equipment/`; nenhuma chave/API externa foi utilizada.
Não são sobrepostos à imagem do personagem: o gerador recebe cada peça selecionada
como referência para desenhá-la no personagem. Capa e botas cosméticas reutilizam
as artes existentes da loja; seus registros novos não possuem efeitos mágicos.

As cinco peças de placas abaixo continuam vigentes. Os quatro acessórios sem
`-v2` são somente versões históricas, substituídas pelas artes independentes acima.

| Arquivo | Subject usado no prompt |
| --- | --- |
| plate-helmet.png | a closed medieval helmet with an articulated visor |
| plate-bracers.png | a matched pair of armored forearm bracers attached to articulated metal gauntlet gloves, shown as a pair |
| plate-leggings.png | a matched pair of full plate thigh and knee guards, articulated armored trousers, shown as a pair |
| plate-boots.png | a matched pair of plated greaves and armored boots with overlapping steel toe plates, shown as a pair |
| plate-pauldrons.png | a matched pair of layered rounded full plate shoulder pauldrons, detached from the breastplate, shown as a pair |
| cosmetic-gloves.png | a pair of dark brown leather adventurer gloves, no metal plating |
| cosmetic-necklace.png | a delicate aged brass necklace with a small blue gemstone pendant |
| cosmetic-tiara.png | a slender aged brass medieval tiara with a small blue central gemstone, no helmet |
| cigar.png | a single short hand-rolled brown cigar with a glowing ember and a tiny curl of smoke, medieval fantasy tavern accessory |

Prompt completo por arquivo, substituindo `{subject}` pela coluna acima:

> Transform the supplied armor reference into a new separate inventory item asset: {subject}. The source is a VISUAL STYLE and matching material reference. For the five plate armor pieces retain precisely the same slightly worn silver-gray steel, aged gold brass edging, gold rivets, engraved fleur-de-lis motifs and craftsmanship as the reference, so it belongs to the identical suit. For leather or jewelry or cigar retain the same semirealistic painterly RPG inventory rendering and warm soft highlights, with appropriate item materials. Draw ONLY the requested item or matched pair, detached, centered, occupying 80% of a square canvas. Three-quarter view, strong readable silhouette at small size. True transparent alpha background. No mannequin, person, torso armor, extra unrelated armor pieces, text, labels, frame, ground shadow or backdrop. Output a polished game inventory cutout PNG.
