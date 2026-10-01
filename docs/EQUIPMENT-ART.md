# Artes de equipamentos — 01/10/2026

Geradas com a ferramenta integrada ImageGen, usando `public/shop/items/plate-armor.png`
como referência visual. Nove PNGs 1254 × 1254 com alfa real, inspecionados sobre fundo
escuro. Arquivos em `public/shop/equipment/`; nenhuma chave/API externa foi utilizada.
Não são sobrepostos à imagem do personagem: o gerador recebe cada peça selecionada
como referência para desenhá-la no personagem. Capa e botas cosméticas reutilizam
as artes existentes da loja; seus registros novos não possuem efeitos mágicos.

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
