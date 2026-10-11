# Barreira arcana que se molda — 11/10/2026

O escudo passa de um atlas de 32 quadros a uma membrana contínua de 384 × 384 pixels. A silhueta cresce, encolhe e se deforma; três brechas abrem e cicatrizam em fases diferentes. As aberturas atravessam também o contorno e revelam o fundo. As bordas enroladas têm espessura, reflexo e sombra; luz rasante e dobras suaves dão volume à bolha. O centro permanece transparente sobre o personagem.

O ciclo de 5,6 segundos é periódico, com o mesmo estado físico nos passes atrás/frente. Há um contexto WebGL compartilhado e duas superfícies limitadas; Canvas 2D fornece uma alternativa quando a GPU está indisponível. Mantidos ID `arcane-barrier`, tamanho, formato do token, cor, intensidade, duração, giro/espelho, prévia e som. Nenhum asset antigo é removido nem há mudança de servidor ou banco.

Validação nativa em `scripts/review-vtt-breathing-barrier.mjs`: variação real do raio de aproximadamente 23 pixels na superfície de teste; alfa zero na brecha aberta e 32 depois de fechar; ciclo sem salto; intensidade/cor branca/movimento reduzido; card real com hover e celular; 145 efeitos vizinhos comparados com `033e860` e preservados. Custo medido: cerca de 0,9 ms por quadro para uma barreira. Dez testes de renderização/geometria/projeção e TypeScript/build no estágio limpo passaram. O teste gera sequência e métricas em `test-results/`.

Publicação incremental sobre `graphics-polish-v2-20261011`, somente bundles/HTML. Conferir saúde, hashes públicos, dados de produção antes/depois da troca e atividade do ilustrador. Enviar o commit para a branch autorizada Welson.
