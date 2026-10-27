# Alvorada Cinzenta

VTT e comunidade de RPG, em português brasileiro, com personagens, inventário/Empório, missões, Mundo, Lore, House e Torre. Aplicação React/Vite + Express/TypeScript, PostgreSQL e Docker Compose; autenticação Better Auth.

Produção: [alvoradacinzenta.com](https://alvoradacinzenta.com/).

- [Regras essenciais de desenvolvimento](AGENTS.md)
- [Estado atual e índice dos guias por área](docs/CONTEXTO.md)
- [Operação na Hostinger](docs/HOSTINGER-20261021.md)
- [Identidade visual](docs/IDENTIDADE.md)

Este README mantém instruções de uso e ambiente. Cronologias e decisões antigas foram [arquivadas integralmente](docs/history/20261027-before-summary/project-readme.md); consulte-as apenas para uma investigação histórica. Funcionalidades narrativas e regras planejadas não equivalem a automação implementada: [roteiro de regras](docs/ROADMAP-REGRAS.md).

## Executar em outra máquina

Requisitos: Docker com Compose e Node.js 24 para gerar a configuração e desenvolver.

```sh
node scripts/setup.mjs
docker compose up -d --build
```

Abra **http://localhost:3000** e escolha **Iniciar aventura → Criar uma conta**. Não existe senha de demonstração
nem usuário administrador padrão. Crie um personagem; cada personagem novo recebe 6.000 PO uma única vez, ao concluir a ficha, até nova ordem do proprietário.
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

## Desenvolvimento

Permissões globais são concedidas explicitamente a uma conta existente:

```sh
node --import tsx scripts/admin.ts email@exemplo.com 1
```

Use `0` para revogar. O comando utiliza o banco configurado; confirme o ambiente antes de alterar permissões. Escopos administrativos por área são independentes da permissão global e estão descritos no [guia de escopos](docs/CONTENT-ADMIN-SCOPES-20261026.md). Cadastro/perfil nunca promovem a própria conta.

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
npm run test:rulebook # Regras: API e imagens em PostgreSQL descartável
npm run test:rulebook -- --browser # Editor e leitura com API real no Edge
```

O teste de navegador usa Microsoft Edge instalado. Para Chrome, configure `BROWSER_CHANNEL=chrome`.
Para o Chromium do Playwright, execute `npx playwright install chromium` e configure
`BROWSER_CHANNEL=chromium`. No PowerShell: `$env:BROWSER_CHANNEL='chromium'`.
Capturas ficam em `test-results/`, fora do Git. Testes criam usuários exclusivos e removem
somente os próprios registros ao terminar. Use sempre um banco local ou de teste.

Para executar a versão Docker da aplicação, use `docker compose up -d --build`. Valide somente os fluxos afetados pela alteração; a lista acima é um catálogo de comandos, não uma sequência obrigatória para toda tarefa.

## Arquitetura

Publicacao na Hostinger: [Alvorada Cinzenta](https://alvoradacinzenta.com).
Configuracao, backups, ilustrador e resultados da verificacao em
[docs/HOSTINGER-20261021.md](docs/HOSTINGER-20261021.md).

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
src/KingdomMap.tsx     visão do reino; editor antigo fora da interface pública
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
docs/CONTEXTO.md       resumo atual e índice de guias por assunto
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
