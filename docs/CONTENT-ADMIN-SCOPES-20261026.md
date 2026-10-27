# Administração limitada por área — 26/10/2026

Ampliação posterior solicitada pelo proprietário: acrescentar **Mural, Eventos, Torre e Mesa virtual**, inclusive mesas de outros mestres (confirmação explícita na conversa). Os quatro acessos anteriores continuam. Migration 129 amplia apenas a lista de áreas válidas; a atribuição continua por ID estável, conferência do nome e auditoria em transação, com `administrador=0` e sem alteração em `guild_staff`.

Mural permite administrar os avisos, papéis, tags e conclusão de missões; Eventos permite editar cenário, publicações e imagens; Torre libera seus controles administrativos e configuração de andares/prêmios. A manutenção de Eventos/Torre é ignorada somente para quem administra a respectiva área. Início sozinho continua sem editar Eventos.

Mesa virtual lista as mesas de todos os mestres e concede as ferramentas de mestre dentro delas. O dono, o link pessoal e a mesa ativa de cada proprietário permanecem seus; abrir uma mesa alheia como administrador não a transforma na mesa pessoal da Crowley. A interface mostra “Administrando esta mesa”. A autorização temporária fica vinculada ao ID de quem fez a requisição, inclusive quando um helper manipula o personagem de outra pessoa. O personagem continua sob o controle do dono original. As demais contas e espectadores conservam seus limites. Revogar VTT retira o acesso a mesas nas quais a conta não é dona nem participante.

Continuam restritos os poderes gerais de contas, Empório, guildas e outras áreas não concedidas. Não há ouro ilimitado nem cota especial de arte. A administração geral conserva a prévia básica, que retira os oito escopos sem alterar a conta.

Validação adicional: três testes completos de API para as permissões originais, as novas áreas/mesas alheias e a visão do espectador; 31 verificações de regressão de administração, Torre, VTT, imagens e áudio. Navegador em quatro larguras, ferramentas reais da administração em mesa alheia e espectador seguindo o personagem do mestre. Ver também [correções do espectador e tremor](VTT-SPECTATOR-AND-SHAKE-20261026.md).

## Primeira entrega: quatro áreas

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
