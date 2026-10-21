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
viewport antes de revelar uma aba. Mudanças de imagem são observadas; transformações
de animação não disparam varreduras. A geometria do cenário é montada oculta, preservando
medidas, responsividade e controles. Imagens visíveis com carregamento lazy são
promovidas só nessa viewport; o restante do catálogo continua sob demanda.
Modais conservam seus próprios fluxos, sem esconder diálogos no topo da página.

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
sobre uma imagem completa validada, copiando bundles e servidor. Isso exige que
`public/`, `data/`, `db/` e dependências sejam idênticos à base. Uma alteração nesses
diretórios exige nova imagem completa. Preservar volumes e a imagem anterior.
