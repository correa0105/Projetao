# Alvorada Cinzenta — instruções para continuidade

Antes de editar, leia `docs/CONTEXTO.md` e `README.md`. Estes arquivos são a memória
portável do projeto. Atualize o contexto quando houver mudanças relevantes no escopo,
nas regras, na arquitetura ou no estado de implementação.

Ao retomar perguntas sobre o estado das regras, lançamento, níveis altos ou suplementos,
leia também `docs/ROADMAP-REGRAS.md`. Diferencie o que está implementado do que está
planejado; não apresente a migração ao SRD como implementação completa de D&D.

## Permissões vigentes (04/10/2026)

Por pedido explícito do usuário, a coluna `"user".administrador` (0/1, padrão 0)
é a única fonte de autorização para editar conteúdo/configuração compartilhados:
Lore (pastas, crônicas, imagens e linha do tempo), Regras, Início, editor do reino
e publicação de eventos. Esta regra substitui as permissões antigas por autoria,
`guild_staff`, `lore_folder_managers` ou e-mail fixo mencionadas abaixo/documentos
históricos. O servidor consulta o banco a cada operação. Não permitir que cadastro
ou perfil promovam a própria conta. Usar `scripts/admin.ts email 0|1` para concessão
explícita a conta já existente. Jogadores continuam gerenciando seus personagens,
inventário, montarias, compras e missões conforme ownership e regras de jogo.

Eventos permanecem em board_posts. Títulos compartilhados e concessão/revogação
também exigem administrador=1. Mascotes e cartas pertencem a cada personagem,
com compra em ouro transacional e idempotente. Cartas permitem três equipadas;
o usuário definirá upgrades depois, e drops serão implementados no futuro.
Não inventar upgrade, distribuição automática ou bônus de cartas nesta etapa.
Detalhes em docs/COMPANHEIROS-EVENTOS-TITULOS-CARTAS.md.

Casa dos mascotes: direção atual de 04/10 substitui a composição inicial com
Baguncinha. Retirar esqueleto/cadeira/café do cenário, Garalho menor, placa
fisicamente nas patas e duas poses para escrever/apresentar. Preservar olhos
separados. Cada arte de animal tem viewport próprio e clipPath SVG explícito
para não cortar silhuetas nem mostrar vizinhos; nunca esticar atlas em células
CSS iguais. Arte, prompts e enquadramento em docs/PET-SHOP-REDESIGN.md.
Refino de 05/10: placa sem riscos/linhas animadas; falas naturais e individuais.
As dez aparências clássicas usam novas artes v3 no nível das alternativas.
Ambas as corujas ficam no chão, sem tronco/poleiro, com patas visíveis.
Preservar tamanho relativo por espécie. Prompts em docs/PET-SHOP-REFINEMENT.md.
Direção posterior de 05/10: corvo clássico também no chão, sem galho, usando
raven-ground-v4.png. Salão de cartas com janela à esquerda, anfitrião menor/ao
fundo em sombra e cartas em leque à frente; conversa aparece só sob interação.
Correção explícita do usuário: preservar a página original de Conquistas e sua
estante. O menu/página independente de Títulos foi removido; o catálogo e a
escolha/administração de títulos ficam dentro de Conquistas. Nome, descrição e
vínculo de cada conquista são editáveis pelo administrador (migration 055).
Não apagar histórico de conquistas, estantes ou títulos recebidos. Exibição de
título separada na tela do personagem/ficha. Detalhes em docs/SALAO-CONQUISTAS.md.

Calendário fica sempre ao final de Início → Diário, abaixo das publicações e sem
aba separada, reunindo eventos, missões e encontros
do Diário sem duplicar registros. Administradores editam apresentação e eventos;
ownership das missões permanece. Eventos usam temporariamente a rua da vila,
com editor integral do cenário preservado. Mascote exibido é escolhido no
inventário por personagem, aparece à direita no acampamento e muda ao selecionar
outro personagem. Raças são editáveis só por administradores; nome pessoal é
definido pelo comprador. Garalho abre conversa só ao clicar nele; miado vem só
após pergunta. Sons de seleção são apenas vozes dos animais, sem impacto extra.
Migrations 056–057 e detalhes em docs/CALENDARIO-MASCOTES.md. Lore usa sequência
de engrenagens entre eras: luz mais lenta ativa a rotação, áudio mecânico acompanha
o percurso e um encaixe firme finaliza; sem bolinha móvel ou linha simples.

## Acordos de desenvolvimento

Torre experimental (06/10): Mural → Torre, 100 andares. Administrador edita
informações, criaturas, armadilhas, guardião por andar, valores e tabelas d100/itens.
Encontros/armadilhas só são retornados pelo servidor após conclusão pessoal/guilda;
o projeto tem uma guilda compartilhada. Não pré-preencher criaturas inventadas.
Arte v2 fechada, sem interiores/biomas expostos e laterais limpas. Versão anterior preservada em 35d5f36 e na tag GitHub
codex/checkpoint-antes-torre-2026-10-05. Mestre é administrador e dono da expedição;
confirma progresso em sequência e retorno. Personagens só entram por ownership.
Ouro/cristais base e d100/relíquia/itens são transacionais e idempotentes (066–068); servidor
resolve todos os valores e sorteia, sem aceitar saldo, andar ou dado do cliente.
Tabela vigente é registrada no retorno; edições não mudam claims já conquistados.
Itens vinculados creditam inventário com tower_item_grants (placas em peças).
Cristais e coleção ficam na Torre; não alterar patentes/XP ou cartas.
Não apagar dados nem migrations ao desfazer o experimento. Guia em docs/TORRE-EXPERIMENTAL.md.

Refino posterior de 05/10: ficha de monstro estruturada com características,
ações e atributos, folha completa em duas colunas e ataques arrastáveis para
a barra existente. Arraste do catálogo para mapa respeita câmera/grade/limites,
apenas mestre fora da prévia. Preservar texto editado, valores de sessão e IDs
de ações de fichas antigas; enriquecimento do catálogo é somente exibição.
Tentáculo do lago inicia abaixo da água, com recorte também nas ventosas;
preservar o percurso exposto, coreografia, som e posição da água.

Correção de perfis (05/10): o estilo das etiquetas não pode atingir `.pet-art`.
Mascotes na visita usam viewport/proporção e largura própria por espécie/aparência;
montarias usam escala do catálogo, imagem proporcional e apoio no chão do cenário.
Preservar as artes/clipPaths aprovados e o caráter somente consulta da visita.

Direção final de 05/10: atacante amarelo e alvo vermelho por clique, ataque/dano/
vantagem/descarte na barra compacta sem modal. Seta sinalizadora salta três vezes;
quando usada pelo mestre sincroniza as câmeras (064), mantendo a visão privada.
Morte fica exclusivamente em Efeitos; boss mantém somente Red/Ice/Grass/Oak/Evil,
com materiais próprios e compatibilidade de leitura dos estilos antigos. Mestre
registra cura quantitativa e edita PV por botão direito com valor absoluto ou
`+N`/`-N`. Combate (065) é independente da revisão do documento: carrossel central,
iniciativa real por dono do personagem, mestre controla início/turno/rodada.
Rolagens personalizadas têm parser próprio no servidor, sem eval, limites e guia
em Configurações/Ajuda. Preservar abreviações matemáticas interoperáveis; nomes e
explicações próprios em português, sem prometer compatibilidade com templates/
atributos de outra plataforma. Artes locais de 330 monstros com manifest/hash.
Detalhes em docs/VTT-PERFIS-HALL.md e docs/VTT-ROLAGENS.md.

Direção posterior de 05/10: participação jogador/espectador (063). Jogador traz
seus personagens automaticamente, sem duplicar/restaurar. Espectador só vê:
não trazer fichas nem permitir chat/dados/movimento/recursos; bloquear no servidor.
Na névoa, acompanha projeção de um jogador escolhido, sem dados privados. Efeitos
no rodapé, prévia local no token e opção Infinito; animações distintas por modelo.
Ataques com alvo comparam CA e oferecem dano no acerto. Dados 3D usam corpos
convexos/colisões/atrito (cannon-es), mantendo resultados do servidor. Seleção sem
movimento não salva e observador da prévia permanece fixo. Detalhes no contexto.

Direção posterior de 05/10: morte sem fragmentos, apenas token inteiro vermelho
e sangue. Menu Efeitos do mestre no canto inferior esquerdo, presets no documento
da mesa e atalhos arrastáveis, inclusive ataques de monstros. Presets privados;
aplicação e atalhos exigem dono administrador no servidor; aparência acompanha
visibilidade do token. Efeitos são visuais, não mudam recursos. Camadas na barra
esquerda; direita ordenada Chat/Arte/Fichas/Biblioteca/Som/Diário/Configurações,
com Ajuda dentro da mesma aba. Preservar controles em Fichas → Token, Chat →
Combate e Configurações → Mapa. Detalhes em docs/VTT-PERFIS-HALL.md.

Refino posterior de 05/10: Calendário tem paleta carvão/azul/cobre, sem selo ou
subtítulo, arte do compromisso selecionado e três fallbacks novos (prompts em
docs/CALENDARIO-PERFIS-REFINO.md). Personagem → Cartas é coleção/equipamento com
três espaços; loja mantém compra. Removido envio de cenário do perfil (servidor
bloqueia novos, preserva antigos), ações lado a lado e resumo inferior retirado.
Molduras escalonadas na diagonal em ambos os lados. VTT agrupa formas e névoa,
com áreas, polígonos e pincel para cobrir/revelar. Visão automática passa a ser
o padrão, inclusive mapas legados afetados (migration 061). Atalhos persistem
por usuário/mesa no PostgreSQL (062); aba trancada precisa ser destrancada antes
de editar, mover ou remover. Boss publica só nome, PV e estilo; configuração e
efeito de morte manual/automático são do mestre. Token morto permanece na mesa.
Restauração continua exclusiva do mestre. Detalhes em docs/VTT-PERFIS-HALL.md.

- Mesa virtual e comunidade (05/10): docs/VTT-PERFIS-HALL.md. Mestre de VTT precisa
  ser dono da mesa e administrador=1; jogadores controlam tokens atribuídos/importam
  seus personagens. PV e condições são de sessão, sem alterar a ficha/saldo original;
  exceção explícita do usuário: usar consumível debita o inventário original em
  transação idempotente auditada. Somente mestre dono e administrador restaura
  recursos, slots, PV ou consumíveis gastos. Importação não pode repor recursos.
  Recursos e vínculo explícito de importação: migration 060. Filtrar no
  servidor tokens, notas, fichas e arquivos privados antes de retornar a jogadores.
- Perfil pessoal editável pelo dono é separado do conteúdo compartilhado administrativo.
  Visitas por ID autenticadas são somente consulta de personagens, conquistas,
  companheiros, ficha e cartas; não expor e-mail, ouro ou inventário privado. DMs só
  entre amigos aceitos, sem acesso administrativo ao histórico de outras pessoas.
  Bloqueio/amizade/envio são serializados por par em transação. Hall calcula dados
  reais no servidor; pesos/presentação apenas administrador. Preserve Conquistas
  original com quatro molduras e limite existente de dois personagens por conta.
  Visitas ocupam a tela inteira. Molduras menores ficam na parede, afastadas do
  teto/vigas, com recorte do rosto. Não retornar à visita encolhida.

- Comunicação e interface em português brasileiro.
- Nome definitivo: Alvorada Cinzenta. Banco/usuário `alvorada_cinzenta`, Compose e package `alvorada-cinzenta`.
- Identidade apenas tipográfica (sem brasão/logo), azul de noite, pergaminho e cobre envelhecido.
  Tema exclusivamente escuro; não reintroduzir modo claro ou seletor de tema. Ícones principais do menu ilustrados em atlas PNG, próximos da prancha de referência do usuário: contorno forte, pergaminho/cobre e volume discreto. Vela em Início, capacete viking em Personagem, espada larga diagonal, bolsa, mapa e livro. Atlas ativo guild-icons-candle-helmet.png, renderizado via SVG com filtro alfa que remove o fundo azul; não exibir como background CSS nem usar máscara circular que corte as pontas. O botão Menu se transforma no painel por expansão, sem traços laterais; arte ocupa 72% do círculo e o hover transforma botão e imagem juntos. Até 600 px, usar grade 3 × 2 para os seis botões.
  O usuário rejeitou verde vivo na interface; aprovou verde-musgo escuro e dessaturado na arte das ilhas. Consultar `docs/IDENTIDADE.md` antes de mudar o tema.
- Projeto web local com Node.js/TypeScript, React, PostgreSQL e Docker Compose.
- Não converter para site estático, localStorage, SQLite ou hospedagem gerenciada sem
  uma decisão explícita sobre a arquitetura. Os dados de jogo vivem no PostgreSQL.
- Não inventar funcionalidades prontas: distinguir conteúdo narrativo de regras implementadas.
- Toda consulta privada deve filtrar pelo usuário autenticado no servidor.
- Nunca confiar em user_id, saldo, preço, nível, recompensa efetivamente paga ou
  atributos fora das regras enviados pelo navegador.
- Compras: manter transação, `SELECT ... FOR UPDATE`, idempotência e registro de auditoria.
  Valores monetários são inteiros em peças de cobre; nunca floats no banco.
- Missões, eventos e ganchos compartilham `board_posts`. Não criar uma tabela de missões paralela.
- Missões exigem a patente exata do personagem, incluindo bloqueio de patentes inferiores. `mission_rank` define pagamento fixo por inscrito no servidor: Ferro 150, Bronze 230, Adamantium 300, Ametista 390, Obsidiana 500 PO. Testes usam a patente de origem e também exigem elegibilidade. Não aceitar recompensa arbitrária do cliente. Consultar `docs/PATENTES.md`.
- Mundo e visão do reino usam o mesmo formulário, endpoint e registros do mural. Geografia em `world_regions`/`world_locations`; o servidor resolve `location_id`, deriva a região e valida disponibilidade. Reino do Norte é o único território explorável nesta etapa. Preservar os locais livres do mural e os seis locais regionais, incluindo Floresta Negra (migration 010). `npm run test:atlas` valida o fluxo geográfico.
- Mundo possui 22 territórios desde a migration 009, com fronteiras terrestres e destaque/clique na superfície. Não retornar aos três destinos apenas. Preservar o oceano único, as margens marítimas ampliadas, ilhotas, Fulkushima e Olho da Tormenta. Novos destinos ficam indisponíveis para exploração interna até implementação explícita. Consultar `docs/ATLAS-TERRITORIES.md`.
- **Mundo deve ser um mapa de relevo real e navegável, ocupando o fundo sem moldura**. O usuário aprovou a modelagem atual: preservar a silhueta fornecida em `docs/references/world-silhouette.png`, a geografia trabalhada em `public/atlas-world-v2.png` e as cordilheiras; não voltar a continentes ovais ou ao PNG plano. A visão inicial e Centralizar usam 100%: câmera recalibrada para preservar o antigo enquadramento de 142%, mantendo composição 8% mais baixa. Zoom máximo equivalente em cerca de 246%. `src/WorldMap.tsx`/`src/world-map.css` usam Three.js/WebGL, pan/zoom e marcadores acompanhando a geometria. Arraste com resistência progressiva nas bordas e retorno suave para dentro. Acabamento com pedra cinza neutra, musgo escuro, detalhe de duas texturas CC0, planícies levemente onduladas e nuvens mais densas/rápidas. A visão próxima do reino, suas regras e painéis permanecem independentes. Usar Mundo, visão do reino e Voltar ao mundo na interface. Para validar animações com GPU real, usar `ATLAS_BROWSER_GPU=1` em `npm run test:atlas -- --world-map-only`; SwiftShader forçado pode não atingir a taxa de frames necessária.
- A **visão do reino** abre como área vazia de 4096 × 3072 px virtuais, sem fundo, terreno, árvores automáticas ou névoa. Renderiza em Canvas 2D; o Mundo 3D permanece independente. Só `correa.l@icloud.com` pode usar o builder neste momento: esconder o botão das demais contas e conferir o e-mail da sessão no servidor em todas as rotas do editor. O rascunho em `kingdom_editor_drafts`, o fundo privado em `kingdom_editor_backgrounds` e a visão em `kingdom_editor_views` são preservados. Salvar ainda não publica para outros jogadores. O upload aceita PNG/JPEG/WebP, incluindo 8K; a área virtual usa 15000/3072 unidades por pixel e acompanha as dimensões reais. Fundos enviados usam `tilt=1` para preservar proporção; a área vazia usa `tilt=0.58`. **Remover fundo (área vazia)** apaga o upload do autor e deixa o retângulo vazio, mantendo os itens. O editor tem sprites em oito direções, arraste, seleção Ctrl + mouse, duplicação, setas, tamanho, giro, exclusão, desfazer e zoom absoluto 0,03–32. **Definir visão atual como 100%** salva zoom, centro e giro; fora do editor, navegar entre 100–130% relativos à visão salva. Preservar os seis locais SQL, missões, usuários e o Mundo. Validar com `npm run build`, `npm test`, `npm run test:browser`, `ATLAS_BROWSER_GPU=1 npm run test:atlas -- --world-map-only`, `--terrain-only` e `--editor-only`. Especificação em `docs/KINGDOM-2D.md`. Não apagar `public/atlas-materials`: o Mundo usa essas texturas.
- Missões novas exigem data/hora; próximas 24 horas aparecem no Início. Somente o autor conclui via `/complete`, com resumo, ouro persistido na missão por inscrito e progressão própria da guilda (sem XP novo). Consultar `docs/PATENTES.md`: testes liberados apenas com nível 4/22 missões, 8/53, 12/80 e 16/102; antes desses totais missões continuam contando. Ao atingir o requisito, normais dão só ouro até concluir o teste. Testes promovem sem somar ao contador. `mission_rewards` audita créditos; conclusão, ouro, progresso e gancho são uma transação idempotente. Não permitir ganchos pelo endpoint genérico. Eventos exigem `guild_staff` no servidor. Nenhuma promoção automática de usuário. Recursos completos de classe de níveis altos ainda não implementados.
- Autenticação via Better Auth. Não implementar hashes ou sessões próprios.
- Migrations SQL numeradas em `db/migrations/`: não alterar migrations aplicadas;
  crie novas. Seeds idempotentes não devem apagar dados de jogadores.
- Catálogo ativo: os 65 itens fornecidos pelo usuário em `data/shop-export/loja.json` (29/09/2026), com dez categorias, imagens e falas. Esta decisão substitui a whitelist inicial. Preservar `data/catalog.json` como snapshot anterior e bens/histórico dos jogadores; itens antigos ficam inativos. Orbe do dragão sem preço não pode ser comprado. Efeitos mágicos descritos não são automação implementada. Checkout transacional, idempotente, com preços resolvidos no servidor. Não importar novos suplementos indiscriminadamente.
- Extensão autorizada em 01/10/2026: cinco Cosméticos e charuto em `data/equipment-catalog.json` (71 ativos no total). Full plate entrega seis peças pelo preço original, peso total 65 lb; demais armaduras só peitoral. Cinco componentes ficam inativos para venda avulsa. Migration 038 entrega peças de armaduras antigas de mochila/cofre uma única vez via seed; preservar auditoria `purchase_item_grants`. Equipamento tem 15 posições, incluindo ombreiras/braçadeiras/pernas; braçadeiras de placas incluem luvas. Objetos portáteis podem ocupar as mãos, preservando quantidade e bloqueio de arma de duas mãos. Detalhes em `docs/EQUIPMENT.md`.
- Arte de luvas cosméticas, colar, tiara e charuto é independente da full plate. Não reutilizar a armadura como referência para esses acessórios nem copiar bordas douradas, rebites ou flores-de-lis. Somente componentes de placas pertencem ao mesmo conjunto visual. Arquivos vigentes dos quatro acessórios são `*-v2.png`; prompts em `docs/EQUIPMENT-ART.md`.
- Não registrar senhas, tokens, cookies ou `.env` em logs/commits.
- Não apagar volumes Docker. Não executar testes em um banco de produção.
- Arquivos e comandos devem funcionar também fora desta máquina. Evitar caminhos absolutos no código.
- `npm run build` valida TypeScript e gera cliente + servidor. `npm test` usa PostgreSQL real.
  Para autenticação, economia, ownership ou ciclo de missão, execute esses testes.
- `npm run test:browser` valida o fluxo real pela interface em `http://localhost:3000`.
  O padrão é Microsoft Edge instalado; `BROWSER_CHANNEL` pode selecionar outro canal Playwright.
- Desenvolvimento com `npm run dev` requer parar o serviço Docker `app`, mantendo `db`.
- A aplicação tem uma única guilda compartilhada. O criador mestra sua missão; staff/admin pode publicar eventos. Campanhas e painel administrativo ainda são próximas etapas.

Não são necessários subagentes para alterações rotineiras; nenhum fluxo de delegação é obrigatório.

## Fluxo Git autorizado pelo usuário (30/09/2026)

Neste checkout, trabalhar na branch Welson e enviar para origin/Welson as alterações solicitadas pelo usuário após validação. Autorização contínua dada nesta conversa. Não enviar para main. Preservar alterações de outras pessoas e backups locais.

## Acabamento inspirado no Inkarnate (30/09/2026)

Direção vigente: acabamento construído diretamente no 3D. A imagem Inkarnate foi retirada do material e permanece somente como referência histórica (docs/ATLAS-INKARNATE.md). src/world-relief.ts usa cores por bioma, fotografias CC0 de solo/rocha projetadas em três eixos, fissuras e estratos calculados no shader, erosão nos vértices e copas de árvores em duas malhas instanciadas com sombras reais. src/world-ocean.ts calcula espuma costeira irregular animada. Preservar geografia, territórios e navegação; não reaplicar a imagem completa sobre o terreno. Detalhes e validação em docs/ATLAS-3D-MATERIALS.md.

## Refino de costa, árvores e deserto (30/09/2026)

Ondas costeiras agora têm cristas móveis acompanhando a costa, variação orgânica e espuma com antialias. Árvores menos densas (espaçamento 0,085 e probabilidade menor), copas menores e textura procedural de folhagem. Fronteiras do território em hover ficam mais largas e recebem passe transparente acima das copas, sem interceptar cliques. Deserto tem dunas assimétricas na geometria, grãos e ondulações no material. Por pedido explícito, o vulcão Fulkushima, lava, rochedos associados, águas rasas e marcador foram retirados do Mundo; as duas ilhotas cônicas no extremo sul também foram removidas. Os registros SQL e a tag mapa-3d-2026-09-30 são preservados. São 21 marcadores visíveis; a lista histórica continua com 22 IDs. Esta decisão substitui a antiga exigência de preservar o vulcão na cena.

## Correção de ondas e copas (30/09/2026)

Usuário rejeitou as faixas brancas das ondas e o acabamento das árvores. Oceano deixa de usar frentes baseadas em distância costeira; ondas de vento em duas direções e ruído animado modificam a normal da água. Espuma restrita a manchas discretas no encontro com a costa. Copas refeitas com sete grupos de folhagem nas árvores largas e nove nas coníferas, tronco, proporções variáveis e detalhes de normal no material. Mantida densidade reduzida e fronteiras em hover acima das copas. Não restaurar os contornos brancos nem os modelos simples de esfera/cone.

## Água e bosques mais cheios (30/09/2026)

Copas 28% mais largas, altura ligeiramente menor e árvores aproximadas em pequenos bosques determinísticos. Mantida exatamente a quantidade de instâncias: redistribuição aproxima cada árvore do centro local e rejeita movimentos para costa, neve ou encosta íngreme. Oceano ganha ondulações finas, movimento de luz turquesa nas águas rasas e rugosidade variável para reflexos; sem reintroduzir contornos brancos. Fronteiras no hover permanecem acima da vegetação.

## Vegetação contínua — direção vigente (30/09/2026)

Usuário rejeitou miniaglomerados e pediu remover as árvores para refazer o visual naturalmente. Removidas todas as malhas de árvores individuais, galhos, instâncias e agrupamento em bosques. Vegetação agora integra a malha do terreno: cobertura por bioma, clareiras amplas, exclusão de desertos/neve/encostas íngremes, corredores junto aos rios, relevo sutil e textura procedural contínua de copa. Não voltar aos grupos de árvores isoladas. Água, fronteiras, navegação, SQL e ponto de restauração permanecem preservados.

## Árvores visíveis — correção da intenção (30/09/2026)

Usuário esclareceu: remover os modelos e miniaglomerados anteriores significava refazer árvores visíveis, não eliminá-las. Direção vigente mantém cobertura vegetal no chão e árvores 3D distribuídas em áreas amplas de floresta pela mesma cobertura contínua, com clareiras e exclusão de costa/neve/encostas íngremes. Quatro variações de copa larga/conífera, copas mais cheias, tamanhos e orientação variáveis; sem atração para centros locais nem miniaglomerados repetidos. Mantidos água, fronteiras acima das copas, navegação e ponto de restauração.
