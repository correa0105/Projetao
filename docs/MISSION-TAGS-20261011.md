# Tags de missão e conquistas — 11/10/2026

## Uso

- O administrador abre **Conquistas → Administrar tags** para criar, renomear ou arquivar tags.
- Na aba **Conquistas e recompensas**, escolhe uma tag, a quantidade necessária e o nome da conquista. Pode adicionar títulos, roupas/equipamentos do catálogo existente e objetos de house, com quantidades por item.
- O autor escolhe uma ou mais tags ao registrar uma missão. Pode ajustá-las no mural enquanto a missão estiver aberta ou ativa.
- A conclusão concede **1 unidade de cada tag da missão a cada personagem participante**. Missões canceladas, ganchos e eventos não concedem tags.
- A contagem pertence ao personagem, é permanente e continua crescendo após cada conquista. Os valores usam `numeric` no PostgreSQL e strings/`BigInt` na aplicação, sem o limite de precisão dos números JavaScript.
- Ao atingir uma meta, o personagem recebe a conquista e suas recompensas automaticamente. Metas criadas depois de já existir uma contagem suficiente são conferidas na próxima abertura das conquistas do personagem ou na próxima missão concluída.
- Roupas e equipamentos aparecem no inventário; conjuntos de armadura entregam suas peças. Objetos de house aparecem no inventário da casa. Títulos aparecem entre os títulos recebidos e podem ser escolhidos para exibição.
- A conquista pode ser colocada na estante e aparecer no perfil público, como as demais conquistas.

O cadastro inicial contém a tag **Goblin**. As metas e recompensas são definidas pelo administrador; não são criadas recompensas exóticas novas automaticamente. É possível premiar equipamentos exclusivos já existentes no catálogo, inclusive itens indisponíveis para compra normal.

## Persistência e segurança

Migration `092_mission_tags.sql`: cadastro de tags, associação às missões existentes em `board_posts`, créditos por missão/personagem/tag, contadores permanentes, regras de conquista e recibos de entrega.

O crédito de tags faz parte da mesma transação que encerra a missão e paga ouro/progressão. Repetição de conclusão ou consultas concorrentes não duplica tags, conquistas ou recompensas. A exclusão de uma publicação antiga não reduz a contagem. Se uma recompensa exceder a capacidade numérica do inventário, toda a conclusão é revertida e a missão continua ativa para nova tentativa.

O servidor valida referências e nomes de recompensas no catálogo. Cadastros administrativos exigem administrador, consultas de progresso exigem o dono do personagem e a edição das tags de uma missão exige autor ou administrador. Regras usam revisão para detectar edição concorrente. Depois da primeira entrega, a tag, a meta e as recompensas dessa regra ficam fixas; seu texto e disponibilidade ainda podem ser atualizados. Arquivar uma tag preserva suas contagens.

## Ajustes visuais da mesma entrega

- O fundo da sala de conquistas usa `center top`. O deslocamento horizontal legado de 2,6% colocava o lustre à direita da estante na arte atual.
- A Lore usa a nova arte `public/lore-world-v2.webp`, gerada pelo modo integrado de ImageGen. O prompt, as dimensões nativas e o hash estão em `data/lore/world-v2-20261011.json`. A composição coloca o castelo à direita e o lago à esquerda, com iluminação de amanhecer, profundidade atmosférica e menos escurecimento da interface.
- A arte anterior foi preservada. A troca do fundo não altera a interação ou o posicionamento da linha temporal.

## Validação

Os testes usam bancos descartáveis locais, nunca o banco de jogadores:

```powershell
node scripts/test-mission-tags-isolated.mjs
node scripts/test-mission-tags-isolated.mjs --all
node scripts/test-mission-tags-isolated.mjs --browser
```

O teste de navegador exige o cliente compilado e Microsoft Edge. Confere cadastro administrativo, recompensas de três tipos, publicação de missão, entrega automática, estante, isolamento entre personagens, telas de 320 a 1868 pixels e interação com três eras da Lore. Todos esses fluxos passaram, com alinhamento horizontal exato e sem excesso de largura ou erros JavaScript.

TypeScript e build passaram. Os quatro testes de tags passaram, incluindo entrega concorrente, precisão acima do limite seguro do JavaScript, metas retroativas e reversão transacional por capacidade do inventário. A regressão de comunidade (mascotes, cartas, títulos, eventos e estante) passou em execução isolada: 7/7.

A execução geral terminou com 275/286 testes aprovados e 11 falhas. A comparação com o commit anterior `07548db` também reproduziu falhas de imagens ausentes no ambiente isolado, expectativas desatualizadas de quantidade de itens, fixtures antigos do VTT e expectativas antigas de animação do mundo. O teste global de busca por nome de título retornou outro personagem chamado Arden; a execução isolada desse fluxo passou. A suíte geral não é declarada integralmente aprovada.
