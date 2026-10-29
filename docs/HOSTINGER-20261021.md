# Publicação na VPS Hostinger

Publicado em **https://alvoradacinzenta.com** em 21/10/2026.
O hostname anterior `srv2083419.hstgr.cloud` e `www.alvoradacinzenta.com`
redirecionam para esse endereço, preservando caminhos, parâmetros e links de mesas.

VPS KVM 2, **Brasil — Campinas**, Ubuntu 24.04 LTS, IP `200.141.20.34`.
Plano contratado ate 21/11/2026. A oferta mensal consultada indicava renovacao de
US$ 24,49 antes dos impostos; verificar a cobranca em Assinaturas antes de renovar.
Arquitetura preservada: React/Vite + Express/Node 24 + PostgreSQL 17 e tradutor local.

## Estado

- `compose.hostinger.yaml` é uma configuração independente do Compose local.
- Caddy recebe 80/443, emite HTTPS para `SITE_HOST` e encaminha para a aplicação.
- O app não publica a porta 3000. PostgreSQL fica apenas no loopback 5436 para
  administração por SSH; não abrir essa porta na internet.
- Limites de API e autenticação usam o IP fornecido por um único proxy que
  sobrescreve os cabeçalhos. `TRUST_REVERSE_PROXY=1` é exclusivo desta topologia.
- Publicacao externa concluida com certificado HTTPS valido e reinicio automatico
  dos containers. App e banco saudaveis; porta 3000 privada, banco no loopback.
- Banco migrado com verificacao integral das 146 tabelas: 8.624 linhas, 11 contas e
  21 personagens. Contagens e assinaturas de todas as linhas identicas antes de
  iniciar os servicos. Dumps, segredos e manifests privados ficam fora do Git.
- Versao local do app e ilustrador antigo parados para evitar duas bases divergentes.
  O PostgreSQL local e seus volumes foram preservados como retorno e backup.

## Limpeza de contas em 21/10/2026

Por pedido do proprietario, as dez outras contas foram removidas da base publicada,
incluindo oito contas beta e seus acessos. Permanece uma conta, administradora,
com seus 16 personagens e a mesma mesa pessoal. Cadastros futuros continuam disponiveis.

A operacao foi validada em uma base descartavel restaurada de backup antes de ser
aplicada em transacao na producao. Assinaturas e contagens dos registros vinculados
a conta, personagens e mesa preservados foram comparadas em 115 tabelas; qualquer
alteracao nesses registros cancelaria a transacao. Relacoes sociais e avaliacoes de
contas removidas acompanham a exclusao. O backup imediatamente anterior ficou em
`/opt/alvorada/backups/accounts-before-cleanup-20261021.dump`, fora da rotacao diaria.
Sessoes, credenciais e registros beta das contas removidas ficaram zerados.
HTTPS e a saude do app e banco foram conferidos depois da limpeza.

O proprietario comprou `alvoradacinzenta.com` na Hostinger, com validade exibida ate
21/10/2029, e confirmou o e-mail de registro. O registro A de `@` foi alterado de
`2.57.91.91` para `200.141.20.34`, TTL 300; o CNAME de `www` para o dominio raiz
foi preservado. Nameservers e outros servicos nao foram alterados. Caddy emitiu
certificados Let's Encrypt validos para o dominio raiz e `www`; o hostname antigo
conserva seu certificado e encaminha para o novo dominio. Better Auth, origem do app
e origem dos links de compartilhamento usam o novo endereco. Ao mudar de dominio,
o navegador pode pedir login novamente; a conta e a mesa continuam as mesmas.

O link antigo real da mesa foi aberto no navegador e chegou a
`https://alvoradacinzenta.com/#vtt?room=94266d3e-ebcd-40c5-b344-5afdb138b6d5`,
com o fragmento completo preservado. HTTP redireciona para HTTPS; os aliases
respondem com 301 e preservam tambem os parametros enviados ao servidor.

## Validacao executada

- Imagem Docker construida e testada localmente e novamente na VPS.
- Login em banco vazio corrigido: importar o app/Better Auth somente depois das
  migrations. Teste de inicializacao cobre cadastro e sessao no primeiro boot.
- `npm run test:deployment`: testes de proxy, 60 IPs independentes e inicializacao
  em bancos descartaveis. Acesso direto continua ignorando IPs forjados.
- Simulacao na VPS com 60 contas, personagens e mesas descartaveis: 3.000 leituras
  autenticadas de perfil, personagens e sincronizacao VTT; zero erros em 20,6 s.
  P50 179 ms, P95 300 ms, P99 447 ms. Isto mede o backend nessa simulacao, nao a
  renderizacao 3D em 60 computadores nem todas as combinacoes de uso real.
- A suite geral foi executada separadamente: 642 aprovados e 39 falhas entre 681
  testes. Ha falhas em cenarios de armaduras, catalogo, House, guildas, VTT e efeitos
  e dois processos de teste que nao encerraram. Nao considerar a suite geral verde;
  as partes relacionadas a esta publicacao tiveram verificacao especifica aprovada.
  Os nomes das falhas coincidem com a execucao anterior, sem novos nomes de falha.
- Pagina inicial, imagem do mundo e `/api/health` respondem por HTTPS.

## Configuração no servidor

Usar `/opt/alvorada` como diretório do projeto. O hostname público da VPS pode
servir como endereço temporário, desde que seu DNS aponte para o servidor e
permita a emissão de certificado. Um domínio próprio deve apontar para o IP da VPS
antes da troca.

Copiar `deploy/hostinger/env.example` para `.env.hostinger`, definir `SITE_HOST`
(somente hostname, sem protocolo ou caminho) e gerar novos segredos aleatórios
hexadecimais para o banco e Better Auth. Manter `.env.hostinger` com permissão 600,
fora do Git e dos arquivos publicados. Não copiar a senha local nem credenciais do
Codex para o servidor.

```sh
docker compose --env-file .env.hostinger -f compose.hostinger.yaml config --quiet
docker compose --env-file .env.hostinger -f compose.hostinger.yaml up -d db
```

A primeira imagem foi construida em `/opt/alvorada/source`, a partir do commit
`3e7f9ebb` da branch `Welson`, acrescido dos ajustes desta publicacao, com a tag
`alvorada-cinzenta:hostinger-20261021`. A versao atual e
`alvorada-cinzenta:north-map-20261021`, construida a partir de `d7827efb`, incluindo
os controles do portal e o mapa definitivo do Reino do Norte. Para novas versoes, construir uma tag validada
e atualizar `ALVORADA_IMAGE`, preservando a possibilidade de retorno.
`data/vtt/premium-art` foi inicializado a partir do codigo e montado para leitura. Os demais
arquivos de cliente e de dados fazem parte da imagem.

Para trocar de dominio, atualizar `SITE_HOST` no `.env.hostinger`. Os aliases
opcionais ficam em `deploy/hostinger/redirects/*.caddy`, fora do Git; o exemplo
`deploy/hostinger/redirect.example` mostra o formato. Usar apenas nomes diferentes
do dominio principal e com DNS apontado para a VPS. O diretorio pode ficar vazio
em uma instalacao nova. O Compose monta esses arquivos somente para leitura.
Validar o Caddyfile antes de publicar; recriar `app` e `proxy` para atualizar as
origens do Better Auth e os certificados. Manter os volumes do Caddy.

A configuracao com e sem aliases foi aprovada pelo `caddy validate` da imagem
fixada no Compose. Backup anterior ao mapa:
`/opt/alvorada/backups/north-map-before-20261021T171001Z.dump`. Configuracoes
anteriores ao dominio: prefixo `/opt/alvorada/backups/domain-before-20261021T171132Z`.
A verificacao somente de leitura confirmou os mesmos registros e saldos apos
ambas as publicacoes, alem do mapa original por SHA-256 e das alas em manutencao.
O HTML e os tres bundles iniciais servidos pelo dominio novo correspondem
exatamente ao build validado localmente.

## Banco e passagem para o servidor

Fazer uma nova cópia consistente do banco local imediatamente antes da mudança.
O backup de preparação não substitui essa sincronização final. Restaurar somente
na instância nova e vazia da VPS, antes de iniciar o app; não usar `--clean` contra
um banco existente. Conferir tabelas/contagens e personagens, contas, inventários,
ouro, salas e imagens contra a origem. Preservar os volumes e a instalação local
como retorno até a validação da publicação.

```sh
docker compose --env-file .env.hostinger -f compose.hostinger.yaml exec -T db \
  pg_restore -U alvorada_cinzenta -d alvorada_cinzenta \
  --no-owner --no-privileges --exit-on-error < /caminho/do/backup.dump
docker compose --env-file .env.hostinger -f compose.hostinger.yaml up -d
```

O app aplica migrations pendentes e seeds idempotentes na inicialização.
O tradutor carrega os modelos de inglês/português no seu volume persistente.

## Ilustrador

O ilustrador continua separado e autenticado no Codex deste computador; nao faz
parte do container web e as credenciais do Codex nao foram copiadas para a VPS.
`scripts/keep-hostinger-illustrator.ps1` mantem o tunel SSH e o supervisor existentes.
Porta local 5437 encaminha para `127.0.0.1:5436` na VPS, com chave de host validada
pelo console da Hostinger e autenticacao por chave deste computador. Configuracao
do banco criptografada pelo Windows em `%USERPROFILE%/.ssh/alvorada-hostinger-worker.dpapi`.
O `.env` local permanece separado. Nao iniciar o ilustrador sobre a base antiga.

Para reiniciar este supervisor no Windows, usar o PowerShell com Node disponivel:

```powershell
./scripts/keep-hostinger-illustrator.ps1
```
Com o computador/worker desligado, novas gerações ficam indisponíveis; o restante
do site e as artes já salvas continuam disponíveis.

## Backup e verificação

Backup inicial posterior a publicacao verificado e rotina diaria instalada em
`/etc/cron.d/alvorada-database` (03:17 UTC, 00:17 em Sao Paulo). O script mantem
14 dias de dumps completos em `/opt/alvorada/backups`. Esses dumps ficam na propria
VPS; manter tambem copia fora dela. A copia final de migracao ficou preservada neste
computador, e o plano Hostinger tem snapshots semanais. Certificados e modelos têm volumes próprios;
as imagens enviadas pelos jogadores estão no PostgreSQL. Preservar código/imagem
e a pasta de arte premium separadamente.

Os checkpoints manuais anteriores a cada ajuste não devem acumular dumps
completos avulsos indefinidamente. Na limpeza de 29/10/2026, 66 checkpoints
(39.200.956.773 bytes) foram consolidados, sem perda, em
`/opt/alvorada/backups/checkpoint-archive-20261029/release-checkpoints.tar.zst`
(8.135.845.131 bytes). Cada dump foi lido de volta do arquivo e validado por
SHA-256 antes de retirar a cópia avulsa, liberando 31.065.111.642 bytes.
Quatorze dumps recentes, diários ou essenciais continuam disponíveis diretamente;
o backup de contas anterior à limpeza e a cópia final da migração permanecem.

O diretório do arquivo consolidado contém `checksums.json`, o SHA-256 do arquivo
e `result.json`; o tar também inclui `BACKUP-MANIFEST.json`. Para recuperar um
checkpoint individual para inspeção, sem restaurar o banco automaticamente:

```sh
zstd -dc --memory=1536MB /opt/alvorada/backups/checkpoint-archive-20261029/release-checkpoints.tar.zst |
  tar -xOf - NOME-DO-CHECKPOINT.dump > /caminho/seguro/recuperado.dump
```

Diretórios expandidos de releases antigos só podem ser retirados após conferir
que todos os arquivos e hashes correspondem ao pacote comprimido preservado,
sem volumes da aplicação apontando para eles. Conteúdos diferentes ou adicionais
exigem uma cópia adicional validada antes da retirada. Não limpar volumes do
PostgreSQL, uploads, arte premium, configuração, backups essenciais nem a imagem
anterior usada para retorno. Construção de imagem completa exige espaço também
para exportação e descompactação, além do tamanho final da imagem.

Antes da entrega, verificar HTTPS, `/api/health`, login/logout, página principal,
personagens, imagens, inventário e uma mesa virtual com duas sessões. Verificar
60 usuários autenticados em um banco/ambiente descartável com perfil representativo;
o teste de separação de IPs não comprova a capacidade da VPS para 60 jogadores.
Não rodar a suíte de testes no banco real. Não publicar pgweb nem o tradutor.
