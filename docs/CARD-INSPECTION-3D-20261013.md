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

Faixas repetidas de reflexão cobrem toda a frente, com tamanho de fundo 118%,
e se deslocam com o giro/inclinação. A superfície usa prata/grafite com baixa
saturação. Os detalhes originalmente dourados da ilustração de nível 2 são
extraídos por máscara SVG de crominância e recebem um gradiente de ouro. O
reflexo não apaga mais esses detalhes. A arte preta e branca fica legível, sem
partículas, arco-íris ou animação contínua. Há no máximo uma atualização CSS por
frame durante o gesto, sem renderizar React a cada movimento.

O verso usa exatamente o PNG enviado pelo usuário, com proporção e assinatura
preservadas: public/cards/back-raven-20261014.png. A referência original fica em
data/cards/raven-back-source-20261014.png; os dois arquivos são idênticos. O
acabamento cromado acrescenta somente reflexos CSS sobre esse mesmo verso.
Os caminhos ficam em src/card-backs.ts. Os SVGs provisórios e as dezesseis
ilustrações originais foram mantidos; nenhuma nova arte raster foi gerada.

Validação: TypeScript/build; navegador real em cinco tamanhos, oito cartas e
três níveis; títulos sem corte, nível 3 consistente, ouro, imagem do verso,
arraste, toque, teclado, retorno e níveis da coleção intactos. Verificação das
24 combinações de carta/nível confere a moldura compartilhada, ausência de
contornos verdes e ausência de animação contínua. Resultados em
test-results/card-presentation e test-results/tarot-art.
