# Perspectiva da mobília — referência do usuário, 07/10/2026

Os itens de decoração vendidos para a House devem parecer parte do cenário.
As referências fornecidas pelo usuário ficam em
`docs/references/house-perspective-empty-room.png` e
`docs/references/house-perspective-furnished-room.png`. A segunda imagem estabelece
a direção da câmera, o recuo das laterais, a luz quente e o encontro dos pés com
o piso. O pedido posterior de refazer toda a mobília autoriza substituir os
modelos dos dez objetos, preservando seus IDs e bens comprados. Carta e quadro
ficam fora dessa substituição.

## Modelos da mobília refeita

O conjunto ativo tem sofá de carvalho com estofado terracota, mesa de centro
baixa, poltrona de couro, banco sem encosto com pele, arca de tampa plana, livros
de couro, candelabro de três velas, vaso de flores, tapete bordô com franjas e
estante aberta de carvalho. `statue` identifica a nova estante e `lantern` o
candelabro; esses IDs históricos não devem ser trocados. Os dez modelos seguem
o acabamento da referência e têm oito vistas reais próprias.

Os arquivos ativos ficam em `public/house/items/house-refit-20261007/`, com
80 entradas no manifest. Originais nativos, prompts e hashes são preservados
como proveniência. A publicação verifica os 20 arquivos protegidos de carta e
quadro e suas calibrações. Não regenerar esses dois objetos durante o refit.

## Padrão visual

Usar câmera próxima da altura dos olhos, olhando suavemente para baixo, com
perspectiva real e discreta. Paredes e piso da referência convergem ao fundo.
Pés e bases precisam compartilhar um plano de apoio; partes distantes recuam e
diminuem naturalmente. Evitar visual isométrico ou vista de cima muito acentuada
para móveis colocados nesta sala. Tapetes e cartas ficam deitados nesse plano.

Madeira, couro, tecido e metal devem ter textura e desgaste coerentes com o
ambiente. A luz quente da lareira e a luz fria lateral servem de referência para
o acabamento. Preservar proporções físicas e a identidade do objeto ao gerar
suas outras direções. Imagens de produção são recortes transparentes completos,
sem cenário incorporado, piso opaco, etiquetas ou sombras recortadas retangulares.

A perspectiva deve existir na arte. Não deformar a imagem com CSS3D para tentar
obter o encaixe: esse experimento foi retirado. O cenário continua ampliando ou
reduzindo os objetos pela profundidade, mantendo a escala base do layout.

## Vistas usadas na apresentação inicial

Os 12 objetos atuais possuem oito vistas reais. As 80 novas vistas da mobília
foram revistas isoladamente e em contato; as 16 de carta/quadro são preservadas.
A vitrine e a primeira colocação usam uma direção apropriada: sofá em
frente-esquerda, cadeira em frente-direita, mesa frontal, tapete alinhado ao piso
e banco em frente-direita. Arca, livros, candelabro, vaso e estante também usam
frente-direita. O seletor Direção da peça no painel percorre as oito vistas.
Não substituir uma direção por espelhamento ou rotação da mesma imagem.

Somente a colocação de uma peça nova usa essa direção inicial. Objetos já salvos
conservam a posição, direção, giro, camada e tamanho escolhidos pelo usuário.
Não alterar seus IDs, preços, conteúdo pessoal ou direitos de visita por uma
mudança de apresentação.

## Geração e revisão

Para criar mobília nova ou refazer uma vista solicitada, usar image_gen nativo.
Carregar e examinar a peça atual, se houver, e as duas referências. Informar no
prompt qual imagem é o modelo aprovado cuja identidade será preservada entre
suas oito direções e quais são referências de câmera/iluminação. Gerar uma vista
por chamada, com alpha real.
Inspecionar o resultado isolado e colocado na sala em tamanho real antes de
atualizar o catálogo. Salvar arquivo, prompt, hashes e modo de geração no manifest.

O sofá junto à parede esquerda, a mesa central e a cadeira à direita são o teste
de composição. Conferir apoio no piso, direção, tamanho relativo, recuo, luz e
recorte nas larguras 1440, 768, 390 e 320 px. A câmera baixa se avalia pela
composição, e não somente por uma porcentagem arbitrária de tampo visível.
