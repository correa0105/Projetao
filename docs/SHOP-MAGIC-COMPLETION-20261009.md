# Ampliação mágica do Empório — em andamento

O pedido atual autoriza completar os itens mágicos ausentes do 5etools, incluindo
suplementos e aventuras. Substitui a antiga limitação da loja ao SRD. Ainda não
está concluído: **12 itens novos estão aplicados**, de um levantamento que tem
968 identidades nomeadas ausentes e 2.135 modelos concretos adicionais candidatos.
Os candidatos precisam de curadoria, arte, fala, som e validação antes da venda.
Não interpretar os 3.103 candidatos como itens publicados ou cobertura já completa.

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

Próximo trabalho: continuar a curadoria e as artes dos itens nomeados e famílias,
ampliar a verificação de cobertura e adicionar apenas lotes completamente prontos.
