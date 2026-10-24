# Botão para mover o mapa

O fundo do VTT passa a ser arrastado com o botão direito por padrão. Em
**Configurações e ajuda → Mesa → Personalização → Botão para mover o mapa**,
cada usuário pode escolher o botão esquerdo. A preferência fica salva no
navegador, por conta, junto às demais opções locais do VTT. Preferências antigas
sem esse campo passam a usar o direito; escolhas de efeitos e áudio são mantidas.

O esquerdo continua selecionando e movendo tokens, pintando e editando. O direito
sobre um token controlável mantém o movimento medido; um clique breve abre suas
ações. Arrastar o fundo ou uma peça de mapa com o direito navega sem abrir menu.
Espaço+arraste, Ctrl de navegação/rotação, botão do meio, roda para zoom e toque
continuam funcionando. A ferramenta Mover mapa e o editor de transparência
respeitam a preferência. Na criação de áreas, o esquerdo continua desenhando.

Navegação altera somente a câmera local: nenhuma posição, traço, camada ou versão
do documento compartilhado é gravada por arrastar o mapa. Não há migration,
mudança de protocolo, permissão, servidor ou arte.

Validação: TypeScript e builds cliente/servidor; navegador real em PostgreSQL UUID
descartável com direito padrão, esquerdo opcional, persistência após recarga,
configuração de outro usuário, documentos idênticos antes/depois da navegação,
toque, atalhos, brush ativo, editor de transparência e movimento/menu dos tokens.
Regressões de giro por Ctrl, camadas, importação, ownership, espectador, captura
PNG 4224 × 3744 e telas 1440/768/390 passaram sem erros JavaScript.
Evidências em `test-results/vtt-map-controls/`.

O smoke antigo foi atualizado para confirmar a entrada de efeitos do VTT e as
permissões vigentes por dono da mesa, introduzidas antes desta alteração. Nenhuma
regra de acesso do produto foi modificada. O runner rejeita o túnel de produção.

Publicação somente do cliente sobre `horns-balanced-20261024`, preservando o
servidor, os arquivos públicos, dados e ilustrador. Recarregar uma aba antiga do
VTT carrega os novos controles.
