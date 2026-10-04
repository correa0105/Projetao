# Objetos sobre o balcão — 04/10/2026

Adicionar um item ao balcão toca uma gravação correspondente ao material.
Os 71 itens ativos têm classificação explícita por ID. Metal ressoa ao tocar
a madeira; corrente, algemas e cota de malha assentam os elos; esferas de metal
caem e rolam. Vidro seco, madeira, papel, couro e tecido usam gravações próprias.
Nomes em português/inglês reconhecem os materiais de futuros itens.

Poções, ácido, fogo alquímico, antitoxina e óleo combinam contato delicado do
frasco com água se movendo. A batida de madeira foi retirada e o contato de
vidro teve ganho e agudos reduzidos, com ataque mais suave. O RMS dos primeiros
80 ms caiu de 0,31970 para 0,05774. A água mantém segmento, filtro, envelope,
ganho final e afinação anteriores; sua cauda continua idêntica byte a byte.
O cantil combina couro e água; a garrafa vazia recebe vidro sem líquido.

Peso físico e tamanho da ilustração aumentam intensidade e gravidade, com
níveis menores para materiais macios. A armadura de placas usa o peso total
do conjunto. Pequenas variações de afinação evitam um toque idêntico.

O som acontece nos dois casos de inclusão aceita: novo item ou aumento de
quantidade de um já colocado. Arrastar pelo balcão toca ao soltar somente se
houve mudança real de posição. Examinar, remover, cancelar arraste ou tentar
ultrapassar 99 unidades do mesmo item não toca impacto. O balcão aceita todos
os itens simultaneamente, inclusive sobrepostos; não existe bloqueio de mesa cheia.

`src/shop-counter-audio.ts` usa o canal Efeitos sonoros de `SiteMusic`, com
volume/mute independentes da música (docs/SOUND-SETTINGS.md), prepara
arquivos na interação e mantém um contexto Web Audio por visita. Carregamento
e decodificação são independentes por material: um arquivo indisponível não
silencia os demais nem interfere no carrinho. Há limite
de seis vozes e compressor para inclusões rápidas. Ocultar a aba ou sair da
loja cancela as vozes e encerra o contexto. Sons que ficam atrasados durante
carregamento não são repetidos ao voltar. As compras e o checkout não mudam.

Assets PCM mono, 48 kHz, 16 bits, pico máximo de 68%; os níveis próprios dos
materiais suaves não são normalizados até a intensidade da madeira:

- `public/audio/shop-counter-wood.wav`: impacto de madeira, 0,55 s.
- `public/audio/shop-counter-liquid.wav`: frasco leve e líquido, 1,08 s.
- `public/audio/shop-counter-waterskin.wav`: couro e líquido, 1,10 s.
- `public/audio/shop-counter-metal.wav`: ferro sobre madeira, 0,86 s.
- `public/audio/shop-counter-chain.wav`: corrente de aço, 0,76 s.
- `public/audio/shop-counter-spheres.wav`: esferas de aço caindo e rolando, 1,04 s.
- `public/audio/shop-counter-glass.wav`: vidro seco, 0,62 s.
- `public/audio/shop-counter-paper.wav`: papel, 0,66 s.
- `public/audio/shop-counter-leather.wav`: couro, 0,66 s.
- `public/audio/shop-counter-cloth.wav`: tecido, 0,68 s.
- `public/audio/shop-counter-manifest.json`: fontes CC0, hashes e composição.
- `scripts/generate-shop-counter-audio.mjs`: geração reproduzível com gravações reais.

As dez gravações originais são CC0. Links, autores, hashes das fontes e ganhos
finais ficam no manifesto. O conjunto final ocupa aproximadamente 751 KB.
Gerar novamente com as fontes verificadas produz os mesmos hashes.

`src/shop-presentation.ts` também cobre os 71 itens com comentários individuais
do mercador, inclusive os cinco cosméticos e o charuto que usavam o mesmo
modelo de frase. Onze falas mágicas receberam mais referências ao próprio
objeto. Conversas gerais, catálogo, preços, pesos e mecânicas não mudaram.

Validação: `node --import tsx --test tests/shop-counter-audio.test.ts` verifica
materiais, proporções, formatos, hashes, picos e preservação da água.
`tests/shop-merchant-comments.test.ts` verifica cobertura, independência dos
nomes recebidos e 71 comentários distintos.
`node scripts/smoke-shop-counter-audio.mjs` usa a UI real para examinar os 71
itens e colocar cada um no balcão, conferir arquivo/material, clique, Enter,
drop, movimento, falhas, sobreposição dos 71 itens, mute/volume, aba oculta, desmontagem e
carregamento pendente. Inclui falha de um arquivo com os demais funcionando.
`node scripts/test-shop-isolated.mjs` verifica o catálogo real, transações de
compra e layout responsivo em um PostgreSQL descartável.

Validação da revisão: seis testes focados passaram, assim como TypeScript,
build, navegador (71 falas e 71 inclusões com hashes dos dez WAVs efetivamente
decodificados) e fluxo de compras com API/banco isolados. Docker foi atualizado.
