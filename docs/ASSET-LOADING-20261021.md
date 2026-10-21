# Entrada e preparação de cenários

O site prepara 21 imagens compartilhadas de abertura antes de exibir a entrada.
A tela mostra progresso real por arquivos preparados, falha explícita e nova tentativa.
O catálogo, o cenário próprio da loja, mapas e bibliotecas grandes ficam fora dessa
fila. O catálogo JSON só começa a carregar ao entrar no Empório ou na Torre.

`page-assets.ts` lista cenários iniciais; `asset-preloader.ts` compartilha pedidos
por URL normalizada, limita a quatro downloads simultâneos e aguarda decodificação.
O resultado guarda prontidão, sem reter cópias próprias de todas as imagens decodificadas.
O navegador administra o cache e a memória. Imagens e fontes públicas têm cache de
uma hora; HTML, autenticação e APIs mantêm suas políticas de não armazenamento.
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
