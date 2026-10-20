# Cotas mensais de arte — 20/10/2026

Decisão do usuário: **4 gerações por personagem**, **2 por mascote** e **2 por
montaria** a cada mês civil UTC. Cada animal possui uma cota independente, por
`wardrobe_id`; trocar de animal não desconta a cota dos outros. A arte inicial
de criação do personagem é gratuita. Renovação no dia 1 às 00h UTC (21h do dia
anterior em Porto Alegre). Liberações explícitas de imagens ilimitadas continuam
valendo para os personagens e animais da conta.

`server/art-quota.ts` centraliza as consultas: personagem conta somente jobs sem
`creation`, não falhos e do mês atual; animal conta seus próprios jobs, excluindo
`failed` e `stale`. Jobs iniciais conservam `creation` após a entrega, permitindo
isentar as criações antigas sem reescrever histórico. Retrato e token juntos
consomem um uso; pedidos aceitos reservam a cota. Falha devolve o uso. Mesmos
bloqueios de usuário/personagem, transações, ownership e idempotência anteriores.

`GET /api/character-art` inclui `quotas`, mapa privado por personagem com `used`
e `limit` (null quando ilimitado). Vestir/Nova imagem consultam os valores ao
abrir; mostram limite, usadas e restantes, a isenção inicial e a renovação.
Cota esgotada continua consultável e impede envio. Os painéis dos animais exibem
os mesmos contadores para o animal selecionado, atualizam ao aceitar um pedido
e corrigem falhas no polling. O servidor sempre decide a autorização final.

Sem migration, alteração de imagens, saldo, inventário ou registros existentes.
O worker continua com sua fila; a cobrança é decidida ao aceitar o pedido no
servidor e não exige interromper gerações em andamento.

Validação isolada: `node scripts/test-art-quota-isolated.mjs` cobre criação
gratuita real, quatro usos, esgotamento, concorrência, três animais independentes,
falha/stale, virada UTC, liberação unlimited, fila/idempotência/ownership e entrega.
`--browser` cobre contadores em Vestir, desconto e devolução para animais, estado
esgotado, unlimited e larguras 1440/768/390/320 px. Usa banco UUID descartável,
sem provedor de imagens e sem contas de jogadores.

Resultado: quatro testes de API/entrega aprovados, smoke do inventário aprovado
em quatro larguras, TypeScript e builds aprovados. Publicado na imagem
`art-quota-20261020`; Docker saudável, HTML/bundles conferidos em localhost e
Radmin e servidor idêntico ao build validado. Auditoria das 146 tabelas manteve
145 integralmente idênticas; somente o heartbeat do ilustrador avançou. Nenhum
histórico ou dado de jogador foi reescrito e o worker permaneceu ativo.
