# Cores dos efeitos, orientação de queda e mascotes

Pedido de 11/10/2026: preservar as animações aprovadas dos anexos e melhorar somente a qualidade da cor e sua profundidade; refinar a Barreira arcana; impedir chuva invertida ao girar o personagem; continuar o painel de mascotes conforme a referência ilustrada de montarias.

## Cor

`src/vtt-effect-color-depth.ts` aplica um tratamento de RGB aos 28 efeitos indicados: Chamas, Nevasca, Brasas, Corrente elétrica, Runas de invocação, Maldição, Bênção, Círculo infernal, Fogo azul, Fúria, Sono encantado, Medo, Cometas de brasas, Maré de fogo, Gêiser de chamas, Espiral incandescente, Gaiola elétrica, Esferas de plasma, Coroa de descargas, Salpicos corrosivos, Poça corrosiva, Espiral tóxica, Sopro venenoso, Cortina de chuva, Tornado de água, Gêiser de água, Onda de maré e Pulsos prismáticos.

Sombras mais profundas, cromaticidade ampliada nos meios-tons e reflexos claros nos núcleos. Compressão conjunta dos canais claros evita amarelar as chamas por saturação dos canais ou perder as cristas da água. Núcleos claros ganham emissão; dobras escuras continuam profundas e áreas transparentes permanecem vazias. O shader não recebe tempo: trajetórias, velocidades, fases, contagens, volumes e sons existentes são conservados. Cores personalizadas continuam passando pelo mesmo renderer. O passe opera somente sobre o efeito, com as mesmas camadas anterior/posterior ao personagem.

Uma superfície Canvas e uma superfície WebGL reutilizadas, limitadas a 1024 pixels; alinhamento à grade de pixels original e alternativa Canvas para indisponibilidade/perda de WebGL. Demais efeitos e Céu luminoso conservados.

## Gravidade e barreira

Onze efeitos de precipitação deixam de herdar rotação e espelhamento do ator. A compensação acontece antes da escala não uniforme, evitando também inclinação artificial em tokens retangulares. Inclui chuva normal/ácida/celestial, nevasca, neve, granizo, tempestade, flores, gotas etéreas, opalas e estrelas. As três últimas também corrigem o deslocamento que antes subia; a cauda das estrelas fica acima do núcleo em queda. Materiais sobre o corpo e órbitas continuam seguindo o personagem.

A Barreira arcana mantém o ciclo contínuo de 5,6 s, cresce/contrai com deformação assimétrica e abre fissuras tangenciais de pontas afiladas. As bordas se curvam e recompõem, com espessura, luz móvel, sombras nas dobras e centro transparente. Mantidos tamanho salvo, cor, intensidade e duração.

## Mascotes

Painel de madeira com dez linhas ilustradas: imagens maiores, nome e preço; borda dourada e marca de seleção. As formas têm suas próprias imagens, sem depender de selecionar nomes em um dropdown. Não há cabeçalho vazio de Aparência em espécies sem formas alternativas. A lista adapta sua altura ao desktop; nome, saldo, compra e inventário permanecem acessíveis. Garalho, jardim, sons, preços, permissões, variantes e payload de compra preservados.

## Verificação

`scripts/review-vtt-breathing-barrier.mjs` verifica abertura alfa zero, fechamento, variação do raio, ciclo sem salto, cores, intensidade, movimento reduzido e card real em desktop/celular. Compara os 28 tratamentos em três momentos: nenhum contorno significativo perdido/adicionado, luz visível reforçada e movimento reduzido congelado. A intensidade do material muda; movimento e geometria são conservados. Verifica 114 efeitos não alterados e os onze de precipitação em quatro rotações e todos os espelhamentos, incluindo token retangular. Mede barreira e cinco materiais representativos, exigindo menos de 16 ms por quadro.

`scripts/review-pet-shop-cards.mjs`: dez espécies, sete formas alternativas, reset de nome/seleção, payload de compra, impedimentos por nome/saldo e editor de raça; larguras de 320, 390, 760, 768, 1050 e 1440 px sem transbordamento. Dez testes de renderer/footprint/projeção e TypeScript/build no estágio limpo.

Publicação incremental somente do cliente sobre `breathing-barrier-v1-20261011`, conservando o servidor, mídias, dados, volumes e ilustrador. Verificação de bundles, HTML sem cache e hashes de mídias/dados ao vivo. Alterações independentes do checkout preservadas; envio somente a `origin/Welson`.
