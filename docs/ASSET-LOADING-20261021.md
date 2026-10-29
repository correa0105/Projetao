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
na loja, 512 px nos objetos do VTT, 960 px nos demais objetos e 1536 px nas cartas. SVGs com animação ou
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

### Miniaturas das bibliotecas do VTT

Os cartões usam cópias WebP de até 128 px, preservando proporção e transparência.
`VttAssetImage` inicia pedidos dentro ou a 320 px do painel visível para antecipar
a próxima rolagem; essas prévias
não bloqueiam o loading geral. Monstros, presets, criaturas, cenários, peças,
texturas do pincel, veículos, armas de cerco e imagens da mesa compartilham esse
fluxo. Detalhes ampliados e objetos do mapa usam cópias de até 512 px, com URL por
hash para evitar reutilizar a versão maior em cache. Os caminhos salvos continuam
originais. Fundos e texturas pintadas não recebem a miniatura como material.
Imagens usadas como fundo conservam a resolução original, inclusive quando uma
peça antes usada como objeto passa a ser o fundo da cena.

Peças animadas e veículos têm prévias estáticas renderizadas antecipadamente
pelo mesmo desenho do mapa. Abrir a biblioteca não espera os pacotes de efeitos
nem monta vários canvases para mostrar os cartões. A animação da peça colocada
continua completa. Texturas técnicas temporais, elementais e de relâmpago também
mantêm seus pixels nativos; o manifesto corrige 43 cópias antes redimensionadas.

Importar os renderizadores não inicia o download de todos os materiais de efeitos.
Cada desenho solicita somente as texturas que utiliza; a conclusão atualiza o mapa
ou a prévia aberta. As interfaces de aquecimento explícito continuam disponíveis
para geração e verificação das artes. O compêndio só é consultado depois da mesa
carregar, evitando os pedidos duplicados da entrada. O ícone do mural usa sua
cópia WebP existente diretamente, inclusive dentro do SVG de navegação.

O menu **Efeitos do mestre** mostra imagens estáticas de até 128 px em vez de
criar um canvas para cada efeito. Só a opção apontada ou focada anima, a 30 fps
e resolução simples; sair da opção ou fechar o menu cancela o desenho. A barra
rápida usa as mesmas imagens, com a cor do efeito. As duas prévias de **Tela
inteira**, em **Efeitos do mapa**, também usam imagens leves, sem carregar o
atlas técnico apenas para abrir o menu. A execução real no mapa fica preservada.

`node scripts/build-vtt-effect-previews.mjs` renderiza as 147 prévias de efeitos
e duas de tela em `public/optimized-images-20261028/vtt-effect-previews/`, com
índices em `shared/`. O conjunto soma 523.368 bytes e usa uma silhueta neutra
pública, sem arte autenticada de personagens. As URLs por hash têm cache público
de um ano e `immutable`: o navegador reaproveita os arquivos baixados, inclusive
após fechar e reabrir. Nenhum dado de jogo passa a ser salvo nesse cache.

`node scripts/test-vtt-menu-isolated.mjs --effects` confere abertura com CPU quatro
vezes mais lenta, ausência de canvases e downloads de texturas nativas ao abrir,
animação apenas no hover e uso do cache em disco após reiniciar o navegador com
perfil de teste. Abrir os menus não altera a atmosfera salva da mesa.

Imagens privadas aceitam `thumbnail=1` (128 px) e `display=1` (512 px) somente depois
da autorização existente. Animações privadas conservam o arquivo completo no mapa.
A conversão usa cache separado da versão completa, duas conversões simultâneas
e fila limitada, mantendo `private, no-store`. `original=1` tem precedência.
Nenhuma imagem privada ou original do banco é reescrita.

`node --import tsx scripts/build-vtt-library-thumbnails.mjs` gera o índice público;
`node --import tsx scripts/build-vtt-animated-previews.mjs` gera os cartões animados e veículos.
`node --import tsx scripts/build-vtt-display-images.mjs` reduz as cópias de objetos
maiores e atualiza somente as entradas correspondentes do manifesto existente.
Os índices em `shared/` vão ao Git e os arquivos em
`public/optimized-images-20261028/vtt-thumbnails/` acompanham a publicação.
As 1.953 fontes tratadas somam 8.271.352 bytes em miniaturas, 67% menos que os
25.375.136 bytes da primeira versão de 256 px. As 28 prévias de animações/veículos
somam 113.714 bytes. As 865 cópias maiores de objetos passam de 153.089.476 para
46.942.158 bytes, cerca de 69% menos. Isso compara os conjuntos tratados, não o
download de uma visita. Evidências e hashes dos originais ficam em `.local`.

`node scripts/test-vtt-menu-isolated.mjs --performance` verifica as categorias com
rede limitada e pacotes de efeitos atrasados, carregamento por viewport, alfa,
autorização privada após cache aquecido e conservação da animação no mapa.
`--cold` também limita a rede desde a entrada, mantendo os downloads reais de
efeitos, e verifica a rolagem de Mobílias externas e o detalhe ampliado.
`node scripts/test-vtt-menu-isolated.mjs` verifica a biblioteca no painel direito.

### Imagens retiradas da publicação

Por pedido de remoção das imagens sem uso, a auditoria de 29/10/2026 cruzou código,
catálogos, dependências de SVG e referências do banco publicado. Foram retirados
1.529 originais sem uso ou substituídos, incluindo miniaturas, e 966 derivados
exclusivos, totalizando 617.414.605 bytes na pasta pública. Cópias compartilhadas
com artes em uso são preservadas. O manifesto de exibição passa de 8.628 para
7.637 entradas. O inventário também verifica os catálogos materializados em
runtime; texturas técnicas, máscaras e biomas gerados dinamicamente permanecem.

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
Imagens sem substituta respondem 404, inclusive a URL otimizada e `?original=1`,
sem receber o HTML do aplicativo. Para 946 URLs lógicas de artes/miniaturas
substituídas, `public-image-replacements-20261029.json` direciona à arte atual,
preservando referências de mesas salvas sem armazenar o arquivo legado na
publicação. IDs e dados dos jogadores não são reescritos. A remoção reduz o
pacote da publicação; não representa o volume baixado em cada visita.

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
