# Alvorada Cinzenta

Portal de RPG de mesa: jogadores, múltiplos personagens, aventuras e uma loja com inventário
persistido em PostgreSQL. Protótipo funcional em português, inspirado em D&D 5e (2014 / SRD 5.1).

Identidade da guilda: nome escrito em Libre Baskerville na apresentação, azul de noite, pergaminho e cobre envelhecido.
O Bastião da Alvorada é a sede em Vigília. [Direção visual, arte e prompt](docs/IDENTIDADE.md).

Na visão do Reino do Norte, o chão padrão ilustrado mostra trilhas até seis áreas reservadas. O editor permite montar uma composição privada, selecionar e mover grupos com Ctrl + mouse e enviar um background próprio, inclusive 8K. A área navegável cresce com as dimensões da imagem; o fundo padrão mede 15000 × 15000 unidades. A névoa regional foi retirada. Os seis locais e suas missões continuam no SQL; o Mundo 3D permanece independente. Consulte [a documentação da visão do reino](docs/KINGDOM-2D.md).

O botão **Editar mapa** permite posicionar objetos ilustrados, ajustar tamanho e orientação e salvar um rascunho particular no PostgreSQL. Os rascunhos do terreno antigo foram apagados na migration 012; novos arranjos são recuperados ao voltar ao reino e podem ser incorporados à composição compartilhada depois de concluídos.

## Executar em outra máquina

Requisitos: Docker com Compose e Node.js 24 para gerar a configuração e desenvolver.

```sh
node scripts/setup.mjs
docker compose up -d --build
```

Abra **http://localhost:3000** e escolha **Iniciar aventura → Criar uma conta**. Não existe senha de demonstração
nem usuário administrador padrão. Crie um personagem; ele começa com **150 PO** para testar a loja.
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

O serviço é opcional (profile `tools`), acessível somente na máquina local e configurado
em modo de consulta (`--readonly`). Para parar: `docker compose stop pgweb`.
Referência: [Pgweb](https://github.com/sosedoff/pgweb).

## O que já funciona

- Apresentação com mapa e efeito fosco, login centralizado e navegação flutuante inferior agrupada.
- Cadastro, login e logout com Better Auth; sessões no PostgreSQL e cookie HttpOnly.
- Vários personagens por usuário, nove raças e doze classes; seleção de personagem ativo.
- Ficha inicial, matriz padrão de atributos distribuível, PV e CA básica.
- Oito equipamentos SRD importados do 5etools, com busca, categorias e links da fonte.
- Compras transacionais: preço no servidor, desconto de ouro, empilhamento no inventário,
  histórico de compras e chave de idempotência.
- Inventário individual, soma de peso e conquistas por personagem.
- Mural: missões com data/hora e inscrições; próximas mesas aparecem no Início nas 24 horas anteriores, com aviso para o criador mestrar.
- Conclusão pelo criador com resumo, XP por personagem inscrito e gancho opcional. Resumo e resultados ficam no histórico; XP é persistido uma única vez.
- Ganchos são somente para consulta e nascem da conclusão de missões. Eventos são exclusivos da staff/admin.
- Mundo com relevo cartográfico em Three.js, detalhe de solo/rocha, arraste elástico, zoom e nuvens em movimento, preenchendo a tela. A visão inicial usa 100%, equivalente ao antigo enquadramento de 142%; a silhueta fornecida pelo usuário define a geografia. Vinte e dois territórios têm demarcações com destaque ao passar o mouse e clique na superfície; mar contínuo ampliado, ilhotas, vulcão e tormenta complementam o cenário.
- Reino do Norte abre uma visão regional 2D inclinada com solo texturizado. Arraste, zoom e giro de 45° permitem explorar a área. O editor permite compor objetos privados e enviar um background próprio. Não há névoa regional. O Mundo em 3D permanece independente. Detalhes em [KINGDOM-2D.md](docs/KINGDOM-2D.md).
- Lore, Regras, House e Mercenários têm conteúdo inicial persistido no SQL.
- Interface adaptável para desktop e celular, com tema exclusivamente escuro e menu retrátil com ícones medievais ilustrados.

## Limites deste protótipo

Mundo usa uma malha de terreno com alturas, materiais procedurais com detalhe de fotografias CC0 de solo/rocha e câmera ortográfica inclinada. A arte anterior fornece a máscara da costa e a distribuição dos biomas; não é exibida como um quadro ou aplicada como pintura sobre a malha. A escala do relevo é representativa. Implementação em [ATLAS-WORLD-RELIEF.md](docs/ATLAS-WORLD-RELIEF.md); origem da referência em [ATLAS-WORLD-V2.md](docs/ATLAS-WORLD-V2.md). O Mundo exige WebGL; a visão do reino usa Canvas 2D e sprites, sem cena 3D regional. Oito orientações significam oito desenhos do mesmo objeto, não oito dimensões. Somente Reino do Norte possui exploração interna nesta etapa. Missões antigas com locais livres permanecem no mural; somente as vinculadas a um local do atlas aparecem naquele ponto do mapa.

House e Mercenários são páginas narrativas: ainda não há propriedades, baús ou contratação.
A ficha é simplificada; não há bônus raciais, proficiências por classe, magias, combate,
progressão, equipar/vender/consumir itens ou aplicação de efeitos. As 150 PO iniciais são
uma regra de teste, não a regra padrão de riqueza por classe do SRD.

O ouro anunciado nas missões continua informativo. Experiência é concedida na conclusão,
mas a mudança de nível ainda não é automática. Há uma única guilda; campanhas privadas,
moderação e painel de administração serão adicionados depois. Recuperação de senha,
verificação de e-mail e OAuth dependem de configuração de provedores e ainda não estão habilitados.

## Desenvolvimento

Para habilitar eventos, cadastre a conta e atribua a permissão pelo terminal do projeto:

```sh
npm run staff -- email@exemplo.com admin
```

Também aceita `staff` ou `remove`. O comando usa o PostgreSQL configurado no `.env` e exige as migrations aplicadas. Nenhuma conta é promovida automaticamente; permissões não podem ser escolhidas no cadastro. Atualize a página após alterar a permissão.

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
npm run test:atlas   # Mundo, visão do reino, missões compartilhadas e celular
npm run db:migrate   # Aplica migrations pendentes
npm run db:seed      # Atualiza catálogo e cria conteúdo inicial ausente
npm run catalog:import # Busca snapshot SRD do 5etools; revise diff e rode db:seed
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
src/KingdomMap.tsx     visão do reino, câmera 2D, controles e locais acessíveis
src/kingdom-scene.ts   chão ilustrado e sprites de oito orientações em Canvas 2D
src/kingdom-map.css    composição e controles da visão do reino
public/kingdom/       pinturas regionais 2D e pranchas de sprites em oito direções
src/alvorada.css         identidade Alvorada Cinzenta, sobre os estilos estruturais
public/               mapa de entrada, favicon tipográfico e paisagem da fortaleza
shared/               regras iniciais compartilhadas
server/auth.ts        configuração Better Auth
server/app.ts         rotas, autenticação e validação
server/services.ts    transação de compra e idempotência
server/atlas.ts       regiões/locais SQL e validação do local da publicação
server/db.ts          pool e helper de transação
db/migrations/        schema SQL versionado
data/catalog.json     snapshot SRD com commit da fonte
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
