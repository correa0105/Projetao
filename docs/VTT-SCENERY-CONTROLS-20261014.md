# Casas, grade e câmera — 14/10/2026

As casas usam a proporção quadrada dos arquivos originais e escala de nove
células; a casa nobre usa sete devido à mobília maior na arte. O personagem
mantém seu tamanho. Na seleção da casa, **Ajustar casa à escala dos personagens**
recalibra peças já colocadas, realinha a entrada e conserva os ocupantes.

A entrada se alinha ao centro de uma célula horizontal e à linha da grade
vertical. Colocação e arraste usam o mesmo encaixe. A colisão usa o corpo
do personagem, sem o espaço ocupado pela arma e pela pose; um passo bloqueado
avança até o contato com a parede. Paredes e troncos permanecem físicos no
servidor. Os 25 troncos têm barreira circular proporcional, sem bloquear a copa.

A porta começa fechada, abre e fecha por clique, guarda seu estado na mesa e
nunca fecha automaticamente. O servidor exige controle e proximidade para
jogadores; espectadores não operam portas. Uma passagem ocupada não fecha.
A folha de carvalho tem textura original feita com imagegen embutido, presa
ao batente, abrindo para fora. A arte da casa fornece o piso e o batente,
sem a antiga placa escura desenhada sobre a entrada.

O interior aparece ao entrar. Na visão do personagem dentro da casa, o exterior
fica oculto pelo recorte nativo da arte, inclusive entre os batentes e ao redor
das paredes. As 25 casas têm aberturas conferidas individualmente; chaminés,
móveis, espelhos e portas não são janelas. Casas sem janela não geram cones.
O telhado inteiro permanece alinhado à casa do lado de fora, com beirais
translúcidos sobre as bases das paredes. Dentro, é removido por completo.
Aproximar-se de uma janela real abre um cone exterior de visão, que
se amplia com a aproximação. Janelas bloqueiam movimento e deixam passar visão.
O servidor também filtra tokens externos para a visão interna do jogador.
O mestre vê a visão interna ao selecionar o personagem; sem essa seleção,
conserva a visão de administração da mesa.

**Mover mapa (H)** permite arrastar a câmera com o botão esquerdo. Espaço +
arraste funciona também depois de focar um botão; botão central continua
disponível em qualquer ferramenta. A alça redonda gira assets; Shift + rolagem
gira em passos de 15°. Escape cancela um giro ou redimensionamento sem salvar.

A pintura pronta é consolidada em uma imagem para mapas até 16 MiPixels;
mapas maiores usam blocos consolidados em resolução nativa sob limite de memória.
Zoom reutiliza o resultado e não muda a resolução dos blocos nem refaz os traços.
Pintar, apagar, desfazer, carregar imagens ou mudar camadas invalida o resultado
correspondente. As plantas e objetos externos são desenhados sobre a casa.

QA: testes de movimento/casas/grade/troncos; navegador em banco UUID descartável,
com portas, permissões, arraste, giro, câmera, visão interna e janelas; benchmark
de zoom e edição/desfazer. Evidências em test-results/vtt-nature, terrain-zoom
e brush-performance. A verificação house-vision examina pixels externos das
25 silhuetas, ausência de cones falsos e conservação de todo o telhado.
Nenhuma migration nova; protocolo 16 pede recarga a clientes
que ainda usam a geometria anterior.
