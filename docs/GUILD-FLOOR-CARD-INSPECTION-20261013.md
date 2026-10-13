# Guildas por personagem, mobília e cartas

Os móveis da guilda usam a escala base do catálogo House, a largura calibrada de
cada vista real e a profundidade do piso. A escala de referência é y=.84; ao ir
para o fundo, a peça diminui sem modificar seu tamanho base. O arraste resolve o
ponto agarrado junto com essa variação para conservar a posição sob o cursor.
Salas iniciais têm borda de piso própria; expansões usam o cenário House correspondente.
Posições, vistas, IDs e ajustes de perspectiva existentes são conservados.

O painel de decoração é menor: ações da sala primeiro, controles da peça selecionada
em um grupo, ajuda recolhida e salvar/descartar lado a lado. Vistas, teclado, arraste,
guias, quatro cantos de perspectiva, atmosfera e salvamento continuam disponíveis.

O vínculo passa a acompanhar o personagem. Migration 095 conserva todas as linhas e
troca a chave de conta por (guilda, conta), com personagem único. Uma conta pode ter
personagens em guildas distintas; cada personagem tem uma guilda e cada conta mantém
um representante por guilda. Capacidade, tesouro, histórico, cobrança, idempotência e
progresso de missões continuam separados por guilda. Personagem livre vê procurar e
fundar; não aparece o aviso ou botão referente ao outro personagem da conta.

Editar brasão está disponível ao fundador após a criação. PATCH /guilds/:id/crest
valida ownership do personagem ativo e revisão; altera somente o brasão. O rascunho
da decoração é conservado quando um brasão é salvo durante a edição.

As oito cartas receberam artes originais no estilo ornamental da referência do
usuário, com moldura integrada, silhuetas e cores organizadas. As comuns continuam
brancas e simples; incomuns verdes, raras azuis, muito raras roxas e lendárias laranjas.
O nome aparece na faixa da própria carta, inclusive na seleção e inspeção. Não há
retângulo CSS sobre a moldura, borda duplicada ou palavra de raridade na face.
Efeitos a partir da rara usam um halo externo e pequenos reflexos na borda,
com intensidade crescente, sem sobrepor a ilustração. Movimento reduzido é respeitado.
A raridade abaixo do nome tem 10px. Inspecionar abre uma carta grande com fundo
escurecido e suavemente borrado; botão fechar, Escape e clique no fundo fecham,
e o foco retorna ao controle de abertura.

Artes geradas pelo image_gen embutido, uma imagem por carta. Fontes:
`data/cards/tarot-nouveau-sources-20261013/`; arquivos do site:
`public/cards/tarot-nouveau-20261013/`. Prompts finais, raridades e SHA-256 estão em
`data/cards/tarot-nouveau-reviewed-20261013.json`. Artes anteriores preservadas.

Validação usa TypeScript, builds, testes de escala/arraste e API em PostgreSQL
descartável, com concorrência, ouro, ownership e revisão. QA no navegador real
confere vistas, perspectiva, salvar/reabrir, brasão e personagem livre, além de
inspeção das cartas em 1440, 768, 390 e 320px. Mídias e banco anteriores são
conferidos por hash antes/depois da publicação local.
