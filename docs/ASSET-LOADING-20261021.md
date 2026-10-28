# Entrada e preparação de cenários

O site prepara 21 imagens compartilhadas de abertura antes de exibir a entrada.
A tela mostra progresso real por arquivos preparados, falha explícita e nova tentativa.
O catálogo, o cenário próprio da loja, mapas e bibliotecas grandes ficam fora dessa
fila. O catálogo JSON só começa a carregar ao entrar no Empório ou na Torre.

`page-assets.ts` lista cenários iniciais; `asset-preloader.ts` compartilha pedidos
por URL normalizada, limita a quatro downloads simultâneos e aguarda decodificação.
O resultado guarda prontidão, sem reter cópias próprias de todas as imagens decodificadas.
O navegador administra o cache e a memória. Artes e fontes públicas em caminhos
com data de versão, assim como os bundles com hash, têm cache de um ano e
`immutable`; imagens públicas sem essa versão mantêm uma hora. Trocar uma arte
versionada exige uma URL nova. HTML, autenticação e APIs mantêm suas políticas de não armazenamento.
Nenhuma imagem foi comprimida, redimensionada ou substituída.

`AssetGate` prepara fundos CSS, pseudo-elementos, imagens e texturas SVG da primeira
viewport antes de revelar uma aba. O observador atua somente até a primeira abertura;
depois é desconectado. Imagens enviadas, hover, funções internas e redimensionamento
não podem cobrir novamente uma página já aberta com loading geral. A geometria é montada oculta, preservando
medidas, responsividade e controles. Imagens visíveis com carregamento lazy são
promovidas só nessa viewport; o restante do catálogo continua sob demanda.
Modais conservam seus próprios fluxos, sem esconder diálogos no topo da página.
Dados iniciais assíncronos aguardam `data-page-preparing`/`aria-busy` antes da primeira
varredura completa. Imagens de prévias de pins ficam fora dessa preparação. A mensagem
em destaque explica que a primeira visita demora mais e que o navegador poderá
reutilizar imagens nas próximas visitas; não garante cache permanente.

Guilda e House reaproveitam snapshots de exibição durante a navegação da sessão.
O cache fica somente na memória, separado por conta, personagem e prévia básica,
com expiração de dez minutos e limite de 24 entradas. Sair da conta ou trocar o
contexto de prévia limpa a sessão de snapshots; uma resposta antiga não pode
repovoar o contexto novo. Não é persistência de jogo nem autorização para editar.
As cenas restauradas abrem sem refazer a varredura completa das texturas SVG;
as consultas autenticadas continuam em segundo plano a cada entrada. Permissões
de edição ficam desativadas até a resposta atual, e respostas 401/403/404 removem
a cena e seu snapshot. Falhas transitórias conservam somente a exibição sem edição.

Na guilda, registro, configurações e sede são consultados em paralelo. Presença
e retratos dos membros atualizam separadamente, sem bloquear a abertura do mapa.
A House conserva a vizinhança aberta e a câmera da última visita naquela sessão;
sair da vizinhança explicitamente volta ao diretório. Polling, revisão, ownership
e operações de jogo permanecem conferidos pelo servidor. As artes são preservadas
sem conversão ou perda de qualidade.

Verificação: `node scripts/test-portal-controls-isolated.mjs --assets` usa uma base
descartável e atrasos/falhas de rede controlados. Confirma que o Estábulo fica oculto
até seu fundo estar pronto, o Empório tem espera independente, nenhum catálogo da
loja é solicitado na entrada pelo Estábulo, o botão de nova tentativa recupera uma
falha real e o cache de `/api/me` continua `no-store`. Capturas em
`test-results/site-loading/`. O fluxo de administrador, manutenção, cartas e mapa
também foi revalidado pelo teste de navegador do portal.

O erro de preparação só é exibido depois que os pedidos já iniciados terminam;
o progresso restante não pode apagar a mensagem nem remover o botão de nova tentativa.
O mesmo teste valida o novo cabeçalho da ficha: Mercenário sem associação e
Membro da Guilda — nome da guilda apenas para o personagem associado.
As cinco patentes mudam somente de apresentação (ver `PATENTES.md`).
O mapa regional não mostra mais “Mapa Alvorada”; nome do reino e Voltar ao mundo
ficam no topo, com espaço para o menu da conta no celular.

Atualizações que alteram apenas código podem usar `deploy/hostinger/Dockerfile.code-update`
sobre uma imagem completa validada, copiando bundles, servidor e migrations. Isso exige
`public/`, `data/`, dependências e migrations existentes idênticos à base; são permitidas
novas migrations SQL numeradas aditivas, incluídas no manifesto de hashes. Mudanças de
acervo/dependências exigem imagem completa. Preservar volumes e a imagem anterior.

O teste de pins também atrasa uma imagem enviada no editor e confirma que o loading
geral não reaparece. House mantém identificadores/API `house2`, com rótulo público House.
## Correção de 23/10/2026

O fundo escolhido pelo jogador fica somente no perfil do viajante. A visita ao
acampamento usa sempre o cenário original da fogueira, inclusive sem personagens.
O enquadramento do chão não depende da imagem personalizada do perfil.

O progresso inclui retratos e demais imagens visíveis descobertas na área, além
do cenário inicial. Espera por metadados mostra uma mensagem de consulta dos dados,
sem uma barra de imagens completa sugerir que há um novo download. Conteúdo já
preparado abre antes da pintura; esperas menores que 180 ms não piscam a tela geral.
Os retratos autenticados do dono usam cache privado de uma hora quando `v` é a
revisão atual, `Vary: Cookie` e bytes originais. Sem revisão ou com revisão antiga,
o navegador revalida. Autorização e personagem excluído continuam conferidos no servidor.

`scripts/smoke-camp-cache.ts` verifica downloads reais de retratos e animais ao
navegar/recarregar, versões antigas, bytes, visitante anônimo, atualização de arte
e separação entre fundo de perfil e acampamento em 1440/390 px. O smoke de
carregamento mantém os casos de atraso, falha, nova tentativa e Empório separado.
