# Balcão livre e proporções dos objetos — 04/10/2026

O balcão aceita todos os 71 itens simultaneamente. Arrastar do catálogo,
reposicionar com mouse/toque e mover com as setas permitem sobreposição.
A validação de colisões e o aviso de mesa cheia foram removidos.
As posições continuam limitadas à área do tampo. Arrastar conserva o ponto
onde o objeto foi agarrado, evitando que ele salte para centrar no ponteiro.

Cada item guarda uma camada visual. Inclusão, seleção, foco pelo teclado e
início de arraste trazem o objeto para a frente sem reordenar o DOM. O botão
**Localizar no balcão** de cada linha do carrinho fecha o diálogo, seleciona,
eleva, foca e rola até o objeto, mesmo quando está totalmente coberto.
A rolagem respeita a preferência de movimento reduzido.

`src/shop-item-scale.ts` usa o tamanho projetado da ilustração, comprimido
entre 0,55 e 1,70 vezes a base responsiva. Anéis são menores que frascos,
frascos menores que adagas e espadas; arcos e cajados ficam maiores. Peso,
preço e categoria mágica não determinam o tamanho visual. Os novos itens
recebem fallback pela categoria. As miniaturas do catálogo preservam suas
dimensões anteriores.

Arte e alvo de toque têm medidas separadas: o alvo mínimo é 48 px, enquanto
a arte pequena mantém sua proporção. Uma sentinela mede a base definida pelo
CSS; o mesmo cálculo fornece o tamanho desenhado e as coordenadas do arraste.
Um ResizeObserver atualiza medidas ao redimensionar. Até 1100 px, a superfície
aproveita mais 32 px do tampo, permitindo diferenças de tamanho no celular.

Itens repetidos permanecem agrupados com o contador de quantidade. Preços,
saldo, limite transacional de 99 unidades por item, idempotência e o Orbe do
Dragão sem preço seguem as regras de compra existentes.

Validação: `tests/shop-item-scale.test.ts` cobre os 71 IDs e as proporções.
`scripts/smoke-shop-layout.mjs` testa sobreposição completa, camadas, localização,
arraste, teclado, limites do tampo, redimensionamento e dimensões desktop/celular.
`scripts/smoke-shop-counter-audio.mjs` verifica som em cada inclusão sobreposta.
`scripts/test-shop-isolated.mjs` verifica compras e o catálogo real em banco
PostgreSQL descartável; nunca executar o smoke direto no banco de produção.

Validação concluída: dez testes focados, TypeScript, build, áudio e layout
no Edge passaram. Desktop e celular receberam os 71 itens no mesmo centro,
sem erros de página ou overflow. Capturar pela borda e mover 8 px manteve
o deslocamento de 8 px. O smoke com banco isolado passou incluindo compras,
saldo, idempotência, carrinho e onze tamanhos de tela.
Docker reconstruído e atualizado; healthcheck e bundle servido confirmados.
