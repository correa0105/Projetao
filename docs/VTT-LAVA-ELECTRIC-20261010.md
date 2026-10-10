# Lava e Corrente elétrica — 10/10/2026

Lava foi reconstruída: poça irregular de magma viscoso com ilhas de basalto,
textura original transparente e fluxo contínuo sob o personagem. Saiu a malha
geométrica de fissuras. O líquido recebe convecção WebGL; a crosta fria fica
ancorada. Um tile reutilizado de 384 × 384 atende aos tokens, sem criar contextos
por personagem. Ciclo periódico de 6,4 segundos, limitado a 30 atualizações/s.
Sem WebGL, permanece a superfície original estática. Movimento reduzido usa
um estado estável; desligar efeitos continua respeitado.

Corrente elétrica conserva desenho, ramificações, cores e ritmo aprovados.
O alcance do renderer aumentou 32%, a faixa aumentou 50% e os canais passaram
de 1,9 para 3,4 px. Na comparação do mapa, o envelope visível passou de
171 × 179 para 241 × 252 px: cerca de 40% maior, sem cortar a composição.
O gerador original continua editável e a versão anterior permanece disponível.

## Arte e fontes

Lava: `public/vtt/lava-flow-20261010/magma-surface.webp`, criada com
`image_gen.imagegen`. Prompt completo, SHA-256 nativo e portátil, revisão e
proveniência em `data/vtt/lava-flow-20261010.json`. Original conservado localmente
em `.local/lava-flow-20261010/native.png`. Prompt: superfície de lava ortográfica,
poças largas de magma laranja/vermelho, cinco a sete ilhas irregulares de basalto,
sem grade de rachaduras, chamas sobrepostas, fumaça ou fundo.

Corrente: `public/vtt/chain-lightning-20261010/electric-{0,1}.webp`, gerada por
`scripts/build-vtt-chain-lightning-size.py`; parâmetros e hashes em
`data/vtt/chain-lightning-size-20261010.json`. Só as larguras dos canais mudaram.

## Verificação e aplicação

`scripts/review-vtt-lava-electric.mjs` revisa o renderer real em 960 e 390 px,
mapa e miniatura, compara a base `15b6b2e`, verifica oito efeitos vizinhos por
pixels, movimento reduzido, recorte e evolução. Lava apresentou 10,9% de
mudança entre estados, emenda zero; seis efeitos mistos gastaram 0,4 ms/quadro
na máquina local. Esse tempo não é uma garantia para outros aparelhos.

TypeScript, builds cliente/servidor e smoke de 105 efeitos/16 assets passaram.
Prévia final em `test-results/lava-electric-{desktop,mobile}.png` e vídeo do
loop na cópia de QA. Release local `lava-electric-20261010`, com anterior retido.
Docker saudável; três novas mídias e 43 bundles correspondem à versão validada.
As 60 tabelas protegidas, todos os produtos anteriores, 841 mídias/referências
da loja e 21 VFX anteriores permaneceram idênticos. Ilustrador continua ativo;
WIP independente, moinho e revisão 330 × 4 pausada foram preservados.

Completar todos os itens mágicos continua em andamento: 409 produtos novos
publicados e 2.667 candidatos ainda pendentes, além das opções de magia/alvo.
