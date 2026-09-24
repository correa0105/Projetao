# Visão do reino — cenário 2D em oito direções

**Chão atual (24/09/2026):** `public/kingdom/ground-trails.png` traz apenas grama/terra ilustradas e cinco trilhas conectadas às seis áreas reservadas para locais. Não há objetos colocados nem desenhos de árvores, cidades, rochas ou rios. A fonte `docs/references/kingdom-ground-paths-source.png` é ortográfica; `node scripts/prepare-kingdom-ground.mjs` a prepara em 3072 × 3072 px. `paintKingdom` projeta a imagem inteira no plano inclinado, por isso a perspectiva de todas as trilhas acompanha o giro da câmera. As áreas de destino ficam livres para futuras construções do editor, que continua com rascunhos privados existentes. A seção seguinte descreve a versão anterior do chão sem trilhas.

**Etapa anterior, chão sem trilhas (24/09/2026):** a cena regional usa somente `public/kingdom/ground-turf.png`, solo original de 3072 × 3072 px em tons dessaturados de grama e terra. A textura não inclui estradas, rios, costas, árvores, estruturas, marcas de locais nem elementos com perspectiva fixa; ela é projetada sobre o chão e gira com a câmera. Nenhum objeto é colocado automaticamente e não há nuvens sobre a área editável. Os arquivos antigos `terrain-*.png` foram retirados de `public/kingdom/`; as referências históricas continuam em `docs/references/`. `node scripts/generate-kingdom-ground.mjs` reproduz o solo. O editor continua disponível com seus atlas de objetos, mas a migration 012 apaga os rascunhos anteriores para começar uma composição vazia. Os seis locais SQL e suas missões permanecem, sem alvos visuais no mapa. A área de 15000 × 15000 unidades, navegação, zoom e névoa apenas na borda foram mantidos. As seções abaixo descrevem etapas históricas quando citam o terreno pintado, nuvens ou bosques automáticos.

**Editor de objetos:** `Editar mapa` abre o catálogo dos atlas existentes. Adicionar coloca um item com clique no mapa; Selecionar permite arrastá-lo; os controles ajustam tamanho, vista em passos de 45°, exclusão e desfazer. Uma lista encontra os itens colocados e Salvar rascunho persiste a composição na tabela `kingdom_editor_drafts` para o usuário autenticado. O rascunho reaparece quando ele voltar, sem publicá-lo a outros jogadores. Quando o usuário concluir, o agente incorporará a composição ao cenário comum. Os grupos de árvores procedurais são cenário de base, não itens do rascunho.

**Árvores nesta etapa:** grupos densos de pinheiros e carvalhos do atlas `public/kingdom/nature.png` ocupam as quatro regiões de mata indicadas pelo usuário no master 6 × 6. Mais de 100 árvores de 450–590 unidades se sobrepõem para formar bosque, com escala e direção variadas. A disposição é determinística e consulta o próprio terreno para manter estradas, água, pedras, troncos e clareiras livres. Somente essas árvores voltaram como objetos; edificações, rochas separadas, marcos e alvos clicáveis ainda aguardam a próxima etapa.

**Acabamento atual da borda:** a névoa exterior é totalmente opaca, com textura procedural branco/cinza. Um único campo baseado na distância às bordas do terreno cobre o limite físico da imagem. Sua opacidade decai continuamente para dentro do mapa até chegar a zero; o ruído varia a profundidade ao longo de cada lado, formando uma frente irregular e conectada. A transição alcança no máximo 96 px CSS. Não há círculos, faixa PNG repetida, selo opaco estreito nem salto de transparência; a animação segue as coordenadas do mapa.

**Movimento próximo à borda:** duas escalas de textura, o contorno e mechas translúcidas derivam em velocidades diferentes. O movimento é visível quando a câmera está parada, sem deslocar o terreno, e congela com a preferência de movimento reduzido.

**Atmosfera vigente:** a visão inicial ficou 15% mais distante que o enquadramento próximo anterior, preservando a navegação pelo master 6 × 6. Nuvens branco/cinza têm mais contraste e atravessam o mapa cerca de 4,3 vezes mais rápido. A névoa de borda é mais uniforme e densa dentro da mesma faixa de até 96 px CSS; além do limite físico da imagem há névoa opaca texturizada, visível durante o arraste elástico, sem fundo verde. As camadas continuam vinculadas ao terreno.

**Enquadramento atual:** a vista de 100% mantém a aproximação aprovada, mostrando parte do master 6 × 6 para navegação; o zoom máximo é 130%. Os limites do arraste são calculados para cada borda projetada, de modo que é possível percorrer o terreno até seu fim real ao norte, sul, leste e oeste. A versão que enquadrava todos os cantos ao mesmo tempo foi rejeitada.

**Revisão atual:** escala visual do enquadramento nominal multiplicada por 0,384 em relação à original, mais 20% distante que a revisão de 0,48. Nuvens procedurais e névoa usam as coordenadas e a transformação do terreno, de modo que o arraste/giro/zoom não as fixa à tela. Os bancos ainda derivam lentamente com o vento. A névoa, mais clara e densa, acompanha apenas o perímetro físico do mapa; sua profundidade em unidades é recalculada com o zoom para nunca ultrapassar 96 px CSS projetados (e menos no celular). O terreno permanece em Canvas próprio. A configuração de 0,48 imediatamente abaixo é histórica.

**Configuração atual:** enquadramento do terreno 6 × 6 multiplicado por 0,48 em relação à escala original, 20% mais afastado que a revisão de 0,6. Bancos de nuvens procedurais seguem o ruído FBM e a deriva do efeito do Mundo, adaptados em `src/kingdom-atmosphere.ts` para Canvas 2D. Uma segunda camada produz névoa leve e móvel somente nas bordas, com penetração máxima de 96 px CSS; no celular a faixa é proporcionalmente menor. O chão é uma camada independente e permanece estático quando a câmera para. O zoom nominal continua 100–130%. A descrição abaixo sobre ausência total de névoa é histórica.

**Configuração vigente:** terreno 6 × 6, enquadramento visual 40% mais afastado (escala da câmera multiplicada por 0,6), sem névoa. O Canvas não gera máscara, não carrega `cloud-bank.png` e não desenha nuvens nem acabamento opaco nas bordas. Quando não há movimento da câmera, o terreno permanece estático. O zoom nominal segue em 100–130%. As seções históricas abaixo que descrevem névoa regional foram substituídas por esta decisão.

Em 24/09/2026, o master 6 × 6 aprovado foi aplicado como `public/kingdom/terrain-hires.png` de **5760 × 5760 px**, a partir de 36 pinturas regionais. A área virtual passou a **15000 × 15000 unidades** para oferecer seis regiões por eixo na escala física anterior. O Canvas 2D, zoom de 100–130%, terreno/nuvens somente, Mundo 3D, registros SQL e missões permanecem. Montagem e fontes em `docs/KINGDOM-ART.md`. Descrições do 4 × 4 abaixo são históricas.

## Histórico: terreno master 4 × 4

Em 24/09/2026, o primeiro master quadrado selecionado pelo usuário substituiu o mosaico anterior após ampliação regional. Dezesseis guias de 836 × 836 px têm núcleo de 720 px e 58 px extras de cada lado (8,1%); cada versão detalhada mede 1254 × 1254 px. A montagem final `public/kingdom/terrain-hires.png` mede 4320 × 4320 px. `scripts/prepare-kingdom-master.ts` e `scripts/stitch-kingdom-master.ts` reproduzem o preparo e a montagem sem escalar o terreno de modo desigual. A área virtual é 10000 × 10000, sem distorção de proporção. Os objetos e pontos clicáveis permanecem ocultos nesta etapa; Mundo, seis locais SQL e missões não mudaram. As seções de mosaico 3 × 4 abaixo documentam o estado anterior.

Validação desta revisão: montagem reproduzível por SHA-256, inspeção do mapa inteiro e de junções em tamanho real, `npm run build`, `npm test` (10/10), `ATLAS_BROWSER_GPU=1 npm run test:atlas -- --terrain-only` e `--world-map-only` aprovados. O app Docker e o banco ficaram saudáveis; `/api/health` retornou `ok`. Capturas atuais: `test-results/kingdom-terrain-entry.png`, `kingdom-terrain-west.png`, `kingdom-terrain-mobile.png`.

Decisão de produto de **23/09/2026**: substituir toda a cena 3D interna do Reino do Norte por um cenário 2D medieval, inspirado na leitura de Don't Starve. A mudança vale somente para a **visão do reino**. O **Mundo** continua em Three.js, com relevo, oceano, nuvens e 22 territórios.

## Histórico: etapa de terreno e névoa

**Atualização da composição (23/09/2026):** a pintura única quadrada foi descartada após a correção do usuário. O terreno ativo mantém as seis pinturas originais na faixa central, com três novas ao norte e três ao sul: grade **3 × 4, 4608 × 4096 px**, proporção próxima do quadrado, cena virtual **11250 × 10000**. `scripts/stitch-kingdom-terrain.ts` preserva as fontes originais sem esticá-las e aplica uma repintura localizada na emenda do bosque ocidental, onde havia uma clareira repetida e uma trilha coberta por árvores. Nuvens pintadas em PNG transparente percorrem as quatro bordas sobre uma máscara de nevoeiro que fica opaca antes do limite da imagem. A distância inicial aprovada continua em 100%; 100% é o zoom mínimo e 130% o máximo. A câmera começa no centro para permitir explorar norte, sul, leste e oeste. Os locais poderão ser reposicionados quando os sprites voltarem; os registros SQL não foram alterados.

O usuário pediu que a construção do reino prossiga por etapas. **Todos os objetos e pontos clicáveis foram removidos temporariamente da cena** para avaliar apenas o chão e a atmosfera. Os arquivos de sprites e os seis locais SQL permanecem intactos para a próxima etapa. O botão Missões do reino segue consultando as postagens do território; o mural continua criando missões com local. A seleção direta de cidades no mapa está indisponível até o retorno de suas estruturas.

`public/kingdom/terrain-hires.png` agora mede **4608 × 2048 px** (seis fontes 1536 × 1024, grade 3 × 2). Duas novas pinturas de montanhas e floresta estendem a borda oeste; `scripts/stitch-kingdom-terrain.ts` cria o arquivo contínuo sem esticar a arte, com correção cromática restrita às emendas de 24 px. A área virtual mede **11250 × 5000 unidades**. O zoom inicial mostra mais chão que antes, mas a interface indica **100%**; a câmera para antes de alcançar a borda. A névoa branca aumenta progressivamente com contorno irregular, os bancos de nuvem se movem e a cor exterior coincide com a borda opaca, evitando a antiga listra escura. Movimento reduzido congela a atmosfera. `TERRAIN_ONLY` em `src/KingdomMap.tsx` marca este estágio; `data-stage=terrain` permite verificá-lo no navegador.

Verificação vigente: `npm run build`, `npm test` (10 testes), `ATLAS_BROWSER_GPU=1 npm run test:atlas -- --terrain-only` e `--world-map-only` aprovados. O teste de terreno confirma zero alvos/sprites, 100% inicial, zoom/arraste/reset, movimento da névoa, bordas, desktop e celular. O smoke completo abaixo pertence à fase com cidades e deve ser retomado quando forem reintroduzidas.

## Histórico da composição com sprites

O chão vigente é **uma imagem física de 3072 × 2048 px**, `terrain-hires.png`, reunida dos quatro quadrantes detalhados em `scripts/stitch-kingdom-terrain.ts`. A pintura única provisória de 1536 × 1024 px foi rejeitada por perder definição no zoom; não utilizá-la. A correção de exposição nas junções atua só em 24 px de cada lado, sem desfocar o restante do terreno. O reino virtual mede **7500 × 5000 unidades**; a câmera inicial mostra apenas Vigília, exigindo navegação para os demais povoados. A névoa branca cresce de modo irregular para as bordas e nuvens translúcidas se movem. Construções, árvores, rochas, totens e barco são sprites separados. Cada um dos seis locais é um conjunto de edificações em torno de seu marco principal; as construções levam ao mesmo local e registro SQL.

As pranchas têm **oito vistas reais de cada objeto**, uma por orientação de 45°. Não basta espelhar ou girar uma única imagem na tela. A projeção do terreno gira, os objetos continuam verticais e o quadro correspondente muda; a ordenação pela base de cada sprite resolve quem aparece à frente.

Ativos servidos localmente em `public/kingdom/`:

- `terrain-hires.png`: único chão carregado em execução; `terrain-hires-{nw,ne,sw,se}.png` são fontes editáveis. Pinturas anteriores são históricas.
- `structures/atlases/structures.png`: oito colunas e três linhas — fortaleza, torre e estalagem.
- `nature.png`: oito colunas e três linhas — pinheiro, carvalho e rocha.
- `structures/atlases/landmarks.png`: oito colunas e duas linhas — porto e totem.
- `structures/atlases/settlements.png`: oito colunas e três linhas — casa, comércio e capela.
- `structures/atlases/town-buildings.png`: sobrado, estábulo e prefeitura; oito orientações cada.
- `structures/atlases/harbor-buildings.png`: armazém portuário e veleiro; oito orientações cada. O cais pertence à pintura costeira.
- `structures/atlases/craft-buildings.png` e `frontier-buildings.png`: forja, celeiro, taverna, posto de patrulha, círculo de pedra e quartel.
- `structures/`: 19 subpastas por tipo, cada uma com oito PNGs nomeados pelo sentido (`sul.png`, `sudoeste.png`, ..., `sudeste.png`) e `catalogo.json`. `npm run sprites:extract` regenera os recortes.

Prompts, procedência e dimensões reais da arte são registrados em `KINGDOM-ART.md`. Não extrair ativos dos jogos citados como referência. Os PNGs anteriores do atlas ficam como histórico, sem substituírem o novo cenário.

## Renderização e navegação

- `src/KingdomMap.tsx`: componente regional, câmera, controles e locais acessíveis.
- `src/kingdom-scene.ts`: desenho em Canvas 2D, transformação afim do chão, recorte das pranchas e ordenação dos objetos.
- `src/kingdom-map.css`: composição, estados de interação e controles da região.
- `src/WorldAtlas.tsx`: transição Mundo/reino, seleção geográfica e painel compartilhado de missões.

Arraste percorre a região; scroll e pinch ajustam a aproximação. Q/E giram em passos de 45°, as setas deslocam a câmera e Home centraliza Vigília. Os controles visíveis oferecem as mesmas ações; zoom nominal entre 80% e 210%. A câmera limita o arraste e a névoa encobre a borda física. O posicionador de árvores e rochas consulta as cores do terreno e evita água, estradas, calçamento e pontes, além das áreas ocupadas por edifícios. Os seis marcos principais mantêm botões acessíveis por teclado; as construções do conjunto também podem ser clicadas com mouse/toque. Foco de teclado traz o local para a área visível sem publicar ou abrir automaticamente uma missão. Animações respeitam movimento reduzido.

O renderizador regional não importa Three.js nem usa modelos, luzes PBR ou névoa volumétrica. Seu funcionamento independe do WebGL do Mundo. O código 3D antigo (`AtlasScene`, `atlas-terrain`, `atlas-atmosphere`, `atlas-materials` e `atlas-scene.css`) é substituído; a documentação em `ATLAS-3D.md` descreve somente essa versão histórica. As texturas em `public/atlas-materials` permanecem porque o Mundo usa solo e rocha.

## Missões e persistência

Vigília, Passo da Geada, Estrada do Ferro, Porto das Brumas e Bosque dos Sussurros mantêm IDs e coordenadas em `world_locations`. A migration 010 acrescenta Floresta Negra no mesmo `world_regions/world_locations`, sem copiar missões. Construções e marcos clicáveis abrem o mesmo painel lateral de Ativas/Histórico/Todas; no celular ele aparece embaixo. O botão Missões do reino continua consultando todo o território.

Criar missão usa o mesmo `PostForm`, `/api/board` e registro em `board_posts` do mural. O servidor valida `location_id`, deriva a região e mantém autoria, data/hora e permissões. Nada é persistido no Canvas ou no armazenamento local. A migration 010 adicionou somente Floresta Negra; não há duplicação de missão ou mudança de regras.

## Verificação da entrega

Validado em **23/09/2026**:

- Build TypeScript/cliente/servidor e reconstrução do Docker concluídos; app, banco e SQL viewer saudáveis.
- `npm test`: dez testes aprovados com PostgreSQL real, incluindo autenticação, economia, autoria e ciclo de missão.
- `ATLAS_BROWSER_GPU=1 npm run test:atlas`: a primeira rodada validou desktop, oito direções, limites, zoom, as quatro artes locais e missão criada no mapa → mural → conclusão com 90 XP → histórico. Ela identificou sobreposição dos controles no celular.
- Após a correção do CSS, `npm run test:atlas -- --regional-mobile-only --regional-recovery-only` com GPU real passou: oito direções no celular, pinça/arraste/zoom, cinco locais acessíveis, painel e formulário, retorno ao Mundo, Canvas 2D com WebGL bloqueado e recuperação após imagem indisponível. Nenhum erro inesperado nessa rodada.
- Capturas `test-results/kingdom-direction-*-desktop.png`, `kingdom-direction-*-mobile.png` e de limites revisadas. A faixa inferior no celular reserva espaço separado para Missões do reino e controles. Cleanup conferido: nenhuma conta temporária do teste permaneceu no banco.
- Após a ampliação retangular, o smoke completo com GPU real voltou a passar em desktop/celular: cinco povoados, o mesmo registro SQL de missão no mapa e no mural, conclusão/XP, oito vistas, zoom/arraste, névoa sem repetição e recuperação sem WebGL. Um toque no filtro Todas de um painel rolável inicialmente não gerou clique de compatibilidade em Chromium; o filtro passou a responder ao `pointerup` de toque, operação idempotente, e a rodada final passou.
- Após a expansão navegável para 6000 × 4000, `npm run build`, rebuild do app Docker e `ATLAS_BROWSER_GPU=1 npm run test:atlas` passaram. O teste agora confirma também que somente Vigília aparece no enquadramento inicial. A navegação, cinco locais, oito orientações, missões e créditos de XP continuam funcionais em desktop/celular.

Os testes regionais anteriores em WebGL são históricos e não validam esta implementação. Nenhuma migration ou regra de recompensa foi alterada nesta revisão.
