# Administração limitada por área — 26/10/2026

Pedido do proprietário: a conta Crowley será uma segunda administração, por enquanto apenas para Lore, Regras, Início e Mundo.

`administrator_scopes` (migration 128) concede quatro permissões independentes por ID estável da conta. A migration não promove contas. `administrador=1` continua sendo administração geral; `guild_staff`, autoria e campos recebidos do navegador não concedem essas permissões. Cadastro e atualização de perfil não aceitam concessões. A atribuição operacional é explícita, confere ID e nome e registra `administrator_scope_audit` em transação.

| Área | Conteúdo permitido |
| --- | --- |
| Lore | Pastas/subpastas/lixeira, crônicas publicadas e rascunhos, imagens, linha temporal. |
| Regras | Livro, capítulos/artigos, importação, imagens e histórico. |
| Início | Publicações do diário e imagens; aparência e fundo do calendário. |
| Mundo | Pins públicos e relógio do mundo; APIs dos rascunhos privados continuam limitadas ao próprio dono. |

Criar uma História pelo mapa exige Mundo e Lore. Ter apenas Mundo não revela rascunhos da Lore ou suas prévias. O mapa publicado continua fixo, sem reintroduzir o editor antigo. O calendário distingue administrar sua aparência de criar/editar eventos; uploads novos do calendário usam a área Início e não abrem o endpoint de Eventos. Imagens de eventos ainda privadas não podem ser publicadas por um editor apenas de Início.

As demais áreas conservam suas verificações gerais. Sem ouro ilimitado, cotas especiais de arte, administração do Empório, Eventos, Torre, contas, guildas, House ou mesas de outros mestres. `/api/me` informa `role: content-admin`, `admin_scopes` e mantém `administrador: 0`. A prévia básica da administração geral continua retirando todas as quatro permissões. Revogar uma linha produz efeito na próxima requisição; não há cache de autorização na sessão.

Validação: `node scripts/test-admin-isolated.mjs --scopes` testa concessões independentes, alterações reais nas quatro áreas, publicação de imagens no calendário, sigilo de rascunhos, proibição de Eventos, tentativa de autopromoção, administração principal, prévia básica e revogação. `--scopes-browser` verifica editores em 1440/1024/760/390 px e ausência dos controles gerais. TypeScript e builds cliente/servidor obrigatórios antes da publicação.

A suíte histórica mais ampla executou os testes de administração geral, Lore, Regras e montaria com sucesso. `tests/integration.test.ts` ainda usa criação antiga sem altura/porte/idade aparente e falha na validação de aparência, antes de testar este recurso; não foi alterada nesta tarefa.
