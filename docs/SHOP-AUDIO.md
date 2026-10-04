# Objetos sobre o balcão — 04/10/2026

Adicionar um item ao balcão toca um impacto curto de madeira. A intensidade
cresce com o peso físico e o tamanho da ilustração; objetos grandes também
soam mais graves. A armadura de placas usa o peso total do conjunto.

Poções, cantis, óleos e frascos recebem outro efeito: recipiente apoiado na
mesa e líquido se movendo por dentro. O reconhecimento usa categoria e nomes
do catálogo em português/inglês, sem alterar informações ou preços dos itens.
Pequenas variações de afinação evitam repetir um toque idêntico.

O som acontece nos dois casos de inclusão aceita: novo item ou aumento de
quantidade de um já colocado. Arrastar pelo balcão toca ao soltar somente se
houve mudança real de posição. Examinar, remover, cancelar arraste ou tentar
adicionar em uma mesa cheia/no limite de 99 unidades não toca impacto.

`src/shop-counter-audio.ts` usa o mesmo volume/mute de `SiteMusic`, prepara
arquivos na interação e mantém um contexto Web Audio por visita. Há limite
de seis vozes e compressor para inclusões rápidas. Ocultar a aba ou sair da
loja cancela as vozes e encerra o contexto. Sons que ficam atrasados durante
carregamento não são repetidos ao voltar. As compras e o checkout não mudam.

Assets PCM mono, 48 kHz, 16 bits, pico de 68%:

- `public/audio/shop-counter-wood.wav`: impacto de madeira, 0,55 s.
- `public/audio/shop-counter-liquid.wav`: recipiente e líquido, 1,08 s.
- `public/audio/shop-counter-manifest.json`: fontes CC0, hashes e composição.
- `scripts/generate-shop-counter-audio.mjs`: geração reproduzível com gravações reais.

Fontes: Wooden Thud de Breviceps, Bottle hitting a table de TheMikirog e
Water Slosh in Metal Bottle de twinpix. Links e licenças ficam no manifesto.

Validação: `node --import tsx --test tests/shop-counter-audio.test.ts` verifica
proporções, formatos, hashes e picos; `node scripts/smoke-shop-counter-audio.mjs`
usa a UI real para clique, Enter, drop, movimento, falhas, limites, mute/volume,
aba oculta, desmontagem e carregamento pendente. `node scripts/test-shop-isolated.mjs`
passou com o catálogo de 71 itens, transações de compra e layout responsivo.
