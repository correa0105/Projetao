# Prévia global de conta básica

Administradores têm a aba lateral **Visualização** em todas as páginas autenticadas
do portal. Ela permite **Ver como conta básica** e **Voltar à visão de administrador**.
A prévia mantém o modo ao navegar e recarregar a mesma aba. Outra conta não herda
essa preferência. Jogadores comuns não veem o menu.

A mesma conta e seus personagens, propriedades e itens são preservados. A prévia
reproduz capacidades de jogador comum e é somente para consulta: ações que gravam
dados exigem sair da prévia. Não altera usuários, papéis, ouro ou permissões no banco.
Editores abertos e alterações pendentes detectadas bloqueiam a troca para conservar
o trabalho em andamento. Ao alternar, as páginas recarregam seus dados, descartando
resultados de consultas do modo anterior.

`X-Account-Preview: basic` é aceito como redução de privilégios apenas para uma sessão
que continua sendo administradora no banco. O contexto usa AsyncLocalStorage, isolado
por requisição; consultas simultâneas normais e de prévia não compartilham permissões.
Os predicados SQL e verificações administrativas usam o contexto atual. Lore filtra
rascunhos no servidor; eras ocultas, códice, eventos, conquistas, casa, mapa, torre e
VTT entregam as capacidades comuns. Regras também envia o cabeçalho nas consultas
próprias. Valores de ouro ilimitado e builder provenientes de leituras legadas são
reduzidos na resposta. Mutações na prévia são recusadas antes das rotas de domínio.

Verificações em bancos UUID descartáveis:

- `node scripts/test-account-preview-isolated.mjs`: capacidades, filtros, leituras
  concorrentes dos dois modos, cabeçalho de conta comum, mutação recusada e conta intacta.
- `node scripts/test-account-preview-isolated.mjs --browser`: navegação em 22 páginas,
  persistência, abas laterais de 320 e 390 px, teclado/Escape e volta ao modo administrativo.
- `node scripts/test-lore-codex-isolated.mjs`: seis larguras, paridade com conta comum,
  rascunhos, bloqueio durante edição, leitor e novo posicionamento do título.
