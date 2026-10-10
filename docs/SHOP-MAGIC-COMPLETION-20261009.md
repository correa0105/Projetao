# Ampliação mágica do Empório — em andamento

O pedido atual autoriza completar os itens mágicos ausentes do 5etools, incluindo
suplementos e aventuras. Substitui a antiga limitação da loja ao SRD. Ainda não
está concluído: **397 itens novos estão aplicados**, de um levantamento que tem
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
