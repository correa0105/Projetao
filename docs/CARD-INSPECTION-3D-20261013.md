# Inspeção 3D, verso provisório e prévia cromada

Inspecionar agora abre uma carta física em 3D por CSS, com frente, verso e quatro
arestas. Arrastar gira horizontalmente em 360 graus e inclina verticalmente até
30 graus. Virar mostra o outro lado; Restaurar volta à frente. Setas giram e
Home restaura. Pointer capture conserva o gesto fora da carta; toque usa o mesmo
controle. Escape, botão fechar, clique no fundo, blur e retorno do foco continuam.

As dezesseis ilustrações atuais são conservadas byte a byte. A renderização 3D
usa as imagens nativas existentes e mantém os títulos HTML proporcionais. Não
redesenha personagens nem converte a ilustração em outra arte. A rotação altera
somente transform CSS, atualizada no máximo uma vez por frame durante o arraste,
sem renderizar React a cada movimento ou manter loop ativo em repouso.

Prévia cromada é um acabamento de inspeção em prata e grafite, com baixo nível
de cor. Neutraliza os pequenos acentos da ilustração escura, aplica reflexos de
prata sobre todo o fundo da frente, incluindo a base, moldura e arestas frias e
um verso de metal escovado. As faixas de luz acompanham a inclinação e o giro;
o desenho preto permanece legível. Não há animação ativa em repouso.
Correção de 14/10: o reflexo anterior era fraco e terminava antes da base da carta.
O acabamento agora usa color-dodge e ocupa toda a arte. Não altera raridade, nível
possuído, compras ou equipamento. Os três níveis continuam independentes.

Versos provisórios são SVGs próprios editáveis:
public/cards/back-placeholder-v1.svg e public/cards/back-chrome-placeholder-v1.svg.
Os caminhos ficam isolados em src/card-backs.ts para futura substituição. O verso
comum usa tinta escura e emblema discreto; o cromado usa somente tons neutros.
Não houve geração ou edição das artes raster nesta mudança.

QA usa o navegador com CSS real em cinco viewports. Confere frente/verso,
arraste, toque, setas/Home, restauração, preview cromado, tamanho do diálogo,
títulos e nível da coleção intacto. TypeScript/build e mídias/raridades anteriores
também são conferidos. Publicação local muda só cliente e dois versos, sem SQL,
preservando servidor, banco e todas as mídias anteriores.
