# Consulta mecânica de magias — 23/10/2026

Das 411 magias disponíveis na criação e evolução, 72 tinham somente um resumo
narrativo. Elas receberam descrições em português revisadas com base nos registros
da mesma fonte/edição já presentes na memória local do projeto. Foram preservados
dano, cura, tipo de salvaguarda, acerto/erro, condições, área, repetição por turno,
concentração, término antecipado, espaços superiores e evolução de truques.
As invocações conservam as referências aos blocos de estatísticas indicados pela fonte.

As 72 descrições estão salvas em `data/spell-reference-2024.json`, sem depender de
tradução em tempo de consulta. `data/spell-mechanics-audit-20261023.json` registra
a fonte, página e os valores numéricos/dados de cada uma para regressão. Os dados
foram comparados com a fonte, inclusive a diferença entre dano inicial e recorrente
de Raio de Bruxa e os incrementos de círculos superiores. As outras 339 descrições
continuam com o fluxo anterior; seis já revisadas e as demais com tradução local.
O glossário deste fluxo recebeu termos mecânicos, e respostas com números/dados
perdidos, inventados ou duplicados são corrigidas pela tradução protegida ou rejeitadas.

As magias que não vieram do SRD usam `srd: false`; a tela conserva a fonte/página
e não atribui incorretamente essas descrições à licença do SRD. Escolhas, custos,
personagens, espaços e automação de combate permanecem iguais.

Validação: TypeScript, builds, quatro testes de catálogo/integridade/tradução e
consulta real do componente em 1440/390 px. Raio de Bruxa, Escudo Cacofônico e
Tempestade de Fogo Mágico foram conferidos visualmente, inclusive texto longo,
salvaguardas, dados, progressão, fonte, rolagem do diálogo e fechamento por Escape.

Publicado em alvoradacinzenta.com como `spell-mechanics-20261023`, código
`0bc1b671a0dbc42828a59643fe320b0d24d06575`. Os 72 retornos autenticados da API
foram comparados com as descrições revisadas. HTTPS e cliente atualizado, cache
privado dos retratos e ilustrador online foram conferidos após a publicação.
Backup: `/opt/alvorada/backups/spell-mechanics-before-20261023T164152Z.dump`.
