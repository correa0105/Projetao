# Ampliação mágica do Empório — em andamento

O pedido atual autoriza completar os itens mágicos ausentes do 5etools, incluindo
suplementos e aventuras. Substitui a antiga limitação da loja ao SRD. Ainda não
está concluído: **915 itens novos estão aplicados**, de um levantamento que tem
968 identidades nomeadas ausentes e 2.108 modelos concretos adicionais candidatos.
Os candidatos precisam de curadoria, arte, fala, som e validação antes da venda.
Não interpretar os 3.076 candidatos como itens publicados ou cobertura já completa.

Primeiro lote: ferramenta multifuncional, amuleto do devoto, grimório arcano,
frasco de sangue, cinto de couro de dragão, foice lunar, tambor do ritmista,
bastão do guardião do pacto e faixas do poder desarmado, todos +1; capa
esvoaçante, amuleto mecânico e chapéu da magia. Cada peça tem ilustração original
gerada com `image_gen.imagegen`, alfa nativo, fala individual e foley próprio.
Imagens em `public/shop/magic-completion-20261009`; prompts, hashes e fontes
nativas em `data/shop-magic-completion-20261009/art-manifest.json`. As fontes PNG
foram copiadas para `.local/shop-completion/native`, além dos WebP portáveis.

## Levantamento e publicação

Os dados públicos do projeto 5etools foram obtidos de seu espelho primário
`5etools-mirror-3/5etools-src`, arquivos `items`, `items-base`, `magicvariants`,
`books` e `adventures`. `scripts/plan-shop-magic-completion.mjs --fetch` atualiza
o cache ignorado. O plano publica nomes, fatos mecânicos, fontes e cobertura;
nunca o texto integral dos livros ou suas ilustrações.

Reedições e nomes canônicos das regras existentes vinculam registros à mesma
identidade. As regras de cópia mecânica conservam mudanças de raridade e
propriedades dos itens evolutivos. `unknown` e `none` são mundanos na taxonomia
do 5etools; `unknown (magic)` continua no levantamento. UA e fontes posteriores
a 09/10/2026 não entram. Publicações de 2026 anteriores a essa data entram.

`scripts/expand-shop-magic-completion.mjs` aplica requisitos e exclusões a cada
modelo, agrupa as reedições dos modelos e desconta peças já vendidas. Confere
munições por seu formato, independentemente do nome antigo/novo. As três redes
+1/+2/+3 descritas por templates sobrepostos tornam-se um produto por bônus,
com a definição explícita de bônus só no ataque. Não publicar cópias da mesma
munição ou armadura por causa de aliases de edição.
O cinto e a poção combinados de gelo/pedra já cobrem os dois nomes de gigante,
sem exigir uma nova peça de pedra com o mesmo poder.

`editorial.json` reúne nomes, resumo curto da vitrine, explicação completa
original em português, fala, encaixes, material e peso estimado quando necessário.
`scripts/build-shop-magic-completion.mjs --verify` só prepara entradas com texto
e arte aprovados, hashes distintos, arquivo de som e metadados válidos. O arquivo
`catalog.json` guarda exclusivamente o subconjunto pronto e registra o restante
pendente. O seed exige `ready=true` e conserva a carga anterior e preços
administrativos. Nenhum candidato sem arte é ativado com uma imagem substituta.

Os novos detalhes apresentam o livro correto, o resumo original e o link direto
para o item no 5etools. Não os atribuir à licença CC do SRD. As explicações e
referências anteriores do SRD continuam no conjunto anterior. Equipamentos
novos têm alvo humano e slots explícitos; o catálogo público expõe só os
metadados necessários de equipamento. Poderes descritos não ampliam, por si
só, a automação das regras de combate do projeto.

## Verificação do primeiro lote

TypeScript e builds do cliente/servidor passaram na cópia limpa de release.
`test-shop-magic-completion-isolated.mjs` exige banco UUID descartável e verifica
arte/som, explicações, fontes, encaixes, compra, saldo, histórico, repetição sem
cobrança dupla e preço administrativo persistente. Todos os produtos anteriores
conservam suas linhas completas após repetir o seed. A regressão de equipamento
também passou, incluindo unidades, duas mãos, cofre e ownership.

`review-shop-magic-completion.mjs` confere as 12 artes na loja real, as 12 falas e
os detalhes com fontes, além da apresentação em 1500/760/390 px. As regras
completas ficam no botão de detalhes; o cartão mostra uma síntese curta.

Release local `alvorada-cinzenta-app:magic-completion-v1-20261009`, derivado da
instalação anterior. A auditoria encontrou linhas integralmente idênticas nas
60 tabelas não relacionadas e em todos os produtos anteriores; somente os 12
novos registros foram adicionados. Os 43 bundles, os 21 materiais VFX revisados
e as 24 novas mídias de itens coincidem com a cópia validada. Ilustrador PID
24260 mantido em execução, baús com prévia conservados e protótipo 330×4 pausado.

## Segundo lote: versões +2 e +3

Aplicadas as 18 versões superiores dos nove focos/equipamentos de classe.
Cada uma tem construção e ornamentos próprios, imagem transparente original,
fala escrita individualmente e som exclusivo. Não são recolorações das versões
+1. Prompts também em `art-jobs-higher-foci.json`; nativos preservados localmente.
Os detalhes mantêm os bônus corretos, sintonização e limites de recuperação.

A verificação em banco descartável passou para todos os 30 itens, incluindo
compra integral, saldo, histórico, repetição e preço administrativo persistente.
O saldo do personagem de teste acompanha o valor real do lote. Revisão da loja
em 1500/760/390 px e TypeScript/builds passaram na cópia limpa de release.
Todos os campos dos 12 itens do primeiro lote foram comparados e conservados.

Release `alvorada-cinzenta-app:magic-completion-v2-20261009`: 60 tabelas e todos
os produtos anteriores com linhas integrais idênticas ao snapshot imediatamente
anterior. Somente 18 novos produtos adicionados. Todas as 60 mídias de itens,
43 bundles e 21 materiais VFX conferidos no servidor. Ilustrador mantido.
Nesse checkpoint havia 3.073 candidatos pendentes, antes do refino de edições
e da preparação do terceiro lote abaixo.

## Terceiro lote: 62 formas ausentes nas famílias existentes

Aplicadas as versões mágicas de armadura de espinhos, cimitarra de duas lâminas,
lança curta com gancho, hoopak e yklwa, além da machadinha do berserker e da
rede da vigilância. São 62 ofertas reais novas, com IDs próprios e seleção
dentro dos baús das famílias existentes. Os cinco modelos físicos receberam
artes originais transparentes por `image_gen.imagegen`. Suas skins estendem
a biblioteca nativa de SVG com os materiais originais já aprovados; cada forma
e encantamento tem seu arquivo, e os três níveis distinguem cor e gravações.
Não se usaram ícones substitutos nem ilustrações dos livros. Prompts em
`art-jobs-new-models.json`; receitas em `variant-recipes.json` e proveniência
individual no manifesto de artes. Nesse checkpoint ainda faltavam treze referências;
elas foram concluídas no quarto lote abaixo.

Cada oferta tem fala individual, som próprio, modelo e equipamento explícitos,
resumo curto e explicação original das regras. As famílias anteriores permanecem
agrupadas; bônus e resistências entram nos seletores. As regras suplementares
dos modelos ficam nos detalhes. Adicionar esses equipamentos à loja não cria
automação de seus ataques especiais nem dos poderes mágicos. A prévia inclinada
foi reposicionada para manter a peça inteira dentro da área do baú, incluindo
as duas pontas da cimitarra; os 31 baús anteriores também foram revistos.

A compatibilidade de edições segue a matriz de geração do projeto 5etools.
Foram retiradas 27 combinações incompatíveis entre modelos clássicos e templates
atuais. A rede da vigilância continua válida pela regra de 2014, e sua descrição
conserva a diferença em relação às armas da vigilância de 2024. Templates antigos
com requisitos explícitos de modelos PHB e sem etiqueta de edição preservam
somente seus formatos antigos válidos, como as redes com bônus só no ataque
e a Pele de Bronze Fundido. Essa exceção fica marcada no candidato.

Compra, saldo, repetição, preços administrativos, fontes, imagens, sons e slots
passaram para os 92 itens em banco UUID descartável; a cimitarra de duas mãos
bloqueia a mão secundária. Loja real revisada em 1500/760/390 px, com seleção
por ID e todas as 92 falas/explicações. TypeScript e builds passaram na cópia
limpa, e todos os campos dos 30 itens anteriores foram conservados.

Release local `alvorada-cinzenta-app:magic-completion-v3-20261009`, saudável.
Auditoria das 60 tabelas não relacionadas e de todos os produtos anteriores
confirmou linhas integrais idênticas ao snapshot imediatamente anterior;
somente 62 registros novos. As 184 mídias, 43 bundles e 21 materiais VFX foram
conferidos no servidor. Ilustrador PID 24260 mantido em execução.
Ainda há **2.984 candidatos pendentes**; completar TODOS continua em andamento.

## Quarto lote: 99 armas, focos e munições

Aplicadas mais 99 ofertas: versões mágicas de oito armas de fogo/energia e da
besta leve de repetição, seis encantamentos em cajados arcanos e druídicos e
munições +1/+2/+3 de dois formatos. As treze referências restantes têm artes
originais transparentes. Uma superfície original gravada foi criada para as
munições; as skins estendem a biblioteca nativa e conservam a silhueta de cada
modelo. As 99 falas foram escritas individualmente e os sons são exclusivos.
As 18 referências físicas desse plano agora estão concluídas.

Os detalhes distinguem foco arcano e druídico, uso versátil, munição compatível,
limites de recarga e rajada. Encantamentos seguem a edição correspondente,
sem automatizar poderes ou ataques especiais novos. Valores físicos de armas
de fogo seguem a raridade de valor indicada no XDMG; o preço do encanto conserva
o critério já usado pela loja. Cada oferta nova de munição vende uma unidade,
com um décimo do preço mágico do pacote de dez existente e seu peso unitário.
O encantamento da munição termina no primeiro acerto. A célula não recebe um
limite de disparos genérico: esse limite pertence ao modelo da arma.

A compra dos 191 itens foi verificada em carrinhos de até 100 linhas, com saldo,
histórico e repetição sem cobrança dupla. O rifle de duas mãos bloqueia a mão
secundária; pistola e foco de uma mão podem ocupá-las juntas. As seis munições
novas foram consumidas pela rota real do VTT em banco descartável: uma unidade
por uso, repetição idempotente e tentativa posterior sem estoque rejeitada,
conservando o histórico de compra. Fontes, 191 falas/explicações e imagens foram
revistos na loja em 1500/760/390 px. TypeScript e builds passaram. Todos os
campos dos 92 itens já publicados permaneceram exatamente iguais.

Release saudável `alvorada-cinzenta-app:magic-completion-v4-20261009`. Somente
99 registros foram adicionados; as 60 tabelas e todos os produtos anteriores
mantêm linhas integrais idênticas. Conferidos 382 arquivos de mídia dos itens,
43 bundles e 21 materiais VFX no servidor. Ilustrador mantido em execução e
17 arquivos de trabalho independente conservados. Restam **2.885 candidatos
pendentes**. A célula de extermínio ainda exige curadoria de tipos de criatura;
famílias com magias ou alvos específicos também precisam de expansão das opções.

## Quinto lote: quatro famílias novas, 206 formas reais

Aplicadas as armas deslumbrantes (53 modelos), caçadoras de mortos-vivos (51),
de morte certa (51) e infernais (51). São quatro baús novos com seleção do modelo
real. Cada família recebeu uma superfície original gerada individualmente:
opala/raios dourados, caveiras em prata, metal escuro com veios violetas e ferro
infernal com fissuras luminosas. As skins conservam o modelo físico; os arquivos
são distintos e todas as 206 ofertas têm falas escritas individualmente e sons
próprios. Prompts em `art-jobs-new-families.json` e no manifesto de proveniência.

As explicações conservam sintonia, luz, reação/cargas do clarão, dano e expulsão
contra mortos-vivos, intervalo sem recuperação de PV e o destino infernal da
alma. Não se inventou dano extra de fogo ou morte automática. Propriedades dos
modelos incluem versatilidade, recarga, carregamento, rajada e formas de ataque
do hoopak; uma rajada por resistência é distinguida de uma jogada de ataque.
A lança de cavalaria descreve a exceção de uma mão quando montado; o equipamento
estático conserva o uso de duas mãos sem automatizar essa condição. O peso das
quatro fundas é uma estimativa explícita de 0,1 lb, pois a fonte não lista peso.

Auditoria real passou para as 397 ofertas: fontes, mídia, slots, compra, saldo,
histórico, repetição, preços administrativos e consumo de munições. A leitura
do catálogo respeita as janelas do limite de requisições; a política do servidor
não foi alterada. Revisão de todas as imagens, falas e explicações na loja e
prévia inclinada dos quatro baús em 1500/760/390 px passou. TypeScript e builds
passaram na cópia limpa. Todos os campos dos 191 produtos anteriores permanecem
exatamente iguais, assim como suas entradas de áudio; 206 sons novos têm hashes
exclusivos.

Release saudável `alvorada-cinzenta-app:magic-completion-v5-20261009`. Somente
206 produtos foram adicionados; 60 tabelas e todo produto anterior conservaram
suas linhas integrais. Conferidos 817 arquivos: 794 mídias das ofertas e 23
referências/materiais de apoio. Os 43 bundles e 21 VFX coincidem com a cópia
validada. Ilustrador PID 24260 mantido. Restam **2.679 candidatos pendentes**,
além das opções de magia/alvo que ainda precisam de expansão. O pedido completo
continua em andamento.

Próximo trabalho: continuar a curadoria e as artes dos itens nomeados e famílias,
ampliar a verificação de cobertura e adicionar apenas lotes completamente prontos.

## Sexto lote: utensílios mágicos de 2024

Aplicados doze itens comuns do Dungeon Master’s Guide de 2024: Botas de rastros
falsos, Capa de muitas modas, Roupas de conserto, Orbe de direção, Orbe do tempo,
Cachimbo de monstros de fumaça, Caneca da sobriedade, Corneta auditiva, Vela das
profundezas, Grimório duradouro, Elmo do pavor e Boneca falante. Cada um tem
ilustração original completa com alpha nativo, fala própria e som de manuseio
individual. A roupa foi revisada para retirar a névoa de fundo. Os dois orbes
têm construções visuais distintas; revisão em fundos escuro e claro a 200/100 px.

As explicações distinguem as regras de 2024: pegadas de humanoide do mesmo
tamanho, ações de Magia dos orbes, períodos do dia apenas no Plano Material,
seis frases de até seis palavras e gatilhos a até 5 pés para a boneca. Efeitos
visuais do elmo não aplicam medo. Pesos não informados na fonte são estimativas
explícitas; os orbes mantêm as 3 lb informadas. A vela permanece consumível
por unidade, por 50 PO segundo a política existente, sem duração infinita.

Banco UUID descartável: compra em carrinhos, preço administrativo, saldo,
histórico, repetição, botas/capa/roupa/elmo/orbes e consumo único da vela passaram.
Os 397 produtos anteriores mantêm todos os campos do arquivo de catálogo.
Loja real com 409 imagens/falas/fontes em 1500/760/390 px, TypeScript e builds
passaram. Nenhum poder descrito implica nova automação de combate.

Release local `magic-completion-v6-20261010`, com o anterior preservado. A imagem
foi reconstruída sobre o runtime anterior à ampliação mágica, fornecendo todas
as 409 mídias de som em uma camada; total de 39 camadas. Servidor e 43 bundles
correspondem à cópia validada. 841 mídias/referências e 21 VFX idênticos; 60
tabelas e todos os produtos anteriores com linhas completas iguais. Só 12
registros novos. Ilustrador mantido, WIP independente e 330×4 pausado preservados.
Restam 2.667 candidatos, além das opções de magia/alvo ainda a expandir.

## Sétimo lote: cinco famílias de armadura

Aplicadas 65 formas em treze modelos físicos: armaduras reluzentes, de retirada
rápida, do marinheiro, fumegantes e da leveza. Cada família recebe um material
original via `image_gen.imagegen`: prata/dourado limpo, couro vinho com fechos
de bronze, esmalte oceânico com peixes e conchas, metal escuro com motivos de
fumaça e prata com penas de madrepérola lilás. Cada modelo conserva sua forma
física em SVG nativo, com acabamento, fala e foley únicos. As 409 ofertas
anteriores mantêm todos os campos dos arquivos e as artes anteriores ficam
intactas. Prompts completos e procedência em `art-jobs-armor-materials.json` e
`art-manifest.json` dentro de `data/shop-magic-completion-20261009`; nativos PNG
conservados em `.local/shop-completion/native/material-*-armor.png`. Texturas e
65 skins portáveis em `public/shop/magic-completion-20261009`.

As formas modernas usam o Dungeon Master’s Guide de 2024. Espinhos conserva
fontes compatíveis de 2014 (XGE/DMG): retirada por ação e marinheiro subindo
60 pés ao iniciar turno submerso a zero PV. A versão moderna do marinheiro
recupera 1d4 PV e não pode curar ninguém novamente antes do amanhecer. Leveza
usa The Book of Many Things: sintonia, cinco cargas, ação bônus, Salto por uma
carga ou Levitação por duas sobre o próprio usuário; recupera 1d4 + 1 ao
amanhecer. O rótulo diferencia a edição do encanto da base de armadura de 2024.
Não muda peso para zero. CA, limites de Destreza, Força e Furtividade de cada
base aparecem no resumo; nenhum novo poder implica automação de combate.

O catálogo de conjuntos foi ampliado de 266 para 346: inclui as 15 formas de
espinhos já publicadas e as 65 novas. Comprar dá seis peças reais para humano,
com peso total preservado. Migration 091 captura só armaduras de espinhos
anteriormente inteiras na mochila/cofre; o seed entrega cinco partes restantes
uma vez, preservando unidades de peitoral, preço, saldo, histórico e seleção
equipada. Não havia unidades desse tipo possuídas no momento da aplicação.
O teste exercitou estoque antigo com duas/três unidades e uma peça extra,
preço administrativo e aplicação repetida em banco UUID descartável.

Foi corrigida a whitelist de referências do ilustrador para aceitar SVGs da
pasta nova; recursos externos e conteúdo executável continuam recusados.
A geração de seis partes equipadas passou com a skin do conjunto; montarias
continuam com armadura inteira e pets conservam a separação por alvo.

QA: 346 conjuntos, compras concorrentes/replay, peso, equipamento atômico e
backfill passaram. API de 474 itens em banco descartável, preços administrativos,
compra em carrinhos de até cem, consumo e ledger passaram respeitando o limite
de 240 pedidos/minuto; o próprio QA se limita a 200. Loja real em 1500/760/390 px
e prévias dos cinco baús com peça inteira e ID selecionado corretos. As cinco
folhas de 13 skins foram revistas, sem recortes ou duplicações. TypeScript e
builds cliente/servidor passaram.

Release local `magic-completion-v7-20261010`, 52 camadas, anterior preservado.
58 tabelas com linhas completas idênticas; só 65 ofertas e 400 peças novas.
Quinze produtos de espinhos ganharam divisão de peso e metadata de conjunto,
com os demais campos idênticos. Inventários/cofres exatamente conforme captura;
migration e snapshots idempotentes conferidos. 976 mídias/referências, servidor,
43 bundles e 21 VFX antigos iguais à cópia validada; Lava/Corrente elétrica da
revisão posterior mantidas. Ilustrador ativo, WIP e 330×4 pausado preservados.
Restam 2.602 candidatos, além das opções de magia/alvo por expandir.

## Oitavo lote: prata e adamantina

Aplicadas 87 ofertas: 53 armas de prata e 28 armas/6 munições adamantinas.
Materiais originais de prata clara escovada com ornamentos alquímicos e grafite
angular com reflexos verdes discretos, produzidos por `image_gen.imagegen`.
Cinco novas referências transparentes mostram uma única flecha, virote, agulha,
bala de funda e cartucho de arma de fogo. A célula de energia usa a referência
física já validada. Cada skin SVG nativa possui forma, hash, fala e foley próprios;
nenhuma arte nem campo das 474 ofertas anteriores foi alterado. Prompts em
`art-jobs-metal-materials.json`/`art-jobs-metal-models.json`, procedência no
`art-manifest.json`, nativos preservados em `.local/shop-completion/native`
e arquivos portáveis em `public/shop/magic-completion-20261009`.

Fonte mecânica: Dungeon Master’s Guide (2024), páginas 304 e 227, consultado
pelos dados do 5etools. A prata acrescenta um dado de dano quando o usuário
consegue crítico contra criatura que esteja transformada. A adamantina trata
acertos contra objetos como críticos; não garante acertar e não concede esse
crítico contra criaturas. Nenhum dos dois exige sintonia ou concede bônus +1.
As seis munições são vendidas por unidade, com peso físico da base de 2024,
preço segundo a política existente e consumo idempotente pelo VTT.

Os 87 modelos foram revistos em sete folhas. O acabamento adamantino teve a
sobreposição reduzida de 66% para 46% para clarear lâminas no baú; os originais
raster permanecem intactos. Loja real em 1500/760/390 px passou com todas as
561 imagens/falas/fontes e prévias dos modelos selecionados ao lado do baú.
API em banco descartável passou compra, replay, preço administrativo, ledger,
saldo, equipamento e uso das seis munições novas; limite real da API mantido.
TypeScript e builds cliente/servidor passaram.

Release `magic-completion-v8-20261010` aplicado com backup da versão anterior.
60 tabelas e todas as ofertas anteriores mantêm linhas integrais idênticas;
exatamente 87 novas ofertas. As 1.157 mídias/referências publicadas, o servidor,
43 bundles, 21 VFX anteriores e Lava/Corrente elétrica mais recentes conferem
com os arquivos validados. Ilustrador ativo e alterações independentes intactas.
Restam 2.515 candidatos, além das opções de magia/alvo por expandir.

## Nono lote: armas de ruidium

Aplicados 51 modelos de arma com cristal vermelho de ruidium em metal de
cor ferrugem. Um material original foi produzido por `image_gen.imagegen`;
cada forma usa SVG nativo com referência física própria, fala e foley únicos.
Prompts em `art-jobs-ruidium-material.json`, procedência em `art-manifest.json`,
fonte PNG em `.local/shop-completion/native/material-ruidium-weapon.png` e
52 novos arquivos portáveis em `public/shop/magic-completion-20261009`.
As quatro folhas de 51 formas e três novas prévias sobre o baú foram revistas
com as peças completas. As 561 ofertas anteriores e suas artes ficam intactas.

Critical Role: Call of the Netherdeep, página 216, consultado pelos dados
primários do 5etools: sintonia, +2 para ataque/dano, mais 2d6 psíquicos ao
acertar uma criatura. Enquanto a arma está em seu poder, respirar água e
natação igual à caminhada. Um 1 natural em ataque com a arma exige Carisma
CD 20; falhar concede um nível de exaustão e inicia corrupção de ruidium,
caso ainda não haja corrupção. Quando o Apotheon é morto ou redimido, o
ruidium de Exandria desaparece e resta uma arma +2. A regra de 2014 está
rotulada separadamente dos modelos físicos de 2024. Regras narradas continuam
exigindo aplicação na mesa; o resumo não afirma automação de combate.

QA de todos os 612 itens em banco descartável: imagens/sons únicos, compra,
ledger, saldo, replay, preços administrativos, conservação de catálogo antigo,
equipamento e consumo existentes. Os 51 endpoints de regras novas passaram e
todos os modelos de ruidium foram equipados; 80 conjuntos de seis peças foram
reconferidos. O QA pode receber uma lista explícita de fontes novas para evitar
repetir requisições de regras já conferidas, preservando compra e auditoria de
todos os itens e o limite real da API. As 51 artes/falas/fontes novas passaram
na loja completa de 612 itens em 1500/760/390 px, sem overflow; TypeScript passou.
Os bundles e servidor validados no lote anterior permanecem idênticos.

Release `magic-completion-v9-20261010` saudável, backup anterior conservado.
60 tabelas e toda oferta anterior integralmente idênticas; só 51 adições.
1.260 mídias/referências e 43 bundles iguais à cópia validada; Lava/Corrente
elétrica e 21 VFX anteriores preservados, ilustrador ativo e WIP intacto.
Restam 2.464 candidatos, além das opções de magia/alvo por expandir.

## Décimo lote: comando, retorno e disparo repetido

Publicados 35 modelos do Comando do Trono, sete de retorno e nove de disparo repetido. Três materiais originais produzidos por `image_gen.imagegen`: joias azul/vinho e ouro, prata/cobre com motivos de volta, e engrenagens de cobre em metal/teal. Cada uma das 51 skins possui forma física, fala e foley próprios, com alpha preservado. Prompts em `art-jobs-command-replicated-materials.json`, procedência em `art-manifest.json`, fontes PNG em `.local/shop-completion/native` e 54 novos arquivos portáveis em `public/shop/magic-completion-20261009`. Quatro folhas de modelos e cinco novas prévias sobre baús foram revistas. As 612 ofertas e artes anteriores permanecem iguais.

The Book of Many Things, página 39, conserva a edição de 2014 do encanto separada da base física moderna. Comando do Trono requer sintonia, concede +1 ataque/dano e proficiência em Intimidação/Persuasão a quem não as possui, sem especialização. Cinco cargas: ação bônus para Comando (1), Zona da Verdade (2), Compulsão ou Banimento (4) e Dominar Pessoa (5), CD 16. Recupera 1d4 cargas gastas ao amanhecer até o máximo de cinco; demais regras de magia/concentração mantidas.

Eberron: Forge of the Artificer (2025), página 112, foi conferido pelos dados primários do 5etools. Arma de retorno +1 volta à mão imediatamente após a jogada de ataque à distância, acerte ou erre, sem sintonia. Disparo repetido requer sintonia, concede +1 apenas para ataques à distância, ignora Carregamento e, quando sem munição, cria uma peça mágica para a jogada que desaparece ao acertar ou errar. Não concede ações adicionais nem estoque para vender. O resumo de repetição omite a limitação de disparo de Carregamento que a magia ignora. Os poderes narrados precisam ser aplicados na mesa.

API de todos os 663 itens passou imagens/sons, compra, saldo, ledger, replay, preços administrativos, conservação do catálogo e consumo. Os 80 conjuntos anteriores foram reconferidos, os 51 endpoints de regras novas passaram e todos os modelos novos puderam ser equipados. Os testes em três larguras revisaram 51 artes/falas/fontes novas na loja completa de 663 itens, com ID/skin selecionada corretos sobre os baús. TypeScript passou; runtime, servidor e bundles anteriores validados permanecem iguais.

Release `magic-completion-v10-20261010` saudável, backup anterior mantido. 60 tabelas e toda oferta anterior integralmente idênticas, somente 51 adições. 1.365 mídias/referências e 43 bundles conferidos; Lava/Corrente elétrica e 21 VFX anteriores preservados, ilustrador ativo e trabalho independente intacto. Restam 2.413 candidatos, além das opções de magia/alvo por expandir.

## Décimo primeiro lote: paralisia agonizante

Publicados 32 modelos de arma da paralisia agonizante. Um material original produzido por `image_gen.imagegen` combina aço negro, prata gravada e pequenos motivos de esmalte vermelho. Cada SVG nativo conserva sua forma física e tem fala e foley próprios. Prompts em `art-jobs-agonizing-material.json`, procedência em `art-manifest.json`, PNG em `.local/shop-completion/native/material-agonizing-paralysis.png` e 33 novos arquivos portáveis em `public/shop/magic-completion-20261009`. Três folhas de modelos e três prévias novas sobre o baú foram revistas; as 663 ofertas e artes anteriores ficam iguais.

Chains of Asmodeus, página 271, foi conferido nos dados primários do 5etools. Requer sintonia e concede +3 ao ataque/dano. Ao reduzir uma criatura a zero PV, ela não morre: runas infernais aparecem, ela é curada para um PV e fica paralisada até Restauração Menor ou magia semelhante remover a condição. As runas somem quando a condição é removida. No início de cada turno enquanto afetada, a criatura ganha um nível de exaustão e sofre a dor descrita; não foi inventado dano periódico rolado nem cargas. A edição de 2014 do encanto está separada da base física moderna. Condições e poderes continuam para aplicação pela mesa.

API em banco descartável passou os 695 itens para imagens/sons únicos, compras, replay, saldo, ledger, preços administrativos, catálogo anterior e consumo. Os 80 conjuntos de seis peças continuam corretos. As 32 fontes novas e o equipamento de todos os modelos novos passaram, incluindo bloqueio de segunda mão para armas de duas mãos. Loja completa em 1500/760/390 px: 32 novas imagens, falas, regras e referências, baús com ID/skin corretos e sem recorte. TypeScript passou; servidor e 43 bundles anteriores validados ficam idênticos.

Release `magic-completion-v11-20261010` saudável, com backup anterior preservado. 60 tabelas e todas as ofertas anteriores têm linhas integrais iguais; somente 32 adições. 1.430 mídias/referências publicadas conferem com os arquivos validados. Lava/Corrente elétrica e 21 VFX anteriores preservados, ilustrador ativo, alterações independentes intactas. Restam 2.381 candidatos, além das opções de magia/alvo por expandir.

## Décimo segundo lote: doze utensílios individuais

Publicados perfume do encantamento, cachimbo das lembranças, haste de pesca, haste recolhível, vaso do despertar, corda de remendo, rubi do mago de guerra, escudo de expressão, caneca da fartura e varinhas de regência, pirotecnia e cenhos franzidos. Cada item tem uma arte original individual por `image_gen.imagegen`, alpha nativo, fala própria e foley distinto. Prompts em `art-jobs-utility2-items.json`, procedência em `art-manifest.json`, PNGs em `.local/shop-completion/native` e WebP portáveis em `public/shop/magic-completion-20261009`. Painel de 190px sobre o fundo real confirma formas completas e transparência limpa; o sombreado de RGB visto fora dos objetos na prévia do gerador tem alpha zero. Nenhuma das 695 ofertas/artes anteriores mudou.

Regras do Dungeon Master’s Guide de 2024 foram conferidas no 5etools para nove objetos, com fontes clássicas de Ghosts of Saltmarsh, Hoard of the Dragon Queen e Xanathar’s Guide to Everything para cachimbo, caneca e varinha de cenhos. Perfume: uma aplicação, ação de Magia, uma hora de vantagem em Enganação/Persuasão para influenciar criatura a até cinco pés. Vaso: dez libras, trinta dias de cultivo de arbusto comum, Arbusto Desperto amistoso obediente e destruição do vaso. Rubi: sintonia por conjurador, fixação por dez minutos, arma como foco e remoção pelos gatilhos corretos. Cachimbo encena façanhas após dez minutos durante cinco, com uso até amanhecer; caneca enche três pints com Illefarn até três vezes por dia.

As varinhas têm cargas, alcance, ação, recuperação e efeito ao gastar a última carga completos. Regência: três cargas, música até 120 pés enquanto regida e destruição num 1 da última carga. Pirotecnia: sete cargas, clarão inofensivo a 120 pés durante um segundo, estalo a 300, recuperação 1d6 + 1 e destruição num 1. Cenhos: três cargas, ação, humanoide visível a 30 pés, Carisma CD 10, um minuto e transformação em Varinha de Sorrisos num 1 da última carga.

O construtor distingue peso físico explicitamente revisado de estimativa: hastes de sete libras, conforme Pole (XPHB), e vaso de dez libras, conforme descrição primária. Hastes incluem comprimento/uso e redução limitada pelo espaço; corda conserva os limites de reparo e perda permanente. Escudo de expressão é um escudo de seis libras e CA +2 normal, com mudança de expressão por ação bônus, classificado separadamente de armadura corporal. Comprar entrega só o escudo, equipável na mão secundária. Perfume/vaso são consumíveis de uso único segundo a política de metade do preço, sem criação automática de criatura ou mascote.

API de 707 itens em banco descartável passou arte/sons, compras, replay, saldo, ledger, preço administrativo, 80 conjuntos e consumo. Os dois consumíveis novos foram usados uma vez, com repetição idempotente e recusa de segundo gasto; escudo único, mãos corretas, pedra sem slot e pesos reais versus estimados foram conferidos. As 12 fontes, imagens/falas novas e loja completa em 1500/760/390 px passaram. TypeScript e builds cliente/servidor passaram, com a nova lista de consumíveis compilada.

Release `magic-completion-v12-20261010` saudável, com backup anterior. 60 tabelas e toda oferta anterior integralmente idênticas, somente 12 adições. 1.454 mídias/referências e 43 bundles conferidos; Lava/Corrente elétrica e 21 VFX anteriores preservados, ilustrador ativo e alterações independentes intactas. Restam 2.369 candidatos, além das opções de magia/alvo por expandir.

## Lote 13 — armaduras planares, vivas e de ruidium

74 novos modelos: 13 de antimagia, 13 forjados no Feérico, 13 forjados no Pendor das Sombras, 13 do último combate, 13 vivos e 9 de ruidium. Fontes primárias conferidas no espelho de dados do 5etools: BMT p. 65/67, EGW p. 267, ERLW p. 278 e CRCotN p. 215. Os encantamentos de 2014 são identificados separadamente dos modelos físicos de 2024.

Cinco materiais originais gerados e aprovados, com prompts e cópias nativas registrados em `art-jobs-planar-living-armor-materials.json` e `art-manifest.json`. O material original de ruidium já aprovado equipa nove formas de armadura, cada uma com arte final distinta. As 74 falas são individuais, com sons próprios; os seis estilos e todas as silhuetas foram vistos em tamanho reduzido e nas prévias reais dos baús.

Antimagia tem reação e conjuração com reservas diárias separadas; Feérico/Pendor usam três cargas e CD 15. Último combate só dispara na morte, destrói a peça e pode banir aliados dos tipos indicados. Armadura viva conserva a ligação, as três resistências e o custo de metade dos Dados de Vida restantes após descanso longo. Ruidium usa resultado 1 em resistência e Carisma CD 15, distinguindo-se da arma. Nenhuma dessas regras recebe bônus ou recursos além da fonte.

Os 74 conjuntos novos somam 370 componentes internos, totalizando 420 conjuntos cadastrados. Todas as 346 definições anteriores permanecem idênticas; os 707 produtos anteriores também. A API pública mantém separadas as ações de equipar uma peça e equipar o conjunto inteiro.

Validação: API dos 781 itens e das 74 descrições novas; compra/replay/ledger/saldo; peso e equipamento de seis peças; três testes de conjuntos/placas/referências de arte; loja responsiva em 1.500/760/390 px; TypeScript e builds limpos. Publicado na imagem `magic-completion-v13-20261010`, saudável. Após aplicação, 60 tabelas e todos os produtos antigos mantêm hashes de linhas idênticos; somente 74 pais e 370 componentes foram inseridos. Todas as 1.607 mídias e 43 bundles correspondem aos arquivos aprovados. Lava/Corrente elétrica, os demais efeitos e o ilustrador permanecem preservados.

Total aplicado: 781 novos itens; 2.295 candidatos seguem pendentes, além da expansão das opções específicas de magia/alvo.

## Lote 14 — caídos, mizzium e recuperação arcana

31 novos modelos: 10 Armaduras dos Caídos (BMT p. 65), 9 Armaduras de Mizzium (GGR p. 179) e 12 Armaduras de Recuperação Arcana (Spell-Fueling Armor, AUD p. 119). Fontes primárias lidas no espelho de dados do 5etools; AUD/Arcana Unleashed: Deadfall, publicado em 2026-09-15, permanece dentro do corte de 2026-10-09. BMT/GGR mantêm seu encantamento de 2014 separado do modelo físico de 2024; AUD usa as regras de 2024.

Três materiais originais, 31 artes finais distintas e 31 falas/sons individuais. Prompts, cópias nativas e hashes registrados em `art-jobs-fallen-mizzium-fueling-materials.json` e `art-manifest.json`. Todas as formas foram vistas em tamanho reduzido, e as três famílias foram vistas nos baús reais em desktop e celular.

Caídos: uma única reserva até o amanhecer para Falar com os Mortos ou Animar Mortos; sintonia e destruição do conjunto se o usuário sintonizado morrer. Mizzium: críticos recebidos se tornam acertos normais; só anula dano no sucesso de uma resistência de Força/Constituição de efeito mágico que normalmente reduziria o dano à metade. Dispensa sintonia. Recuperação arcana: exige um conjurador, permite tratar 1 como 2 em dados de dano de magia, e recupera espaços gastos somando até três círculos após descanso curto, uma vez até o próximo amanhecer. Não há bônus de CA em nenhuma das três famílias.

31 pais e 155 componentes internos novos: 451 conjuntos totais, com peso conservado. Todos os 781 produtos e 420 conjuntos anteriores permanecem idênticos. API completa dos 812 itens, descrições das 31 novidades, compra/replay/ledger/saldo e equipamento dos seis componentes aprovados; três testes de armaduras/placas/referências, loja em 1.500/760/390 px, TypeScript e builds limpos.

Publicado em `magic-completion-v14-20261010`. Aplicação saudável; hashes de 60 tabelas e de todos os produtos anteriores iguais após aplicação, somente 186 novas linhas de produtos inseridas. Todas as 1.672 mídias e 43 bundles ao vivo correspondem aos arquivos aprovados. Ilustrador, Lava/Corrente elétrica e demais efeitos preservados. Total: 812 itens novos aplicados; 2.264 candidatos e opções específicas de magia/alvo ainda pendentes.

## Lote 15 — vestes tramontanas

Oito modelos de Armadura Tramontana, AU p. 124, com as regras de 2024 e sintonia obrigatória. Cada modelo recebeu uma arte original de veste completa, gerada separadamente com corte, cores e bordado próprios; nenhuma placa fica exposta na aparência, conforme a fonte. Os prompts, cópias nativas, hashes e revisão estão em `art-jobs-tramontane-robes.json` e `art-manifest.json`. Todas as imagens têm alpha real, com silhuetas vazias e sem pessoas ou manequins; foram vistas sobre fundo escuro e nos baús em desktop/celular.

CA +1 e passagem sem custo adicional somente pelos terrenos difíceis listados na fonte. Ação de Magia ativa os filamentos por um minuto, ou até outra ação de Magia desativá-los. Enquanto ativos, uma ação bônus afeta criaturas escolhidas na emanação de 20 pés; resistência de Força CD 15, condição agarrado/escape CD 15 e puxão de até 20 pés em linha reta. Uma ativação até o próximo amanhecer. Propriedades, peso e defesa do modelo físico permanecem explícitos.

Oito novas falas e sons individuais; oito conjuntos e 40 componentes internos adicionais, totalizando 459 conjuntos. Todos os 812 produtos e 451 conjuntos anteriores mantêm seus campos. API completa dos 820 itens e das oito descrições, compra/replay/ledger/saldo, peso/equipamento dos seis componentes, três testes de armaduras/placas/referências, loja em 1.500/760/390 px, TypeScript e builds aprovados.

Publicado em `magic-completion-v15-20261010`, saudável. Após aplicação, hashes de 60 tabelas e de todos os produtos anteriores iguais; somente 48 novas linhas de produtos. As 1.688 mídias e 43 bundles ao vivo correspondem aos arquivos aprovados. Ilustrador e efeitos preservados. Total: 820 itens novos aplicados; 2.256 candidatos e opções específicas de magia/alvo ainda pendentes.

## Lote 16 — dez utensílios comuns (10/10/2026)

Artes raster originais independentes, alfa nativo e silhuetas próprias para cada objeto. A bolha mantém translucidez visível no fundo noturno. Prompts, caminhos nativos, hashes e revisão em art-jobs-common-utility3-items.json e art-manifest.json; falas brasileiras próprias e dez sons distintos.

XDMG: Bead of Refreshment (p. 235), Charlatan’s Die (243), Dark Shard Amulet (248), Ersatz Eye (259), Hat of Vermin (267), Heward’s Handy Spice Pouch (269) e Horn of Silent Alarm (270). EGW: Breathing Bubble e Coin of Delving (266). ERLW: Cleansing Stone (276). Fontes mecânicas consultadas no conjunto primário do 5etools; descrições próprias em português.

A conta é uso único, preço de consumível e consumo idempotente; não purifica líquidos mágicos ou venenos. Bolha com uma hora de ar, recuperação ao amanhecer. Dado controla apenas seu próprio d6 e requer sintonia. Pedra de 30,5 cm exige toque e ação, peso de 85 lb explicitamente estimado. Moeda informa a queda somente ao cair mais de 1,5 m. Amuleto requer bruxo e o teste de truque só volta após descanso longo, mesmo em falha. Olho usa regra 2024 sem sintonia e ocupa a órbita, sem atribuição artificial ao espaço de capacete. Chapéu, bolsa e chifre mantêm cargas e exigência de segurar/acionar. Chifre físico de 2 lb e 3 PO preserva peso oficial e preço físico; alcance do alarme de 180 m e apenas um ouvinte escolhido.

TypeScript e builds limpos. API em banco UUID descartável validou todos os 830 itens, preços administrativos, carrinhos, ouro, auditoria, repetição de compra, consumo da conta e encaixes dos novos objetos. Interface real dos dez itens e loja inteira em 1500/760/390 px, sem erros. Após publicação, 60 tabelas e todos os produtos anteriores integralmente idênticos, somente dez linhas novas; 1.708 arquivos de mídia e 43 bundles correspondem aos revisados. Docker saudável, VFX e ilustrador preservados. Completar todos continua em andamento: 2.246 candidatos, além de opções específicas ainda por expandir.

## Lote 17 — cinquenta armas, oito acabamentos (10/10/2026)

Oito materiais originais gerados, com prompts prévios em art-jobs-blade-weapon-materials.json. Cinquenta skins SVG nativas com imagens incorporadas e formas físicas próprias, cinquenta falas individuais em português e cinquenta sons distintos. Revisão visual de todas as formas a 198 px e dos oito baús no celular: arma inteira, com a skin escolhida, apoiada na caixa. O material quebra-força foi suavizado para conservar o volume do modelo físico.

Fontes primárias do 5etools: Forcebreaker Weapon — BMT p. 67, onze formas; Sword of Vengeance — seis formas XDMG p. 314 e cimitarra dupla DMG p. 206; Acheron Blade — EGW p. 265, seis; Crystal Blade — FTD p. 22, seis; Moon-Touched Sword — XDMG p. 280, seis; Sylvan Talon — XDMG p. 314, seis; Executioner’s Axe — XDMG p. 259, quatro; Life-Sapping Blade — AUD p. 118, quatro. Edição mecânica clássica preservada separadamente do modelo físico 2024 quando aplicável.

Quebra-força +2 rompe estruturas de força mágica conforme seu tamanho. Vingança +1 requer sintonia, expõe a maldição e distingue o gatilho clássico de dano em combate do gatilho 2024 de outra criatura. Acheron +1 tem duas reservas independentes ao anoitecer, PV temporários e desvantagem na próxima resistência, com imunidade a medo como exceção; proteção contra expulsar mortos-vivos enquanto carregada. Cristal não recebeu +1 inventado: acrescenta 1d8 radiante, tem três cargas de cura, recupera 1d3 ao amanhecer e três modos de luz por ação bônus. Luar só ilumina desembainhado na escuridão. Garra silvestre entende comunicação não escrita das fadas e conjura Mensagem uma vez ao amanhecer. Carrasco +1 causa 2d6 cortante adicional a humanoides e concede PV temporários iguais ao dano adicional causado, sem sintonia. Sorve-vida +1 causa 2d4 necrótico, impede recuperar PV até o fim do próximo turno do alvo e mata imediatamente quem o ataque reduzir a 0 PV, com retorno restrito às magias indicadas.

TypeScript e builds aprovados no checkout limpo. API em banco descartável validou todos os 880 itens, compras, ouro, auditoria, repetição, preços administrativos e equipamentos; fontes e uso de uma/duas mãos das cinquenta novas armas conferidos. Interface real dos cinquenta itens e loja inteira em 1500/760/390 px, sem erros. 459 conjuntos de armaduras permanecem idênticos. Publicação auditada: 60 tabelas e todos os produtos anteriores integralmente preservados, somente cinquenta novos produtos; 1.816 mídias e 43 bundles ao vivo correspondem aos arquivos revisados. Docker saudável, VFX e ilustrador preservados. Completar todos continua em andamento: 2.196 candidatos e opções específicas ainda por expandir.

## Lote 18 — trinta e cinco munições por unidade (10/10/2026)

Artes e prompts próprios em art-jobs-special-ammunition.json: cinco materiais originais, trinta skins SVG nativas com imagens incorporadas e cinco ilustrações completas transparentes de sanguessuga ressecada. Cada projétil possui imagem e fala distintos; os modelos clássicos e 2024 de cartucho usam referências separadas. As cinco sanguessugas foram geradas sobre referências físicas previamente vistas, preservando os originais. Revisão de todas as 35 formas a 198 px sobre o fundo noturno. Trinta e cinco sons únicos.

Fontes primárias: Walloping Ammunition — XDMG p. 318, seis formas, e XGE p. 139, cartucho moderno clássico; Bloodseeker Ammunition — BMT p. 66, seis; Dispelling Ammunition — AU p. 118, seis; Goading Ammunition — AU p. 119, seis; Winged Ammunition — BMT p. 69, cinco; Dried Leech — BMT p. 67, cinco.

Impacto exige acerto e resistência de Força CD 10 para evitar cair. Caça-feridos concede vantagem à distância contra qualquer criatura abaixo dos PV máximos, sem exigir sangue. Dissipação exige causar dano e encerra todas as magias de até terceiro círculo sobre o alvo, inclusive benéficas; perde a magia ao causar dano. Provocação exige acertar e causar dano para a resistência de Carisma CD 13, bloqueia reações até o início do próximo turno do alvo e perde a magia ao acertar, mesmo se o bloqueio não se aplicar. Alada ignora meia cobertura e três quartos, além da desvantagem pelo alcance longo; conserva cobertura total e alcance máximo. Sanguessuga se prende no acerto, causa 1d4 perfurante no início dos turnos, se solta após seus próprios dez pontos de dano acumulados ou morte do alvo, pode ser retirada por uma ação de qualquer criatura e morre/perde magia ao se soltar. Sem dano imediato adicional ou cura inventados.

Preço e peso por unidade, seguindo a política existente de munição mágica consumível, preço físico e arredondamento em cobre. Cartucho moderno clássico: 0,1 lb; cartucho físico 2024: 0,2 lb. Nenhuma munição alada ou sanguessuga usa célula de energia. Nenhuma requer sintonia ou recebe bônus numérico inventado.

TypeScript e builds aprovados. Banco UUID descartável: todos os 915 itens, carrinhos, ouro, auditoria, preços administrativos e repetição; trinta e cinco consumos com replay idempotente, estoque zerado e novo pedido rejeitado com 409, sem alterar o registro de compra. Interface real dos 35 itens e loja inteira em 1500/760/390 px, sem erros. 459 conjuntos de armadura permanecem idênticos. Após publicação, 60 tabelas e todos os produtos anteriores integralmente preservados, apenas 35 novas linhas; 1.891 mídias e 43 bundles correspondem aos revisados. Docker saudável, VFX e ilustrador preservados. Completar todos continua em andamento: 2.161 candidatos e opções específicas ainda por expandir.
