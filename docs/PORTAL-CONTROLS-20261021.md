# Controles do portal — 21/10/2026

Administradores podem excluir qualquer missão do mural, inclusive registros de outro
autor ou sem autor. O botão **Excluir missão** aparece nos detalhes e pede confirmação.
O servidor consulta a permissão atual; contas básicas e a prévia básica são recusadas.
Uma nova tentativa da mesma exclusão mantém a data e o responsável originais.

A migration `119_mission_removal.sql` acrescenta `deleted_at` e `deleted_by` ao aviso.
O aviso removido deixa o mural, o mapa (que usa a mesma consulta) e o calendário.
Inscrições, conclusão, ganchos, tags e alterações de papel/status ficam bloqueados.
Ouro, progressão, participantes, recompensas e créditos já entregues são preservados.
Nenhuma missão real foi excluída automaticamente ao publicar este recurso.

Eventos e Torre ficam em manutenção na configuração de produção da Hostinger.
`MAINTENANCE_AREAS=events,tower` bloqueia as APIs dessas alas com HTTP 503 para
todos, inclusive administradores. A lista é exposta em `/api/me`; o menu mostra
**Em manutenção** e desativa os destinos. Links diretos exibem o aviso e o retorno
ao mural. O servidor também bloqueia alterações de eventos feitas pelo mural.
Para reabrir, definir `MAINTENANCE_AREAS=` no `.env.hostinger` e recriar o serviço app.
Configurações locais sem essa variável continuam permitindo testar essas áreas.
Dados, créditos, expedições e eventos existentes não são alterados pela manutenção.

O Salão das Cartas mantém cabeçalho e painel no fluxo normal. O painel acompanha
a altura real do título e respeita o cabeçalho da página em duas linhas nos tamanhos
menores; o catálogo conserva sua rolagem e a apresentação do anfitrião.

Validação específica:

- TypeScript e build de produção aprovados.
- `node scripts/test-portal-controls-isolated.mjs`: autorização, prévia básica,
  remoção alheia/sem autor, repetição idempotente, recompensas/progresso intactos,
  invisibilidade no mural/calendário e bloqueios de manutenção aprovados.
- `node scripts/test-portal-controls-isolated.mjs --browser`: confirmação e
  cancelamento reais, retirada do aviso de teste, menus fechados e links diretos;
  cartas em 1440×900, 1024×768, 813×600 e 390×844, sem sobreposição ou largura excedente.
- Todos esses testes usam bases descartáveis. Capturas em
  `test-results/portal-controls/`, fora do Git.
