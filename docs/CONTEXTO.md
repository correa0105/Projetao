# Memória do projeto — Alvorada Cinzenta

## Retomada futura: níveis altos e suplementos (28/09/2026)

O usuário pediu para guardar o estado real das regras e o que falta para ampliar o sistema.
Consultar `docs/ROADMAP-REGRAS.md` ao responder "o que temos que fazer?" ou "como está o sistema?".
A base atual cobre criação/ficha de nível 1 do SRD 5.2.1; não equivale a D&D completo.
Progressão 1–20 e suplementos escolhidos pelo usuário são etapas futuras, ainda não implementadas.
Nenhum suplemento específico foi aprovado nesta conversa. Esta solicitação é de documentação,
não de iniciar a implementação dessas etapas.

## Migração atual: SRD 5.2.1 / D&D 5.5e (2024)

Por solicitação explícita do usuário, a referência vigente é SRD 5.2.1, substituindo 5.1/2014 em todas as regras implementadas. As seções antigas abaixo descrevem histórico. Ver `docs/SRD-2024.md` e `docs/ATTRIBUTION.md`. Criação de nível 1, nove espécies, doze classes, quatro antecedentes e talentos de origem do SRD; maestrias e conjuração revisadas, 83 magias de níveis 0/1. Subclasses não aparecem no nível 1. Progressão e combate automático continuam fora do escopo implementado.

Migration 025 arquiva personagem/ficha antigos, mantém dados rolados/atribuição/notas/arte/bens e pede revisão de escolhas; não converte uma espécie legada sem escolha do jogador. Novas fichas usam choices.version=2 e rules_version=5.2.1. Riqueza oficial de classe/antecedente é creditada uma vez na finalização de novos personagens (gold_cp=0 até então); migrados conservam o saldo, sem crédito novo. Endpoint rest-choices permite somente trocas legais de maestria, truque de alto elfo, um truque de mago e magias do tomo, sem alterar atributos, origem ou ouro. Descansos e efeitos são adjudicados na mesa.

Checkpoint anterior local: commit local identificado pela mensagem "Preserva ficha e conquistas antes da migracao SRD 5.2.1". Testes: matriz de espécies/classes/antecedentes/linhagens, migração SQL, ownership, concessão concorrente única de ouro e navegador desktop/mobile.

## Fundo publicado do Reino do Norte

A visão pública agora usa a imagem fornecida pelo usuário em `public/kingdom/north-sonnenberg.png` (1154 × 866), com proporção original, zoom e arraste. Sonnenberg é o único ponto para abrir o registro de missões do reino, incluindo publicação e histórico; o botão acompanha a projeção do mapa. Nenhum local SQL foi renomeado ou removido. O editor continua privado: ao abri-lo, carrega seu próprio fundo, rascunho e câmera; ao fechá-lo, volta ao mapa publicado. As descrições de área vazia abaixo se aplicam somente ao rascunho privado sem upload.

## Conquistas: troféus e arraste horizontal (28/09/2026)

Substitui a apresentação de medalhas descrita no histórico abaixo. Sete objetos ilustrados em `public/trophies/` (livro, bolsa, pergaminho, elmo, tomo com pena, baú e coroa), gerados com imagegen integrada; painéis usam `achievement-wood-v1.png`, madeira escura neutra. Acabamento selecionado tem apenas contorno, sem losango. Cada posição mantém sua prateleira e ganha coordenada horizontal contínua de 0–90%; pointer capture suporta mouse/toque e setas ajustam 1% (Shift: 5%). Sobreposições são permitidas, nomes aparecem no hover/foco e as bases acompanham os tampos da arte (34,2%, 55,6%, 76,2% da altura). Migration 026 acrescenta positions sem apagar slots antigos. Salvar persiste posições com validação de limites, titularidade e desbloqueio no servidor. Teste de navegador isolado cobre arraste, eixo vertical fixo, persistência, posições coincidentes, limites, isolamento e mobile. Prompts em `TROFEUS-PROMPTS.md`.

## Estado atual

Pergaminho da ficha (28/09/2026): a pedido do usuário, restaurada a textura original com `center / 760px auto repeat`. As tentativas com `100% 100%` e depois `cover`/`fixed` foram rejeitadas. Preservar a aparência original; as emendas da repetição permanecem como antes.

Conquistas V2 segue referência ilustrada do usuário: estante medieval entalhada, 18 posições em três prateleiras (seis por linha, espaçamento compacto), catálogo abaixo. Cenário de casa medieval antiga em `achievement-house-v2.png` (enquadramento amplo, mais teto e piso); estante recortada com transparência em `achievement-cabinet-v3.png`, integrada à parede com sombra de contato e escala/posição vinculadas à projeção do chão, mantendo as posições interativas e o degradê escuro aprovado. Usuário escolheu modelo E para a primeira conquista: selo de cera bordô com pena em cobre e fitas, em `achievement-first-chapter-seal-v1.png`, aplicado no catálogo e na estante. Cada conquista deve ter identidade própria; esse modelo não é um padrão para todas. As outras conquistas usam `achievement-insignias-v2.png`: primeira compra em placa octogonal de bronze com bolsa/moeda; chamado em escudo de aço com pergaminho/espada. Todas compartilham acabamento em relevo minimalista, mas têm silhuetas e contornos de medalha distintos, sem ícone de linha sobreposto e sem seletor de moldura. Acabamento ornamentado dos controles foi rejeitado e removido. Configuração e catálogo seguem o inventário: textura de pergaminho aprovada com multiply em marrom neutro bem escuro (#29261f), sem matiz avermelhado, bordas discretas, controles simples e materiais selecionados pela amostra com borda/losango (rádio acessível oculto visualmente), busca compacta de 36 px com lupa alinhada; catálogo permite pesquisar por nome sem distinção de acentos/maiúsculas, combinado aos filtros de desbloqueio. Personalização recolhível via details/summary, inicialmente fechada, com chevron à direita. Nenhuma posição selecionada inicialmente; clicar novamente desmarca e salvar limpa a seleção. Indicador + centralizado geometricamente no slot; nomes das insígnias na estante aparecem somente no hover/foco. Migration 023 amplia a grade preservando prateleira e ordem dos itens anteriores. Tipo de estante mostra a atual e alternativas desabilitadas como Em breve. Campo legado medal_frame preservado no banco por compatibilidade. Arte V2 anterior preservada. Acabamentos visuais de nogueira, carvalho e ébano usam filtros sobre a arte; cada conquista possui sua moldura integrada à arte. Migration 022 estende a tabela 021 sem apagar configurações anteriores. GET/POST `/api/characters/:id/achievements` salva por personagem, valida titularidade, desbloqueio, códigos e posições únicas. `AchievementShelf` reutilizável para futura aba. `npm run test:achievements` cobre persistência, posições, isolamento, bloqueios e mobile em banco descartável.

Ficha em apresentação visual experimental: salvaguardas e perícias em cartões compactos com bônus destacados, confirmação para proficiência e setas duplas para especialização (legendas no ícone de ajuda). Sentidos em indicadores, idiomas em etiquetas e equipamentos em cartões com ícones. Combate acompanha o padrão: cartões de ataque com acerto, dano e tipo; traços em blocos com título e descrição, escolhas de terreno/inimigo identificadas. Regras e dados preservados. Checkpoint local antes desta apresentação: `codex/checkpoint-antes-ficha-visual` (`c2d85f0`).

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

### Novas metas de conquistas
- Catálogo com 7 conquistas e insígnias próprias; atlas `achievement-milestones-v1.png` para as quatro novas.
- Veterano do Norte: 10 participações em missões concluídas no Reino do Norte, verificadas por `mission_rewards` e região do mural.
- Conte uma história: uma missão concluída como autor/mestre da conta; disponível para seus personagens.
- Fortuna em circulação: compras acumuladas do personagem somando 100.000 PC (1.000 PO), sem contar saldo, transferências ou pedidos repetidos.
- Honra do Norte: meta de 300 de reputação cadastrada, explicitamente Em breve. Ainda não há sistema nem regra de ganho de reputação; aguarda definição do usuário.
- Migration 024 amplia códigos. A rota autenticada reconcilia conquistas históricas ao abrir/salvar estante, com progresso calculado no servidor, titularidade e concessão idempotente.

Catálogo de conquistas paginado em cinco itens por página, com Anterior/Próxima e contador. Busca, filtro e troca de personagem retornam à primeira página; paginação é aplicada após os filtros.

Controles de expandir/recolher padronizados globalmente em src/disclosures.css: sem triângulo nativo à esquerda; chevron à direita herdando a cor do painel e girando quando aberto. Aplicado à ficha, escolhas, histórico do inventário e personalização da estante; preserva details/summary e teclado nativos.

Mercenários removido completamente a pedido do usuário: sem aba, navegação, tipo de página ou seed demonstrativo. Migration 027 remove somente registros de world_entries dessa seção e a exclui das seções permitidas; personagens de jogadores não são afetados.

Mural visual (28/09/2026): NoticeBoard atende board/missions/hooks com três folhas PNG (Ganchos, Missões, Eventos), títulos manuscritos, hover quente/foco e painel por categoria com filtros e ações existentes. Cenário ativo notice-village-corner-v2.png: mural velho preso à parede da taverna num canto da vila, rua lateral e avisos decorativos. Usuário rejeitou o mural isolado no centro da praça; preservar integração à parede. Publicação reutiliza PostForm e board_posts; Eventos só oferece publicação a staff/admin, Ganchos continuam da conclusão. Nenhuma alteração no Mundo/atlas ou banco. test:notice-board usa banco descartável e cobre folhas, filtros básicos, formulário, permissão visual, foco e mobile. Prompts em NOTICE-BOARD-PROMPTS.md.

Revisão do mural V3: usuário rejeitou cenário V2 preso à parede e fonte manuscrita. Ativo notice-village-tavern-v3.png, com mural independente de dois pés apoiados no calçamento, junto à entrada da taverna. Letras das categorias em Cinzel com sombra de entalhe, sem inclinação. Folhas reposicionadas para a área central da madeira. Preservar pés e posicionamento lateral contextualizado.

Mural V3 ajustado: cenário e folhas agora compartilham um plano fixo, ampliado e centralizado no mural; página sem scroll em 100dvh. Papéis com inclinações/alturas diferentes e filtro de envelhecimento para aproximar os avisos laterais. Categorias abrem dialog nativo acima de tudo (showModal), X/Escape/clique fora fecham, foco retorna à folha; só o conteúdo do pop-up rola. Teste verifica ausência de scroll na página e publicação em dialog sobreposto.

Mural aproximado novamente (escala desktop max(145vw,180dvh)); pop-up, cabeçalho e cartões usam a textura achievement-wood-v1.png com madeira escura das conquistas e especificidade que sobrepõe o tema global dos dialogs.

Folhas do mural V2: novas artes hooks-v2.png, missions-v2.png e events-v2.png em public/notices, geradas tomando o cenário como referência. Papel plano, marrom sujo, manchas e bordas discretas, sem grandes dobras; sombra reduzida e tom integrado aos avisos laterais. Posições/enquadramento aprovados preservados.

Menu Aventura agora contém somente Mural. Cabeçalho: Mural Alvorada (inclusive nos links antigos missions/hooks). Títulos das folhas usam IM Fell English SC local em public/fonts, fonte antiga sob OFL, com desgaste e entalhe aprofundado.

Folhas V3 ativas em public/notices/*-v3.png: desenhos em tinta marrom forte, estilo xilogravura (chave/trilha, espada e lanterna), substituindo aparência de lápis rejeitada. Títulos clareados em ocre com entalhe discreto para melhorar leitura; removido preenchimento listrado/transparente e sombra profunda que se confundiam com a madeira.

Folhas V4 ativas: public/notices/*-v4.png. Predomínio de escrita envelhecida, símbolos pequenos (chave, espada e lanterna) integrados ao papel, tinta mais discreta. Hover suavizado para evitar brilho excessivo. Substitui os grandes desenhos em xilogravura rejeitados.

Revisão funcional do Mural: renderização dos cartões não repassa mais o índice do map como opção compacta (seta indevida nos cartões seguintes). Todos exibem inscrição, autoria, ações e histórico completos. Feedback de ações aparece dentro do dialog; abertura foca o título, fechamento restaura a folha. Textos longos e metadados ajustados para telas estreitas. test:notice-board cobre publicação real, inscrição persistida, iniciar/encerrar, filtros, ausência de cartões compactos, permissões visuais, dialogs sobrepostos, Escape, foco e mobile; testes em PostgreSQL descartável. Build e 22 testes de integração aprovados.

Títulos das categorias do mural agora ficam sobre as próprias folhas, abaixo do prego, em tinta marrom-escura (notice-paper-title), substituindo o texto sobre a madeira. Papel e título compartilham hover e inclinação. Artes V4 e cenário preservados. Build e teste de navegador do mural aprovados.

Ajuste dos avisos: folhas dimensionadas pela largura e proporção fixa, sem altura percentual que as alongava; títulos ampliados de 8,8 para 14cqw. Conferência visual e teste do mural aprovados.
