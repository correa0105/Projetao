# Memória do projeto — Alvorada Cinzenta

## Fundo publicado do Reino do Norte

A visão pública agora usa a imagem fornecida pelo usuário em `public/kingdom/north-sonnenberg.png` (1154 × 866), com proporção original, zoom e arraste. Sonnenberg é o único ponto para abrir o registro de missões do reino, incluindo publicação e histórico; o botão acompanha a projeção do mapa. Nenhum local SQL foi renomeado ou removido. O editor continua privado: ao abri-lo, carrega seu próprio fundo, rascunho e câmera; ao fechá-lo, volta ao mapa publicado. As descrições de área vazia abaixo se aplicam somente ao rascunho privado sem upload.

## Estado atual

Inventário compactado: mochila menor, 24 slots iniciais na mochila (quatro fileiras no desktop), largura máxima de 1160 px igual à ficha e base do painel alinhada à coluna da mochila, slots menores também no cofre. Mais itens expandem a grade sem limite artificial. Descrições e transferência por botão ficam em balões ao passar o mouse, focar ou tocar no item; arraste preservado. Inventários vazios mostram apenas os slots, sem mensagens explicativas.

Inventário redesenhado com cenário de espólios `public/inventory-loot-v1.png`, mochila
ilustrada `public/inventory-backpack-v1.png` e slots selecionáveis em `src/Inventory.tsx`.
Resumo de PO, peso em lb e quantidade fica acima da mochila, na coluna esquerda,
alinhado ao topo dos slots, com textura de pergaminho escurecido e ícones ilustrados
em `public/inventory-stat-icons-v1.png` (moedas, peso de pedra e suprimentos).
Mochila reduzida para até 280 px e afastada 54 px abaixo do resumo no desktop.
Painel de slots e histórico usam a mesma textura de pergaminho escurecido dos indicadores.
Seleção mostra descrição,
quantidade, peso total e valor unitário. Espaços vazios são decorativos, sem limite
novo de capacidade. Histórico de compras preservado e recolhido. Equipamento inicial
permanece na ficha, separado das compras.
Cofre compartilhado entre personagens da mesma conta, abaixo da mochila individual,
com a mesma textura. Migration 020 cria `account_vault` e auditoria `inventory_transfers`.
GET `/api/characters/:id/storage` retorna mochila e cofre; POST `/api/inventory/transfers`
move quantidades em transação, conferindo sessão, titularidade e personagem não excluído.
Locks na conta e no personagem serializam cofre, compras e exclusão. Chave idempotente
por conta impede repetir transferências. Movimentações não alteram PO nem histórico de compras.
Arraste ou botão abre seleção de quantidade; alternativa funciona com teclado e celular.
O resumo mostra somente peso/itens da mochila. O cofre guarda os itens que ficam em casa;
não há snapshot automático de equipamento de missão nesta etapa.
Validação: 18 testes de API em PostgreSQL isolado; `npm run test:inventory` verifica arraste,
transferência parcial, persistência, troca de personagem e celular em banco descartável.
Cabeçalho segue acampamento/ficha, sem subtítulo. Checkpoint anterior local:
`codex/checkpoint-antes-inventario`, commit `d2e1ef0`. Prompts em `docs/INVENTARIO-PROMPTS.md`.

Experimento de paleta global solicitado em 27/09/2026: primeira versão rejeitada
por excesso de marrom. Revisão com fundos carvão, painéis cinza quente,
ocre/amarelo queimado restrito a destaques e botões principais, aplicado a todas as abas,
menus e formulários. A ficha mantém o pergaminho aprovado; artes e dados preservados.
Ponto de retorno local `codex/checkpoint-antes-paleta-terrosa`, commit `fb075db`.
Aguarda avaliação do usuário; não reintroduz modo claro.

**Ficha** substitui Perfil. Fundo de biblioteca medieval em
`public/character-library-v1.png`; telas Atributos, Combate, Magias e História/equipamento.
Experimento visual de pergaminho na ficha: a primeira versão escura foi rejeitada.
A V2 usa papel claro envelhecido em `public/character-parchment-v2.png`, tinta marrom,
controles translúcidos e cores locais que corrigem a interferência azul do tema.
Prompt em `docs/PERGAMINHO-PROMPT.md`; biblioteca e tema geral permanecem escuros.
Estilos isolados
em `src/character-parchment.css`. Ponto anterior: branch local
`codex/checkpoint-ficha-antes-pergaminho`, commit `bc96894`; remover o import desse
CSS restaura o visual anterior sem alterar dados. Textura V2 aprovada pelo usuário;
removido o relevo de folhas empilhadas, textos escurecidos para melhorar o contraste
e título “Ficha” sem ponto final.
Cabeçalho da Ficha usa a mesma largura do acampamento: máximo de 1524 px, margens
laterais de 24 px (14 px até 760 px). Conteúdo centralizado, mais estreito, com máximo
de 1160 px; título e seletor mantêm o enquadramento largo.
Cabeçalho separado do conteúdo por 80 px na ficha, ampliado a pedido do usuário.
Legendas e notas auxiliares da ficha ficam no ícone de informação ao lado do título
correspondente (hover, foco pelo teclado ou toque). `SheetHelp` usa popover nativo,
fecha com Escape/clique fora e mantém o balão dentro da tela. Valores e avisos de
confirmação definitiva permanecem visíveis.
Cabeçalho da Ficha alinhado verticalmente ao seletor de personagem no desktop,
com título no tamanho do acampamento e sem subtítulo. No celular, empilha como no acampamento.
O modal de criação usa até 960 px, com três colunas de opções no desktop e largura adaptável no celular.
Não repetir o cabeçalho de identidade dentro da ficha: o personagem ativo aparece
no seletor superior; os dados detalhados permanecem nas seções da ficha.
A criação coleta escolhas de nível 1 do SRD 5.1: origem, treinamento, equipamento,
perícias, idiomas/ferramentas e magias. Novos jobs exigem escolhas válidas; o worker
as salva após concluir a arte e recebe sub-raça/ancestralidade validadas.
Migration 019 cria `character_sheets`. Na Ficha, rolar uma única vez seis grupos de
4d6, descartar o menor, distribuir e confirmar. Dados gerados no servidor com
`crypto.randomInt`, persistência e bloqueio por personagem; refresh/clique duplo
nunca rerrolam. Bônus raciais, PV, CA, salvaguardas e perícias são derivados.
Personagens antigos completam escolhas sem perder arte, XP, saldo ou inventário;
atributos/PV/CA só mudam ao confirmar. Recursos de sessão, preparação e notas
são salvos com titularidade no servidor. Escopo é ficha inicial nível 1;
progressão e efeitos automáticos de combate continuam fora. Ver `CHARACTER-SHEET.md`.
Validação: build, 17 testes de API em banco isolado e `npm run test:sheet` (Edge,
criação real com arte de teste, persistência, magias/notas e quatro seções mobile).

A barra superior extensa foi substituída por um painel compacto de personagem
e conta no canto superior direito: seletor, nível/raça/classe e saída. No
acampamento em desktop ele flutua sobre o cenário; em telas estreitas ocupa
uma linha própria para não cobrir o título. O menu inferior mantém a navegação.
O acampamento exibe somente o título e capacidade; o status do ilustrador aparece
apenas dentro do modal de gerar imagem. Foram
removidos o subtítulo da fogueira, a orientação de escolher aventureiro e a frase
da cota mensal. O seletor do painel não acende ao abrir ou passar o mouse.

A aba Personagens agora é um acampamento ilustrado com figuras de corpo inteiro.
O cenário `public/character-camp-v2.png` tem fogueira central, personagens em
dois lados e brasas animadas discretas (desativadas com movimento reduzido).
O enquadramento alinha a base do fogo ao chão das figuras por tamanho de tela;
as colunas compartilham a linha de chão mesmo quando os textos quebram linhas.
As figuras e suas sombras usam redução global de 20% para combinar com o cenário,
preservando a escala relativa por raça e a ancoragem dos pés no chão.
Os painéis abaixo das figuras usam escala de 85%, incluindo textos, ações e ícones.
Limite de dois personagens por conta; dois pedidos de imagem por personagem por
mês civil UTC (imagem inicial incluída, falhas liberam cota). Novos personagens
são criados somente após a arte ficar pronta; antigos sem imagem mostram silhueta.
Migration 015 guarda referências privadas, fila e imagens no PostgreSQL. Um agente
local em `npm run art:worker` chama a geração nativa de `codex exec` com login
ChatGPT, sem API key. Depende do host ligado e da assinatura do operador; não roda
dentro do Docker. Prompt fixo `docs/CHARACTER-ART-PROMPT-v1.md`, referência visual
`docs/references/character-style-v1.png`. Consulte `docs/CHARACTER-ART.md`.

O acampamento alinha títulos e rodapé à largura/margens do cabeçalho superior
(máximo 1524 px). Placeholder ilustrado em `public/character-silhouette-v2.png`.
Não exibir contadores de imagens nem datas de renovação; exibir erro ao exceder.
Status do ilustrador apenas no modal de gerar imagem, com ponto
verde online/vermelho offline (exceção de cor solicitada para esse indicador).
O fundo cobre toda a viewport, inclusive atrás do cabeçalho. O acampamento
distribui a altura disponível sem rolagem da página; figuras se reduzem conforme
a tela. Silhuetas pretas com contorno cobre iluminado apenas em hover/foco.
As figuras compartilham a mesma linha de chão e escala por estatura racial em
`shared/character-stature.ts`: halfling 92 cm, gnomo 107, anão 137, humano/elfo/
meio-elfo/tiefling 175, meio-orc 190 e draconato 200. São referências visuais
compatíveis com as descrições de 2014, não alturas individuais oficiais fixas.
O prompt exige anatomia racial adulta e enquadramento uniforme. Artes existentes
recebem a escala imediatamente; proporções anatômicas novas dependem de nova arte.
Cada cartão oferece Excluir personagem, confirmado pelo nome. Migration 016
marca `deleted_at`: remove o personagem da seleção e libera a vaga, bloqueia
compras, novas inscrições e geração de arte, mas preserva auditoria e missões
anteriores. A imagem é removida. Pedidos de arte em andamento impedem a exclusão.
Avisos de falha existem apenas no estado do frontend por cinco segundos (ou até
fechar no X), quando um pedido observado em andamento falha. Falhas antigas nunca
são notificadas ao carregar a página. Não há dispensa persistida nem localStorage.
A fila mantém o registro técnico da tentativa, sem consumir cota em falhas.
Migration 018 remove a antiga coluna de dispensa criada pela 017.
O worker distingue falha de sessão, limite, conexão, resultado, caminho do arquivo
e validação da imagem. Logs guardam apenas ID e código do motivo; nunca a conversa
do agente, referências ou credenciais. Falhas antigas com mensagem genérica não
permitem recuperar o motivo exato. A referência continua sendo descartada após falha.
O ilustrador usa eventos JSON do CLI para identificar a sessão exata e obter o
PNG nativo de `generated_images/<threadId>`, mesmo se a resposta textual final
do agente for incorreta. Só aceita um único artefato daquela sessão e mantém
a validação de transparência/formato antes de salvar. Nunca busca a imagem mais
recente globalmente. O UUID da sessão fica no diretório local privado do pedido.

O portal usa React/TypeScript, Node.js, PostgreSQL e Docker Compose. O único território com visão regional é o Reino do Norte. O Mundo continua em Three.js/WebGL, com 22 territórios, relevo, oceano e nuvens. Preserve a silhueta em `docs/references/world-silhouette.png`, a geografia em `public/atlas-world-v2.png` e os materiais em `public/atlas-materials/`. A visão inicial do Mundo é 100%, com zoom máximo próximo de 246% e navegação elástica. Consulte `docs/ATLAS-WORLD-RELIEF.md` e `docs/ATLAS-TERRITORIES.md`.

## Reino do Norte e editor

A composição regional ainda não foi definida. O mapa abre como uma área vazia de 4096 × 3072 px virtuais, sem imagem, pintura, objetos automáticos ou névoa. O usuário autorizado pode enviar PNG/JPEG/WebP como fundo e posicionar sprites com oito vistas dos atlas `public/kingdom/nature.png` e `public/kingdom/structures/atlases/`. Fundos enviados mantêm a proporção original (`tilt=1`); a área vazia usa projeção inclinada (`tilt=0.58`). O zoom de trabalho vai de 0,03 a 32, e **Definir visão atual como 100%** salva zoom, centro e giro. **Remover fundo (área vazia)** apaga somente o upload de fundo do autor; os itens do rascunho permanecem. Consulte `docs/KINGDOM-2D.md`.

**Apenas `correa.l@icloud.com` pode usar o editor neste momento.** A interface esconde o botão para outras contas, e o servidor responde 403 em todas as rotas de rascunho, fundo e visão do editor. A comparação de e-mail é insensível a maiúsculas/minúsculas. O projeto ainda usa rascunhos e fundos privados por usuário: salvar no editor não publica automaticamente a composição para os demais jogadores. O acesso a imagens privadas também é restrito no servidor. Os dados existentes no PostgreSQL não foram apagados pela limpeza de arquivos.

O editor oferece colocação, arraste direto, seleção múltipla com Ctrl + mouse, movimento por setas, duplicação, escala, direção, exclusão, desfazer, upload de fundo e zoom. As migrations 011, 013 e 014 guardam rascunho, fundo e câmera privados. A área virtual usa `15000/3072` unidades por pixel de imagem para aceitar fundos grandes. O mapa e o Mundo têm renderizadores independentes; o reino usa Canvas 2D. Não há fallback de terreno costeiro nem asset padrão.

## Regras e dados a preservar

Better Auth gerencia sessões. Consultas privadas filtram pelo usuário autenticado. Compras usam transação, bloqueio de linha, idempotência e auditoria, com valores inteiros em peças de cobre. Missões, eventos e ganchos compartilham `board_posts`; a geografia vive em `world_regions` e `world_locations`. O servidor resolve o local e deriva a região. Novas missões têm data/hora; o autor conclui, recebe resumo e credita XP uma vez. Eventos exigem `guild_staff`. Os seis locais regionais e missões existentes permanecem no SQL, acessíveis por **Missões do reino**, ainda sem marcadores no mapa.

## Validação

`npm run build` verifica TypeScript e gera cliente/servidor. `npm test` exercita autenticação, isolamento, editor e regras com PostgreSQL real. `npm run test:browser` cobre o fluxo geral. `npm run test:editor` verifica pela interface o editor autorizado, zoom, upload proporcional e restauração vazia em uma instância de teste. `ATLAS_BROWSER_GPU=1 npm run test:atlas -- --world-map-only` verifica o Mundo com GPU real; `--terrain-only` verifica navegação da área regional vazia e `--editor-only` verifica que uma conta comum não recebe acesso ao editor. A API autorizada do editor é testada em `tests/integration.test.ts` com um e-mail de editor temporário injetado apenas na instância de teste; o app real mantém o e-mail fixo acima.

Dados de jogadores e volumes Docker não devem ser apagados. Migrations aplicadas não devem ser modificadas; adicione uma nova quando necessário. O histórico de mapas descartados pode ser consultado nos commits Git anteriores, sem carregar seus grandes arquivos no checkout atual.
