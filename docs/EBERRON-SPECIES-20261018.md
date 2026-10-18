# Espécies de Eberron — 18/10/2026

Retomada do chat interrompido: o catálogo de classes já continha Artífice, mas o seletor compartilhado `races` não continha as espécies de Eberron. Acrescentadas Changeling, Kalashtar, Khoravar, Shifter e Warforged de **Eberron: Forge of the Artificer (2025)**. As versões anteriores de Rising from the Last War não geram opções duplicadas.

Criação, validação no servidor, ficha, regras e referências de estatura usam o mesmo catálogo. A ficha identifica a fonte dos novos traços. Tamanho Pequeno disponível onde permitido; Kalashtar permanece Médio. As quatro linhagens de Shifter são escolhas permanentes, com benefícios condicionais descritos na ficha, sem aplicar CA, velocidade ou PV temporários permanentemente.

Escolhas implementadas: duas perícias de Changeling; perícia de Kalashtar substituível no descanso; truque/atributo e perícia ou ferramenta de Khoravar (truque e treinamento substituíveis no descanso); perícia de Shifter; perícia/ferramenta de Warforged. Proteção integrada concede +1 CA com e sem armadura, inclusive na derivação de evolução. Nenhum bônus racial antigo de atributos foi introduzido. Transformação, telepatia, resistências, vantagens condicionais e contagem dos usos seguem resolução pela mesa; esta alteração não anuncia automação desses efeitos no VTT.

Testes: `node scripts/test-character-advancement-isolated.mjs` executa a regressão de ficha/evolução e os testes das cinco espécies em PostgreSQL descartável. `--browser --eberron` verifica o seletor e a fonte em 1440 e 390 px e cria cada espécie pela rota de arte real, usando renderizador exclusivo de testes, conferindo a ficha persistida. TypeScript e builds de cliente/servidor também verificados.

Publicação incremental deriva da imagem vigente, acrescenta novos bundles e substitui apenas o HTML e o servidor. Sem migration nem seed novo em produção. Backup verificado e hashes dos arquivos e tabelas existentes registrados em `.local/eberron-species-*`.

Fontes: [apresentação oficial das cinco espécies](https://www.dndbeyond.com/posts/2017-how-eberron-forge-of-the-artificer-reimagines), [catálogo oficial](https://www.dndbeyond.com/species), dados mecânicos no snapshot de raças `90d343cde64cf8dce1083ea0525a6b0b9e545f2e` utilizado pelo importador existente (EFA, páginas 34–38). Textos locais são resumos próprios em português; nenhuma arte dos livros foi copiada.

Escopo pendente do histórico anterior: ampliação integral de Tasha, Xanathar e dos demais conteúdos de Eberron (talentos, subclasses e magias) deve ser auditada separadamente. A presença das cinco espécies não significa que todos esses livros já estejam implementados.
