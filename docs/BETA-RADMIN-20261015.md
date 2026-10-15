# Beta para oito jogadores

As oito contas temporárias usam a coorte `beta-20261015`. Cada conta recebe uma única reserva de 20.000 PO (2.000.000 PC) para o primeiro personagem criado pelo fluxo normal do site. O crédito é aplicado na publicação da arte ou, com ilustradores já iniciados antes da atualização, na conclusão da ficha, dentro da mesma transação. Não concede permissões administrativas. Personagens posteriores usam as regras normais; apagar o primeiro não repete o crédito.

Os e-mails, senhas aleatórias e IDs ficam no arquivo privado local de acessos, fora do GitHub. O registro `beta_accounts` permite identificar precisamente as contas para remoção quando o responsável encerrar o beta; nenhuma remoção automática foi agendada. A exclusão futura das contas exige comando explícito do responsável.

## Acesso

O anfitrião mantém o computador, Docker e Radmin VPN ligados. Os participantes entram na mesma rede Radmin usando o nome e a senha dessa rede; depois abrem o endereço HTTP do anfitrião na porta 3000. Não é necessário instalar Radmin Server para abrir o site no navegador. [Instruções oficiais de conexão do Radmin VPN](https://www.radmin-vpn.com/help/index.html).

Defina `BETA_BIND_IP` no `.env` local com o IPv4 do adaptador Radmin VPN. O override `compose.beta-radmin.yaml` conserva localhost, publica a porta adicional somente nesse endereço e autoriza essa origem na autenticação. PostgreSQL e o console SQL continuam restritos a localhost.

Exemplo de ativação com uma imagem construída a partir deste projeto:

```powershell
docker compose -f compose.yaml -f compose.beta-radmin.yaml up -d --build app
```

Se houver um override de release local, inclua-o antes de `compose.beta-radmin.yaml`. A porta TCP 3000 deve estar permitida no adaptador Radmin. O script `scripts/enable-beta-radmin.ps1` cria a regra limitada à rede 26.0.0.0/8; o Windows exige executá-lo como Administrador. A cópia da Área de Trabalho inclui um atalho de ativação para essa etapa.

## Contas e preservação

O script `scripts/setup-beta-accounts.ts` cria exatamente oito contas com credenciais independentes e gera um arquivo privado. Execute somente contra o PostgreSQL local depois de aplicar a migration 096. A execução registra progresso e não troca senhas de contas já existentes. A reserva de ouro é protegida contra repetição.

O backup da Área de Trabalho inclui fontes, artes, configurações locais e um dump PostgreSQL para conservar personagens, salas e pintura. Dependências e saídas de build podem ser reconstruídas pelos comandos do README. Senhas e dump não fazem parte do envio ao GitHub.

## Ilustrador no beta (15/10/2026)

A geração de personagens e companheiros está disponível para as oito contas provisórias, com as mesmas regras de titularidade e cotas normais. O indicador reflete o heartbeat real do serviço local; não depende de permissão administrativa. A sessão ChatGPT permanece somente no computador anfitrião.

O serviço foi reativado após uma interrupção da conexão com PostgreSQL. No Windows, `scripts/keep-illustrator.ps1` supervisiona o processo, conserva um worker já ativo e reinicia o worker em até 20 segundos após ele encerrar. Um bloqueio exclusivo de arquivo evita supervisores duplicados; o lock do PostgreSQL continua impedindo dois workers. Logs e PIDs ficam em `.local/`. O supervisor não altera cotas, ouro nem pedidos da fila. Ao reiniciar, o worker mantém sua regra existente de marcar gerações interrompidas como falha sem cobrar a cota.

Nesta instalação, o atalho **Alvorada - Ilustrador** na inicialização do usuário executa o supervisor em segundo plano ao entrar no Windows. O mesmo atalho foi colocado na pasta de acessos do beta, na Área de Trabalho. Para execução manual em outro Windows com Node e Codex instalados: `powershell -NoProfile -File scripts/keep-illustrator.ps1`. Mantenha o computador, Docker e Radmin ligados; o supervisor tenta novamente quando um serviço ainda estiver iniciando. Não inicia Docker nem disponibiliza o site com o computador desligado.

O formulário distingue consulta em andamento, ilustrador offline e ilustrador online. Consulta novamente a cada quatro segundos e ao retornar à janela; uma resposta pendente não dispara aviso falso de offline e uma reativação é reconhecida sem fechar o formulário. QA do beta em PostgreSQL descartável verifica a espera, o estado offline real, a recuperação automática e oito contas em HTTP sem contexto seguro.
