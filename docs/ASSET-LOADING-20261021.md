# Entrada e preparação de cenários

Na entrada, o site prepara somente o destino aberto pelo usuário autenticado;
sem sessão, prepara as duas imagens da entrada. As outras áreas carregam seus
cenários ao serem abertas. Cartas prepara apenas o fundo correspondente à largura
da tela. O catálogo JSON só começa a carregar ao entrar no Empório ou na Torre.
A primeira visita mostra o aviso de que pode demorar mais e o progresso real.
Depois da primeira preparação bem-sucedida, fica somente uma barra discreta,
inclusive após recarregar o navegador. A preferência visual é local; não guarda
dados de jogo nem promete cache permanente. Falhas continuam mostrando a causa
e o botão de nova tentativa.

`page-assets.ts` lista cenários iniciais; `asset-preloader.ts` compartilha pedidos
por URL normalizada, limita a quatro downloads simultâneos e aguarda decodificação.
O resultado guarda prontidão, sem reter cópias próprias de todas as imagens decodificadas.
O navegador administra o cache e a memória. Artes e fontes públicas em caminhos
com data de versão, assim como os bundles com hash, têm cache de um ano e
`immutable`; imagens públicas sem essa versão mantêm uma hora. Trocar uma arte
versionada exige uma URL nova. HTML, autenticação e APIs mantêm suas políticas de não armazenamento.
Os arquivos originais permanecem preservados. A entrega leve autorizada está
descrita abaixo; backgrounds e mapas continuam com seus bytes originais.

`AssetGate` prepara fundos CSS, pseudo-elementos, imagens e texturas SVG da primeira
viewport antes de revelar uma aba. O observador atua somente até a primeira abertura;
depois é desconectado. Imagens enviadas, hover, funções internas e redimensionamento
não podem cobrir novamente uma página já aberta com loading geral. A geometria é montada oculta, preservando
medidas, responsividade e controles. Imagens visíveis com carregamento lazy são
promovidas só nessa viewport; o restante do catálogo continua sob demanda.
Modais conservam seus próprios fluxos, sem esconder diálogos no topo da página.
Dados iniciais assíncronos aguardam `data-page-preparing`/`aria-busy` antes da primeira
varredura completa. Imagens de prévias de pins ficam fora dessa preparação. O aviso
da primeira visita fica em `AssetLoading`; `loading-visit.ts` registra somente que
a preparação inicial terminou. A barra seguinte continua acessível a leitores de
tela e fica indeterminada enquanto aguarda informações.

## Entrega leve de imagens

`npm run images:optimize` audita os arquivos públicos e gera cópias WebP em
`public/optimized-images-20261028/`, com manifesto e hashes próprios. Essa saída
reproduzível fica fora do Git e deve acompanhar o artefato de publicação. Os PNGs,
WebPs e SVGs originais não são sobrescritos. `image-delivery-policy.ts` exclui
backgrounds, mapas, máscaras e texturas de dados; atlas mantêm dimensões e
coordenadas. Imagens avulsas usam resolução de exibição proporcional, até 768 px
na loja, 960 px nos demais objetos e 1536 px nas cartas. SVGs com animação ou
símbolos reutilizáveis conservam o arquivo original; não reduzir quadros de forma
que descarte movimentos ou variações necessárias.

O servidor negocia a cópia somente quando o navegador aceita WebP explicitamente.
`Vary: Accept` separa os formatos no cache. Requisições de ferramentas e
`?original=1` recebem os originais. Arquivos ausentes voltam à entrega original.
Os retratos, tokens e companheiros também podem receber prévias WebP após a
autorização atual da rota. O cache dessas conversões é privado, limitado a 32 MB,
com no máximo duas conversões simultâneas; o banco, as revisões e os originais
continuam intactos. Galerias de inventário e animais carregam imagens fora da
viewport sob demanda.

A entrega de 28/10/2026 verificou 8.628 arquivos: 2.658.646.549 bytes originais para
735.661.046 bytes nas cópias, redução agregada de 72,3%. Isso mede o acervo tratado,
não um download completo feito por visita. Comparação visual em 1440 e 390 px,
negociação/cache por formato, acesso privado após cache aquecido e exclusão,
primeira visita, recarga com barra, falha/retomada e ausência de downloads de áreas
não abertas foram conferidos em testes e navegador. Evidências em `.local` e
`test-results/image-performance/` e `test-results/site-loading/`.

### Imagens retiradas da publicação

Por pedido de remoção das imagens sem uso, a auditoria de 29/10/2026 cruzou código,
catálogos, dependências de SVG e referências do banco publicado. Foram retirados
418 originais sem referência encontrada e 418 derivados exclusivos, totalizando
232.570.477 bytes na pasta pública. Cópias compartilhadas com artes em uso são
preservadas. O manifesto de exibição passa de 8.628 para 8.210 entradas.

Os originais permanecem, sem alteração, em
`artwork-archive/retired-public-images-20261029/`, fora de `public`, `dist` e do
contexto Docker. Caminhos, tamanhos e hashes ficam em
`data/public-image-retirements-20261029.json`. O arquivo anterior de otimização e
os derivados retirados têm backup privado; a publicação também preserva uma
cópia externa dos arquivos removidos e a imagem anterior para retorno.

`node --import tsx scripts/retire-public-images.ts --apply` confere hashes,
arquiva e retira os arquivos locais; `--check` apenas verifica. O build Vite
aplica a mesma lista na saída para impedir que uma geração antiga os inclua
novamente. Conteúdo diferente em um caminho retirado exige revisão explícita da
lista antes da publicação. Para reativar uma arte, revisar referências, retirar
a entrada da lista, restaurar o original arquivado e gerar a cópia de exibição.
Imagens ausentes respondem 404, inclusive a URL otimizada e `?original=1`, sem
receber o HTML do aplicativo. A remoção reduz o pacote da publicação; não
representa o volume baixado em cada visita.

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
