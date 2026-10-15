# Classes e subclasses — 15/10/2026

A ficha agora oferece 13 classes e 76 subclasses das versões atuais dos livros abaixo, com progressão de níveis 1–20. O seletor mantém os IDs das fichas anteriores e mostra a origem de cada opção. A consulta de evolução fica disponível aos jogadores, incluindo os níveis ainda não alcançados.

| Livro | Subclasses |
| --- | ---: |
| Player's Handbook 2024 (XPHB) | 48 |
| Forgotten Realms: Heroes of Faerûn (FRHoF) | 8 |
| Eberron: Forge of the Artificer (EFA) | 5 |
| Ravenloft: The Horrors Within (RHW) | 7 |
| Arcana Unleashed (AU) | 8 |

Inclui Artífice e seis especializações no conjunto. O corte do catálogo é 15/10/2026; não representa todos os livros do 5etools, UA ou todas as versões legadas de 2014.

## O que a ficha calcula e registra

- PV médios por classe, Constituição retroativa, proficiência, perícias/especializações, salvaguardas adicionais, CA sem armadura e ataques por ação.
- Conjuração das classes e das subclasses Cavaleiro Místico, Trapaceiro Arcano e Artes Místicas, com Inteligência/Sabedoria próprias. Espaços de terceiros de conjuração usam a tabela própria quando isolados e arredondamento para baixo na soma de multiclasse. Pacto permanece separado.
- 444 magias com IDs antigos preservados, listas atualizadas, magias fixas de subclasses, escolas dos magos e escolhas adicionais por nível.
- Manobras, disparos arcanos, perícias, ferramentas, divindade/domínio e outras escolhas iniciais das novas subclasses. Trocas opcionais de truque/magia/plano na evolução são validadas no servidor.
- Artífice: origem, ferramentas, magias, planos elegíveis por nível, limite de replicação e plano adicional de armadura. Planos não creditam produtos ou ouro: itens replicados são temporários e sua criação/uso é resolvida na sessão.

Ativações, criaturas/companheiros de classe, condições, formas temporárias, resistências e efeitos em outros alvos continuam descritos para resolução na mesa. A atualização não transforma essas descrições em automação de combate. A evolução mantém a melhoria de atributos existente; não acrescenta um catálogo geral de talentos aos níveis de melhoria. Trocas durante descansos das escolhas adicionais específicas de subclasses não são um novo editor nesta entrega.

## Integridade

O servidor calcula a evolução a partir da ficha salva e confere todas as escolhas, listas, círculos, quantidades e pré-requisitos disponíveis. As rotas mantêm ownership, concessão administrativa de nível e replay idempotente. Não há migration, seed, alteração de ouro, exclusão ou conversão de personagens existentes. Novas opções não são aplicadas silenciosamente a fichas já evoluídas.

## Fontes e reprodução

O importador em scripts/import-character-rules-2024.mjs fixa a revisão 90d343cde64cf8dce1083ea0525a6b0b9e545f2e do conjunto de dados do 5etools. data/character-rules-20261015/sources.json registra URLs e SHA-256 dos arquivos. O snapshot compartilhado contém nomes, níveis, listas e tabelas mecânicas, sem importar prosa ou imagens dos livros. Os resumos e rótulos em português são próprios; não representam uma tradução oficial. O snapshot SRD anterior e sua atribuição são preservados.

Reprodução: node --import tsx scripts/import-character-rules-2024.mjs. O material bruto fica exclusivamente em .local/subclass-sources e não deve ser versionado. Planos reaproveitam traduções do catálogo local e acrescentam rótulos em mapping.json.

## Validação

- 98 testes em PostgreSQL UUID descartável: todas as 76 subclasses até o nível 20, origem do Artífice em todas as espécies/antecedentes, valores independentes de salvaguardas/especialização, mistura de conjuradores, trocas e escolhas adulteradas, mais regressões de ownership/replay/concorrência e economia.
- TypeScript, build do cliente e build do servidor.
- Navegador real em cinco larguras: evolução e persistência de magias, seis subclasses de guerreiro, manobras do Mestre de Batalha, planos/armadura do Artífice e consulta dos vinte níveis.

Comandos: node scripts/test-character-advancement-isolated.mjs; node scripts/test-character-advancement-isolated.mjs --browser --expansion. Ambos exigem o PostgreSQL local configurado e criam/removem apenas o banco de teste UUID.
