# Torre do Véu — experimento

Atualização de 06/10/2026. Mural → Torre tem **100 andares**. O checkpoint anterior ao experimento permanece em `codex/checkpoint-antes-torre-2026-10-05` (35d5f36).

## Preparação e descoberta

Administradores usam **Editar andar** para nome, descrição pública, desafio, ambiente, armadilhas, criaturas, guardião e recompensa base. Criaturas são cadastradas pelo mestre: os cem andares iniciam sem encontros inventados. Arte opcional usa o catálogo local de monstros; nomes podem ser próprios. Um guardião pode ser definido em qualquer andar; o padrão inicial é a cada cinco.

Nome/descrição e indicação de guardião são públicos. Nomes e imagens das criaturas, nome do guardião, desafios, ambiente e armadilhas ficam fora das respostas a jogadores até o andar ter sido concluído. Administradores veem a preparação. O personagem que concluiu recebe marca de descoberta pessoal; os demais recebem descoberta da guilda. O projeto possui **uma guilda compartilhada**: uma conclusão de expedição revela aquele andar para seus membros autenticados. Inscrição, início ou seleção do andar não revelam conteúdo. Progresso já confirmado permanece conhecido mesmo que a expedição depois seja encerrada.

A navegação usa seletor compacto de andares e passos anterior/próximo, sem lista lateral extensa. Removidos do hero o slogan, “Preparar a ascensão” e indicadores 30/06/d100.

## Expedições e recompensas

Jogadores entram com personagens próprios, até oito por grupo, uma expedição aberta/ativa por personagem. Mestre administrador e dono inicia, confirma andares em sequência, confirma guardiões e retorno. Ouro/cristais creditam uma única vez por participante. A configuração de guardião no momento de concluir cada andar fica registrada na expedição; alterações posteriores não reescrevem derrotas passadas.

Ouro base padrão em PO = `andar × 8 + guardiões vencidos × 35`; cristais = `andar × 2 + guardiões × 8`. Administrador pode substituir os valores no andar de chegada; campos vazios usam a progressão. Zero é permitido.

**Editar prêmios** modifica a tabela do grau mostrado: faixas do d100, raridade, nome, ouro extra, cristais extras, item do catálogo e quantidade. As faixas precisam cobrir 1–100 em ordem, sem lacunas/sobreposições. Grau é o número de guardiões efetivamente vencidos; tabelas de 0–100 suportam guardião em qualquer andar. Ouro usa inteiros em cobre. As tabelas iniciais preservam os valores do experimento anterior; a administração pode mudá-los.

A conclusão registra a tabela vigente para cada participante antes do crédito. Alterações posteriores não mudam tesouros de expedições já retornadas. O servidor sorteia d100, guarda o resultado e paga bônus uma única vez. Itens vinculados vão para o inventário e têm auditoria própria. Armadura de placas entrega suas peças pelo mesmo conjunto definido para a loja, sem criar compras fictícias. Clique no item na tabela ou no tesouro recebido para ver imagem e descrição. Relíquias sem item vinculado permanecem colecionáveis; não ganham bônus automáticos.

Não concede XP, crédito de missão/patente, cartas ou upgrades. Cristais permanecem moeda da Torre; troca/loja de cristais ainda não faz parte do experimento.

## Persistência

Migration 066 preservada. **067** amplia limites e cria `tower_floors`; **068** cria tabelas editáveis de recompensa, snapshot por claim e `tower_item_grants`. Não apagar registros/migrations ao voltar código. Edições administrativas exigem revisão atual e permissão consultada no banco. Inscrição/progresso/retorno/tesouro mantêm locks, transações, ownership e idempotência; dados sensíveis são filtrados no servidor. Cliente não decide saldos, dado, grau ou item recebido.

## Arte

Ferramenta imagegen **integrada**, modo edição/style-transfer com imagem existente como alvo e os dois anexos do usuário como referências arquitetônicas. Asset final: `public/tower/tower-veil-v2.webp`, 1672 × 941, WebP qualidade 87. Original gerado preservado: `exec-f328ae15-1dd0-42e0-8a11-fa6b078b408d.png`. V1 permanece no projeto como histórico. Nova direção: torre fechada, pedra monumental, estátuas na base, margem de lago, laterais limpas e interior oculto.

Prompt final:

> Use case: style-transfer. Asset type: replacement landscape hero artwork for the Torre do Véu page of Alvorada Cinzenta. Input image 1 is the existing hero, EDIT TARGET; input images 2 and 3 are REFERENCES ONLY for monumental closed cylindrical tower architecture, painterly fantasy atmosphere and imposing upward scale. Rebuild the target tower as an original solitary intact stone tower: massive closed circular walls, tall narrow sealed gothic windows, restrained horizontal carved bands and two enormous weathered robed guardian statues integrated into its base, with distinct original faces/poses. Its upper silhouette ascends into soft cloud and mist. Preserve the target's wide landscape composition, darker quiet left third for the existing website title, tower dominant in the right two thirds, premium painterly dark-fantasy quality, charcoal and slate stone with muted aged copper evening light. Simplify the setting drastically to a quiet misty lake shore, sparse low rocks and distant soft mountains. Show an imposing exterior with a mysterious concealed interior. Remove ALL exposed floors, cutaways, visible caverns/gardens/forges/frost layers, surrounding ruins, side towers, bridges, floating rocks, crystals, banners, crowds and extra structures. The tower should be one clean coherent architectural mass, not a collage or a stack of different biome panels. Atmospheric warm-gray haze and restrained gold on stone, deep blue-gray shadows, strong architectural silhouette. Do not copy the reference figures exactly. No flying creatures or circling clutter, no UI, text, logos, panels, border or watermark. Wide 16:9 banner, entire main tower base visible and tower rising naturally into the clouds.

## Verificação

`node scripts/test-tower-isolated.mjs`: **11/11**, incluindo sigilo real no JSON, edição administrativa/revisões, revelação pessoal/guilda, guardião fora do intervalo inicial, limite 100, concorrência, pagamentos, snapshots e entrega única de todas as peças de armadura ao inventário. Banco descartável; nunca o banco de jogadores.

`--browser`: edição de andar/criaturas/armadilhas e prêmios pela interface, item com imagem/descrição, ausência do conteúdo removido, nova arte, jogador com encontros ocultos/revelados, retorno/d100 persistentes e 1440/768/390/320 sem overflow. Capturas em test-results (ignorado). TypeScript/build conferidos antes da entrega.

A suíte geral anterior tinha 113/115: duas falhas anteriores do kraken em world-fleet.test.ts. Este refino não altera Mundo/kraken nem afirma resolver essas falhas.
