# Expansão da House — 40 objetos (08/10/2026)

Pedido: criar quarenta objetos novos com qualidade e perspectiva das referências
do salão, cozinha, varanda e pátio. O catálogo acrescenta dez objetos inspirados
em cada ambiente, incluindo móveis, recipientes, livros, pergaminhos e estátuas.
As peças podem ser colocadas nos quatro ambientes; a sugestão não limita seu uso.

Cada modelo novo tem oito vistas reais (45°), feitas individualmente com image_gen
nativo e transparência. As vistas existentes dos dez móveis anteriores, carta e
quadro permanecem intactas. Nenhuma direção é uma rotação ou espelhamento do bitmap.
O modelo inicial de cada peça é a referência de identidade das sete outras vistas.

Arte de produção: `public/house/items/house-expansion-20261008/`.
Catálogo: `data/house-expansion-20261008.json`. Prompts, referências, hashes e
normalização estão em `art-manifest.json` junto das artes. Calibração separada
em `shared/house-expansion-sizes.json` mantém o tamanho físico ao trocar direção,
sem reescrever a calibração ou os layouts anteriores.

Madeira, pedra, metal, couro, lã e plantas seguem a câmera baixa e a luz discreta
dos ambientes. Objetos pequenos podem compor tampos através do posicionamento
manual já disponível. Compras, preços editáveis por administrador, presente,
ownership e persistência usam os fluxos existentes. Mobília ganha busca; Empório
já oferece busca e filtro de itens da House.

Estado: as 320 artes foram geradas, revistas e calibradas. Todas as oito vistas de
cada peça mantêm sua identidade, geometria e oclusão. As vistas retas de frente e
lado orientam a construção dos lados opostos. O manifest completo registra os
320 hashes nativos e os WebP de produção; 278 arquivos anteriores protegidos.
Aplicado no Docker local: 52 peças no catálogo, 40 novas. Todos os 320 WebP e 274
arquivos públicos anteriores servidos conferidos por hash, bundles e servidor
correspondem ao build; 44 tabelas completas preservadas, incluindo layouts,
compras, ouro, retratos, tokens e assets do VTT. Backup em
`.local/backups/before-house-expansion-20261008.dump`.

Regressão de 12 objetos antigos aprovada em banco descartável com o catálogo
expandido: compras, miniaturas da loja/inventário, colocação inicial, oito vistas
históricas, layouts com direção explícita/ausente, tamanho manual e recarga.
Composição antiga revista em 1440/768/390/320. TypeScript, Vite e tsup passaram.

Integração das 40 novas peças aprovada em banco descartável: 320 hashes servidos,
compras idempotentes, preços/permissões, ownership, miniaturas, busca sem acentos,
troca entre as oito direções, tamanho calibrado e salvamento/recarga. Quatro salas
em 1440/768/390/320 revistas, sem erros de página ou overflow horizontal. Scripts
`test-house-expansion-isolated.mjs` e `smoke-house-expansion.ts`.

Exportação entregue em `C:/Users/limaw/Downloads/House-40-pecas-320-vistas-20261008.zip`
(554.757.758 bytes). Contém os 320 PNGs nativos originais, agrupados em 40 pastas,
com vistas numeradas em sequência: frente, frente-direita, direita, trás-direita,
trás, trás-esquerda, esquerda e frente-esquerda. Extraia e abra `catalogo.html`
para ver cada grupo lado a lado; `manifest.json` contém nomes, direções, prompts
e hashes. ZIP conferido pelos 320 hashes; galeria offline carrega todas as
imagens, tem busca sem acentos e se adapta ao celular. Exportador reproduzível
em `scripts/export-house-expansion.mjs`; não sobrescreve arquivos existentes.
