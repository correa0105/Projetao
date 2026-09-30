# Alvorada Cinzenta

## Patentes e níveis

Cada missão é exclusiva de uma patente, selecionada na criação. Não é possível se
inscrever acima ou abaixo da sua patente. Ouro automático por participante: Ferro
150 PO, Bronze 230 PO, Adamantium 300 PO, Ametista 390 PO e Obsidiana 500 PO.

Personagens evoluem por missões concluídas: Ferro, Bronze, Adamantium, Ametista e
Obsidiana. Nos totais 22, 53, 80 e 102, precisam concluir um teste de patente para
ultrapassar respectivamente os níveis 4, 8, 12 e 16. Enquanto aguardam, missões normais
concedem somente ouro. A categoria do teste pode ser escolhida ao registrar uma missão.
Tabela completa e regras em [Patentes](docs/PATENTES.md). Recursos de classe de níveis
altos continuam pendentes, conforme [Roadmap de regras](docs/ROADMAP-REGRAS.md).

## Fundo publicado do Reino do Norte

A visão pública agora usa a imagem fornecida pelo usuário em `public/kingdom/north-sonnenberg.png` (1154 × 866), com proporção original, zoom e arraste. Sonnenberg é o único ponto para abrir o registro de missões do reino, incluindo publicação e histórico; o botão acompanha a projeção do mapa. Nenhum local SQL foi renomeado ou removido. O editor continua privado: ao abri-lo, carrega seu próprio fundo, rascunho e câmera; ao fechá-lo, volta ao mapa publicado. As descrições de área vazia abaixo se aplicam somente ao rascunho privado sem upload.

Portal de RPG de mesa: jogadores, múltiplos personagens, aventuras e uma loja com inventário
persistido em PostgreSQL. Protótipo funcional em português, inspirado em D&D 5.5e (2024 / SRD 5.2.1).

Identidade da guilda: nome escrito em Libre Baskerville na apresentação, azul de noite, pergaminho e cobre envelhecido.
O Bastião da Alvorada é a sede em Vigília. [Direção visual, arte e prompt](docs/IDENTIDADE.md).

O Reino do Norte está em fase de composição. Sua visão regional abre como uma área vazia, sem fundo ou elementos predefinidos. O editor permite enviar um background próprio (inclusive 8K), manter a proporção da imagem, navegar, girar em oito direções e posicionar objetos ilustrados em oito perspectivas. Há zoom amplo, controle deslizante e opção de salvar o enquadramento atual como 100%. **Remover fundo (área vazia)** volta ao espaço vazio, preservando os itens do rascunho. Neste momento, somente `correa.l@icloud.com` tem acesso ao editor; os dados salvos ainda são privados e não publicados aos demais jogadores. Os seis locais e suas missões continuam no SQL; o Mundo 3D permanece independente. Consulte [a documentação da visão do reino](docs/KINGDOM-2D.md).

O botão **Editar mapa**, visível apenas à conta autorizada, permite posicionar objetos ilustrados, arrastá-los diretamente, mover a seleção com setas, duplicar, ajustar tamanho e orientação e salvar um rascunho particular no PostgreSQL.

## Executar em outra máquina

Requisitos: Docker com Compose e Node.js 24 para gerar a configuração e desenvolver.

```sh
node scripts/setup.mjs
docker compose up -d --build
```

Abra **http://localhost:3000** e escolha **Iniciar aventura → Criar uma conta**. Não existe senha de demonstração
nem usuário administrador padrão. Crie um personagem; o ouro inicial vem das escolhas de classe e antecedente e é creditado ao concluir a ficha.
O setup preserva `.env` se ele já existir. Na primeira execução gera segredos aleatórios.

- Aplicação: `http://localhost:3000`
- Containers: `alvorada-cinzenta-app`, `alvorada-cinzenta-db` e `alvorada-cinzenta-sql` (painel opcional).
- PostgreSQL para ferramentas locais: `localhost:5436`, banco `alvorada_cinzenta`, usuário `alvorada_cinzenta`, senha no `.env`.
- Diagnóstico: `docker compose ps` e `docker compose logs --tail=80 app`.
- Saúde: `http://localhost:3000/api/health` consulta efetivamente o banco.
- Parar: `docker compose stop`. Voltar: `docker compose up -d`.

As portas ficam vinculadas a `127.0.0.1`: este ambiente inicial é local. O banco persiste
no volume `alvorada-cinzenta_postgres_data`. Reiniciar containers não apaga os jogadores.
**Não use `docker compose down -v` para reiniciar**, pois essa opção exclui o banco.

## Visualizar o PostgreSQL no navegador

```sh
docker compose up -d pgweb
```

Abra **http://localhost:8081**. O painel Pgweb conecta automaticamente ao banco `alvorada_cinzenta`
usando a configuração privada do Compose, sem precisar digitar a senha. Clique em uma
tabela na lateral para consultar seus registros e estrutura; `board_posts` contém o mural,
`characters` os personagens e `inventory` os inventários.
O cofre compartilhado da conta fica em `account_vault`; `inventory_transfers` registra
as movimentações entre ele e as mochilas individuais. Na aba Inventário, arraste um
item entre os painéis ou use Guardar no cofre / Levar para a mochila e escolha a quantidade.
`npm run test:inventory` valida esse fluxo em um PostgreSQL local descartável.

O serviço é opcional (profile `tools`), acessível somente na máquina local e configurado
em modo de consulta (`--readonly`). Para parar: `docker compose stop pgweb`.
Referência: [Pgweb](https://github.com/sosedoff/pgweb).

## O que já funciona

- Apresentação com mapa e efeito fosco, login centralizado e navegação flutuante inferior agrupada.
- Cadastro, login e logout com Better Auth; sessões no PostgreSQL e cookie HttpOnly.
- Até dois personagens por usuário, nove espécies SRD e doze classes; seleção em acampamento ilustrado e arte de corpo inteiro.
- Ilustrador local via assinatura ChatGPT do Codex, sem API key: referência obrigatória para novos personagens, duas imagens por personagem por mês. [Operação e regras](docs/CHARACTER-ART.md).
- Ficha de nível 1 com escolhas SRD na criação, atributos por 4d6 no servidor,
  distribuição definitiva, bônus de antecedente, perícias, salvaguardas, equipamentos,
  magias e recursos de sessão. [Fluxo e limites](docs/CHARACTER-SHEET.md).
- Loja ilustrada com os 65 itens da exportação fornecida pelo usuário: dez categorias, falas do mercador, mesa interativa e carrinho transacional ligado à mochila. Orbe do dragão sem preço disponível apenas para exame.
- Compras transacionais: preço no servidor, desconto de ouro, empilhamento no inventário,
  histórico de compras e chave de idempotência.
- Inventário individual, soma de peso e conquistas por personagem.
- Mural: missões com data/hora e inscrições; próximas mesas aparecem no Início nas 24 horas anteriores, com aviso para o criador mestrar.
- Conclusão pelo criador com resumo, progresso por missões, ouro por inscrito e gancho opcional. Recompensas e promoções são registradas uma única vez.
- Ganchos são somente para consulta e nascem da conclusão de missões. Eventos são exclusivos da staff/admin.
- Mundo com relevo cartográfico em Three.js, detalhe de solo/rocha, arraste elástico, zoom e nuvens em movimento, preenchendo a tela. A visão inicial usa 100%, equivalente ao antigo enquadramento de 142%; a silhueta fornecida pelo usuário define a geografia. Vinte e dois territórios têm demarcações com destaque ao passar o mouse e clique na superfície; mar contínuo ampliado, ilhotas, vulcão e tormenta complementam o cenário.
- Reino do Norte abre uma área regional vazia e navegável em Canvas 2D. A conta autorizada pode enviar um fundo e compor sprites em oito direções. Não há névoa ou terreno predefinido. O Mundo em 3D permanece independente. Detalhes em [KINGDOM-2D.md](docs/KINGDOM-2D.md).
- Lore, Regras e House têm conteúdo inicial persistido no SQL.
- Interface adaptável para desktop e celular, com tema exclusivamente escuro e menu retrátil com ícones medievais ilustrados.

## Limites deste protótipo

Mundo usa uma malha de terreno com alturas, materiais procedurais com detalhe de fotografias CC0 de solo/rocha e câmera ortográfica inclinada. A arte anterior fornece a máscara da costa e a distribuição dos biomas; não é exibida como um quadro ou aplicada como pintura sobre a malha. A escala do relevo é representativa. Implementação em [ATLAS-WORLD-RELIEF.md](docs/ATLAS-WORLD-RELIEF.md); origem da referência em [ATLAS-WORLD-V2.md](docs/ATLAS-WORLD-V2.md). O Mundo exige WebGL; a visão regional usa Canvas 2D. Oito orientações significam oito desenhos do mesmo objeto. Somente Reino do Norte possui exploração interna nesta etapa. Missões antigas com locais livres permanecem no mural; somente as vinculadas a um local do atlas aparecem naquele ponto do mapa.

House é uma página narrativa; propriedades ainda não estão implementadas.
A ficha implementa a criação no nível 1 do SRD 5.2.1. Não há combate automático,
evolução completa dos recursos de classe, equipar/vender/consumir itens ou aplicação de efeitos. Equipamentos iniciais
ficam registrados na ficha, separados das compras do inventário. Novos personagens recebem a riqueza oficial de classe e antecedente. Conversões preservam o saldo existente.

Missões concluídas creditam o ouro anunciado e a progressão por patentes no servidor.
XP antigo permanece no histórico. Há uma única guilda; campanhas privadas,
moderação e painel de administração serão adicionados depois. Recuperação de senha,
verificação de e-mail e OAuth dependem de configuração de provedores e ainda não estão habilitados.

## Conversão para as regras de 2024

A migration 025 arquiva as fichas anteriores em `character_sheet_legacy_snapshots`, preserva dados rolados, notas e bens e solicita revisão da origem. Ao abrir Ficha, escolha o antecedente, seus bônus e demais opções atuais; não há nova rolagem se ela já existia. Meio-elfo e meio-orc exigem escolher explicitamente uma espécie atual. Arte, compras, XP e conquistas permanecem.

Detalhes e limites: [Revisão SRD 5.2.1](docs/SRD-2024.md).

## Desenvolvimento

Para habilitar eventos, cadastre a conta e atribua a permissão pelo terminal do projeto:

```sh
npm run staff -- email@exemplo.com admin
```

Também aceita `staff` ou `remove`. O comando usa o PostgreSQL configurado no `.env` e exige as migrations aplicadas. Nenhuma conta é promovida automaticamente; permissões não podem ser escolhidas no cadastro. Atualize a página após alterar a permissão.

Para gerar imagens dos personagens, mantenha `npm run art:worker` ativo no host
com o Codex conectado via `codex login`. O worker usa a assinatura do operador e
precisa do computador ligado; Docker sozinho não executa o ilustrador.

Horários são armazenados em UTC (`timestamptz`) e apresentados no fuso local do navegador.
Missões antigas sem horário são preservadas; novos registros exigem data e hora futuras.
O gancho de demonstração anterior foi preservado em bancos existentes, mas não é mais criado em instalações novas.

```sh
node scripts/setup.mjs
npm ci
docker compose stop app
docker compose up -d db
npm run dev
```

Abra `http://localhost:5173` (Vite). O proxy `/api` encaminha para o Node em `localhost:3000`.
O script de setup configura ambas as origens. Se copiar `.env.example` manualmente, adicione
`http://localhost:5173` a `APP_ORIGIN`, separado por vírgula, e gere `BETTER_AUTH_SECRET`.

```sh
npm run build        # TypeScript + frontend + backend
npm test             # Testes reais de API e transações com PostgreSQL
npm run test:browser # Fluxos de UI, com a versão Docker rodando na porta 3000
npm run test:editor  # Builder autorizado, upload, zoom e restauração vazia
npm run test:atlas   # Mundo, visão do reino, missões compartilhadas e celular
npm run db:migrate   # Aplica migrations pendentes
npm run db:seed      # Atualiza catálogo e cria conteúdo inicial ausente
npm run test:shop    # Loja e checkout em PostgreSQL descartável + navegador
```

O teste de navegador usa Microsoft Edge instalado. Para Chrome, configure `BROWSER_CHANNEL=chrome`.
Para o Chromium do Playwright, execute `npx playwright install chromium` e configure
`BROWSER_CHANNEL=chromium`. No PowerShell: `$env:BROWSER_CHANNEL='chromium'`.
Capturas ficam em `test-results/`, fora do Git. Testes criam usuários exclusivos e removem
somente os próprios registros ao terminar. Use sempre um banco local ou de teste.

Depois de editar, volte à versão Docker com `docker compose up -d --build`.

## Arquitetura

Monólito modular: React/Vite no frontend, Express 5 no backend, TypeScript em ambos.
O container da aplicação serve a interface e a API na mesma origem. PostgreSQL 17 usa
pool de conexões, chaves estrangeiras, índices, constraints e migrations SQL versionadas.
Não há necessidade de Redis ou microserviços nesta etapa.

```text
src/                  interface React, componentes e estilos
src/WorldAtlas.tsx     navegação geográfica e lista de missões compartilhada
src/WorldMap.tsx       câmera mundial, arraste/zoom e seleção de territórios
src/world-relief.ts    geometria do Mundo, biomas, rios e oceano
src/world-clouds.ts    nuvens procedurais em movimento acima do mapa
src/world-map.css      Mundo em tela inteira e controles sobrepostos
src/KingdomMap.tsx     visão do reino, câmera ortográfica, controles e editor
src/kingdom-scene.ts   sprites de oito orientações em Canvas 2D
src/kingdom-map.css    composição e controles da visão do reino
public/kingdom/       pranchas de sprites em oito direções
src/alvorada.css         identidade Alvorada Cinzenta, sobre os estilos estruturais
public/               mapa de entrada, favicon tipográfico e paisagem da fortaleza
shared/               regras iniciais compartilhadas
server/auth.ts        configuração Better Auth
server/app.ts         rotas, autenticação e validação
server/services.ts    transação de compra e idempotência
server/atlas.ts       regiões/locais SQL e validação do local da publicação
server/db.ts          pool e helper de transação
db/migrations/        schema SQL versionado
data/catalog.json     snapshot anterior preservado
data/shop-export/     catálogo ativo fornecido pelo usuário, pesos e falas
scripts/              setup, catálogo, comandos SQL e teste de navegador
tests/                integração com PostgreSQL real
docs/CONTEXTO.md       memória de produto e desenvolvimento
docs/ARQUITETURA.md    decisões, modelo e contratos da API
docs/IDENTIDADE.md     identidade visual, ativos e prompt da arte
docs/ATLAS-WORLD-RELIEF.md implementação vigente do Mundo navegável
docs/ATLAS-WORLD-V2.md histórico da arte e origem da referência geográfica
docs/KINGDOM-2D.md     direção e arquitetura da visão regional 2D
```

## Backup e transporte dos dados

O código e `.env` não contêm o banco. Para levar jogadores a outra máquina, faça backup
do volume ou use `pg_dump` e `pg_restore`. Estes comandos evitam redirecionamento binário
do PowerShell:

```sh
docker compose exec db pg_dump -U alvorada_cinzenta -d alvorada_cinzenta -Fc -f /tmp/alvorada-cinzenta.dump
docker compose cp db:/tmp/alvorada-cinzenta.dump ./alvorada-cinzenta.dump
```

O dump contém dados privados; guarde-o fora do Git. Na máquina de destino, configure o
projeto, suba somente `db`, copie o dump e restaure **em um banco vazio** antes de subir `app`:

```sh
docker compose up -d db
docker compose cp ./alvorada-cinzenta.dump db:/tmp/alvorada-cinzenta.dump
docker compose exec db pg_restore -U alvorada_cinzenta -d alvorada_cinzenta --no-owner --no-privileges /tmp/alvorada-cinzenta.dump
docker compose up -d --build app
```

## Referências

- [Better Auth + Express](https://better-auth.com/docs/integrations/express)
- [5etools — itens](https://5e.tools/items.html); snapshot exato e commit em `data/catalog.json`.
- [SRD oficial](https://www.dndbeyond.com/srd) e [atribuição local](docs/ATTRIBUTION.md).
- [Contexto do projeto](docs/CONTEXTO.md), a primeira leitura para continuar o desenvolvimento.

## Mural de avisos

Missões, eventos e ganchos ativos aparecem como papéis clicáveis no mural da vila. Ao publicar, escolha entre seis modelos de papel e informe um resumo opcional. Apenas o autor pode arrastar seu aviso dentro da madeira ou mover com as setas do teclado; a posição fica salva no PostgreSQL. As placas laterais abrem listas com busca, filtros e paginação, incluindo o histórico e a opção de localizar um papel encoberto. Eventos continuam restritos à staff; ganchos nascem da conclusão de missões. `npm run test:notice-board` valida o fluxo em um banco descartável.

### Estábulo
Em Menu → Loja → Estábulo, escolha entre quatro montarias e duas pelagens por espécie. O botão ? no menu de montarias abre sua ficha SRD. Nome e compra ficam diretamente na cena. Ouro, animal e pelagem são persistidos no personagem. A página prioriza o campo, sem painel de montarias adquiridas; pelagens ficam no menu e a cena acompanha a altura da janela, com controles compactos acima do campo nos celulares. npm run test:stable verifica o fluxo em banco descartável.

A selaria abaixo das montarias permite experimentar duas selas, três bardas e ração. O campo de nome e a compra ficam sob o título. A compra do conjunto salva animal, pelagem e acessórios; regras de combate são consultivas. Veja `docs/STABLE-TACK-ART.md` para arte e fonte SRD.

O nome agora fica acima das montarias, na coluna esquerda; a compra fica abaixo da selaria. As duas selas têm artes completas para cada espécie e pelagem (16 combinações), documentadas em [STABLE-SADDLED-ART.json](docs/STABLE-SADDLED-ART.json).

As três bardas também possuem artes completas para todas as espécies e pelagens (24 combinações). Arquivos e prompts em docs/STABLE-BARDED-ART.json.


## Acabamento inspirado no Inkarnate (30/09/2026)

Direção vigente: acabamento construído diretamente no 3D. A imagem Inkarnate foi retirada do material e permanece somente como referência histórica (docs/ATLAS-INKARNATE.md). src/world-relief.ts usa cores por bioma, fotografias CC0 de solo/rocha projetadas em três eixos, fissuras e estratos calculados no shader, erosão nos vértices e copas de árvores em duas malhas instanciadas com sombras reais. src/world-ocean.ts calcula espuma costeira irregular animada. Preservar geografia, territórios e navegação; não reaplicar a imagem completa sobre o terreno. Detalhes e validação em docs/ATLAS-3D-MATERIALS.md.
