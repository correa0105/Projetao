# Insígnias com armas e ferramentas em camadas — 19/10/2026

As 32 artes com objetos cruzados usam duas imagens de armas/ferramentas completas atrás de um núcleo separado, sem fragmentos das armas anteriores. Cabo, guarda, haste e lâmina pertencem ao mesmo arquivo. A rotação de −45°/+45° atua na peça inteira, no mesmo centro, conservando a continuidade mesmo no trecho oculto pelo emblema.

Artífice e Bárbaro: cinco estágios cada; Guerreiro e Ladino: cinco cada; Patrulheiro: cinco; segundo estágio de Bruxo, Clérigo, Druida, Feiticeiro, Mago, Monge e Paladino. Os outros 33 desenhos não contêm esse par cruzado e mantêm as ilustrações próprias. Número e marcadores continuam cobrindo os 20 níveis de cada uma das 13 classes, sem mudar regras ou dados de personagens.

`src/LayeredClassBadge.tsx` monta as peças no DOM. `shared/class-badge-layers.json` define os núcleos, ferramentas e escalas. As 46 camadas finais (32 núcleos e 14 ferramentas) estão em `public/sheet/badge-parts-20261019/`, WebP de 640 px com alfa real. As 65 ilustrações completas de base estão em `public/sheet/level-badges-v2-20261019/`.

Ferramenta usada: ImageGen embutido, com uma geração/edição por componente. Prompts completos por peça, fontes nativas, URLs e hashes de origem/saída estão em `data/class-badge-layer-art-20261019.json`. O pedido de edição dos núcleos remove apenas os dois objetos cruzados, conservando o motivo central e os ornamentos; os prompts das ferramentas pedem uma peça inteira vertical, centrada e transparente, pronta para girar atrás do núcleo. Originais de geração preservados.

`scripts/prepare-class-badge-layers.mjs --require-complete` valida transparência e produz os arquivos e o mapa. `node --import tsx scripts/review-layered-class-badges.ts` confere os 260 estados, 128 estados em camadas, carregamento de todas as imagens, duas ferramentas por núcleo e transformações sem deslocamento. Capturas ampliadas, de todos os níveis e móvel estão em `test-results/class-badge-layers/`. Revisão visual das 32 montagens aprovada; Artífice usa escala própria para manter as cabeças das ferramentas inteiras no enquadramento. TypeScript e build do cliente aprovados.

Publicação `class-badge-layers-20261019` saudável. Cliente compilado a partir da versão publicada `56958066` com os arquivos desta correção; alterações independentes do checkout não entram no pacote. 202 arquivos publicados conferidos por hash e HTTP; 16.466 arquivos anteriores preservados. Código do servidor idêntico e nenhuma tabela alterada na comparação integral antes/depois. Resultado em `test-results/class-badge-layers/deployment.json`.

## Revisão dos lobos

As quatro cabeças do Bárbaro (estágios 2–5) e as cinco do Hunter/Patrulheiro foram redesenhadas com ImageGen embutido. O Bárbaro usa lobo cinzento com focinho canino definido, olhos âmbar e pelagem volumétrica; o estágio final conserva a pintura vermelha da testa, com rosto natural em lugar da máscara esquelética. O Hunter conserva o relevo dourado, agora com anatomia de lobo, focinho e pelagem modelados, em lugar da máscara angular anterior. Escudos, motivos de cada estágio e armas em camadas continuam presentes.

As nove novas imagens estão em `public/sheet/badge-parts-20261019/core-{barbarian,ranger}-*-wolf-v2.webp`; nomes novos evitam reutilizar a imagem anterior em cache. Prompts completos, fontes, hashes e versões anteriores ficam em `data/class-badge-layer-art-20261019.json`. O preparo respeita o nome versionado e reutiliza camadas cujos hashes já foram conferidos. Comparação de manifests confirma que somente esses nove núcleos mudaram; as outras 37 camadas permanecem iguais.

Revisão visual das nove montagens, 260 estados de nível, carregamento/transformações, TypeScript e build aprovados. Prévia em `test-results/class-badge-layers/wolf-refit.png`. Publicação `wolf-refit-20261019` saudável: 202 arquivos conferidos por hash/HTTP, 16.509 arquivos anteriores preservados, servidor idêntico e nenhuma tabela alterada. Resultado em `test-results/class-badge-layers/wolf-deployment.json`.
