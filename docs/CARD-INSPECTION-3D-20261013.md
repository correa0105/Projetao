# Cartas: inspeção 3D, prata, ouro e verso de corvo

Atualização de 14/10/2026. Inspecionar abre uma carta física com frente, verso e
quatro arestas. Arrastar gira em 360 graus e inclina até 30 graus; Virar,
Restaurar, setas e Home também controlam a posição. Pointer capture mantém o
gesto fora da carta. Toque, Escape, fechar, fundo borrado e retorno de foco
continuam disponíveis.

O acabamento final do nível visual 3 agora é o mesmo no catálogo, nos espaços
equipados, na prévia de nível e na inspeção. Nos níveis 1 e 2, Prévia cromada
permite apenas comparar a aparência, sem alterar o nível possuído. A moldura
continua compartilhada entre raridades e os títulos permanecem proporcionais.
Os contornos verdes foram retirados; botões e área de giro mantêm indicação de
foco pelo teclado em tom neutro.

Somente o acabamento cromado recebe fundo inteiramente prateado na frente e
no verso. Uma curva de tons SVG clareia o papel grafite da frente e preserva os
traços mais escuros. Reflexos suaves cobrem toda a superfície e acompanham o
giro/inclinação; não se limitam a uma faixa clara sobre papel preto. Os detalhes originalmente dourados da ilustração de nível 2 são
extraídos por máscara SVG de crominância e recebem um gradiente de ouro. O
reflexo não apaga mais esses detalhes. A arte preta e branca fica legível, sem
partículas, arco-íris ou animação contínua. Há no máximo uma atualização CSS por
frame durante o gesto, sem renderizar React a cada movimento.

O verso original continua em public/cards/back-raven-20261014.png, idêntico à
referência data/cards/raven-back-source-20261014.png. Só as cromadas usam
public/cards/back-raven-silver-gold-20261014.webp, uma edição via imagegen
embutido: fundo de prata escovada, ornamentos de ouro e corvo escuro, conservando
a composição e a assinatura. O PNG nativo está em
data/cards/raven-back-chrome-source-20261014.png. Prompt, modo e hashes foram
salvos em data/cards/raven-back-chrome-20261014.json. Exportação WebP 96, sem
recorte. Os caminhos ficam em src/card-backs.ts; níveis 1/2 e artes originais
continuam intactos.

Validação: TypeScript/build; navegador real em cinco tamanhos, oito cartas e
três níveis; títulos sem corte, nível 3 consistente, ouro, imagem do verso,
arraste, toque, teclado, retorno e níveis da coleção intactos. Verificação das
24 combinações de carta/nível confere a moldura compartilhada, ausência de
contornos verdes e ausência de animação contínua. Resultados em
test-results/card-presentation e test-results/tarot-art.

A auditoria de pixels das oito frentes verifica o papel prateado (luminância
média acima de 145/255) e tinta escura legível. Confere também que os níveis
1 e 2 não recebem a curva de prata. Evidência: silver-background.json.
