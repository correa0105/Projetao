# Perspectiva dos objetos da guilda

Em **Guilda → Personalizar sede**, selecione a peça e abra **Ajustar perspectiva** no painel direito. Escolha primeiro a vista mais próxima da sala; **Fuga à esquerda/direita** orienta as duas arestas horizontais para a guia correspondente. Arraste os quatro cantos para refinar, com aderência opcional às linhas. Em **Calibrar as guias da sala**, ajuste o horizonte e os pontos de fuga. **Restaurar perspectiva** remove a deformação. **Salvar sede** guarda os cantos de cada peça e as guias de cada sala.

As guias iniciais são aproximadas e calibráveis. A transformação é projetiva sobre uma imagem 2D: não reconstrói geometria ou partes ocultas do móvel. Vista correta, posicionamento e escala continuam essenciais; deformações moderadas preservam melhor as pernas e o volume pintado.

O salto ao segurar o objeto vinha do `transform` global de botão pressionado, que substituía a âncora no chão. A regra específica preserva essa âncora. As setas de giro agora usam a caixa dos pixels visíveis, descontando margens transparentes, inclusive após mudar vista, tamanho, perspectiva ou largura da tela.

Os campos de perspectiva são opcionais no JSON existente e exclusivos da edição pelo dono. Não há migration, recálculo de posição ou alteração das artes originais. Testes: três casos de geometria/schema; dez casos PostgreSQL de guildas, economia e permissões; Edge em 1440, 768, 390 e 320 px para giro, clique segurado, arraste, quatro cantos, guias e persistência após recarga.
