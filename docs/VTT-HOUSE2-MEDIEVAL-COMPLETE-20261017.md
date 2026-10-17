# Biblioteca medieval, pincéis e relógio do mundo — 17/10/2026

A reconstrução em vista superior foi completada: 255 artes no conjunto anterior, incluindo 25 casas mobiliadas, 25 interiores vazios, 40 comércios e seus 65 telhados, além de 100 móveis. A expansão acrescenta 50 móveis de interior, 50 de exterior, 50 urbanos e 20 texturas. São 425 imagens distintas, todas exportadas no projeto, com miniaturas e registros individuais de geração.

O VTT e a House 2.0 compartilham 250 peças de mobília. As novas categorias são **Mobílias externas** e **Cidade medieval**; os 50 móveis adicionais de interior entram em **Mobílias**. A House oferece filtro por categoria e mantém os créditos de teste, compras, coleção e edição exclusiva do proprietário. As cenas antigas conservam seus IDs, dimensões, posições, giros, escalas e ownership: a substituição visual usa aliases em `shared/vtt-asset-visuals.json`.

Os 20 pincéis são dez gramas (cinco verdes e cinco variações palha, outono, geada, urze e avermelhada), cinco terras e cinco pedras. Somados aos anteriores, o VTT tem 38 materiais. Na House 2.0, **Pintar terreno** permite selecionar material e largura, pintar, desfazer ou limpar traços; **Salvar** confirma e **Descartar** restaura o estado anterior. A pintura fica recortada ao próprio terreno e é validada no servidor, incluindo revisão concorrente, ownership e limites de pontos. Clientes anteriores que enviam decoração sem o novo campo conservam a pintura existente.

## Relógio e iluminação

A House 2.0 usa o relógio compartilhado do mundo, que avança um minuto por minuto real. **Vizinhança → Relógio do mundo** mostra a hora; somente administrador pode usar **Ajustar hora**. O servidor verifica a permissão atual, protege ajustes concorrentes e registra autor, hora anterior e nova hora. Contas comuns e prévia básica não podem editar. A sincronização ocorre ao entrar, ao voltar para a aba e a cada 30 segundos; a exibição avança localmente entre sincronizações.

Manhã vai de 06:00 a 11:59; tarde de 12:00 a 16:59; entardecer de 17:00 a 18:59; noite de 19:00 a 05:59. Sombras, direção solar e tonalidade acompanham essa hora. A antiga escolha de luz por navegador foi substituída pelo relógio comum. A configuração inicial parte da hora de São Paulo no momento da migration.

## Arte e rastreabilidade

Foi usado o **imagegen integrado**, com as referências aprovadas, materiais pintados à mão e câmera superior. Sprites têm alpha transparente; texturas ocupam o quadrado inteiro. Móveis e objetos que retornaram com câmera frontal foram refeitos com guias geométricos. As guias e versões anteriores registradas permanecem nos dados de revisão.

- Prompts e manifests anteriores: `data/vtt/nadir-refit-20261016/prompts.json` e `completed/`.
- Prompts e manifests da expansão: `data/vtt/medieval-expansion-20261017/prompts.json` e `completed/`.
- Artes: `public/vtt/nadir-20261016/` e `public/vtt/medieval-expansion-20261017/`.
- Miniaturas: os diretórios equivalentes `nadir-thumbs-20261016` e `medieval-expansion-thumbs-20261017`.

Cada registro individual contém prompt efetivamente usado, referências, origem, dimensões, SHA-256, miniatura e data de geração. Os originais do ilustrador permanecem na pasta de imagens geradas do Codex; o projeto consome os WebPs exportados.

## Validação e persistência

TypeScript, cliente Vite e servidor tsup foram compilados em cópia isolada baseada no HEAD, acrescentando somente os arquivos deste trabalho. A auditoria verifica as 425 imagens distintas, hashes, resolução, alpha, bordas e miniaturas. Os 65 telhados cobrem integralmente seus interiores; as 25 casas da House foram renderizadas abertas e fechadas nas quatro rotações, com móveis preservados.

Testes de banco descartável verificam relógio, concorrência, revogação administrativa, prévia básica, ownership da pintura, persistência, clientes anteriores, compras e ouro real preservado. A House passou em 1920, 1440, 768, 390 e 320 px, incluindo relógio, fases de luz, pintura, salvar/descartar e visitas. A biblioteca real do VTT carregou as 250 imagens e confirmou seleção/colocação nas três coleções em desktop e celular. O renderer real conferiu móveis, telhados e portas em oito variantes residenciais/comerciais.

Migrations aditivas: `101_world_clock.sql` cria estado e histórico do relógio; `102_house2_ground.sql` acrescenta a pintura aos terrenos. Nenhum saldo, compra ou posição anterior é recalculado. Protocolo do VTT: 23, com recarga orientada para abas antigas ao introduzir os novos materiais.

Comandos principais: `node scripts/verify-medieval-assets.mjs`; `node --import tsx --test tests/medieval-expansion.test.ts`; `node scripts/test-house2-isolated.mjs`; `node scripts/test-house2-isolated.mjs --browser`. O teste `tests/world-clock.test.ts` exige banco UUID descartável, como os demais testes de API.

## Publicação concluída

Imagem local `medieval-complete-v1-20261017`, saudável. Conferidos 884 arquivos novos por hash e HTTP, incluindo todas as artes e miniaturas. Preservados 14.055 arquivos anteriores; index e servidor foram atualizados. As 133 tabelas anteriores de dados mantiveram hashes e quantidades; somente `schema_migrations` mudou, acrescentando 101 e 102. O novo relógio tem uma linha inicial e histórico vazio. Backup completo de 511.991.413 bytes validado por decodificação do dump, em `.local/backups/before-medieval-full-20261017-1792245355807.dump`. Resultados locais em `.local/medieval-deployment-result.json`.
