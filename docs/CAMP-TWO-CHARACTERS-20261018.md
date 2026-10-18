# Acampamento original restaurado

Em 18/10/2026, o usuário cancelou a apresentação com quatro posições e pediu a volta ao visual anterior. A aba retorna aos dois personagens lado a lado, sem silhuetas de terceiro/quarto espaço, setas, órbita, perspectiva ou animação de carrossel. `CharacterCamp.tsx` e `character-camp.css` foram restaurados à versão imediatamente anterior à inclusão do carrossel (`e98e568b^`).

O limite de criação volta a dois tanto para jogadores quanto para administrador. A API continua devolvendo todos os personagens existentes; nenhuma ficha, imagem, equipamento, mascote ou montaria é removida. Não há migration nem alteração de registros para reduzir a capacidade.

Build/TypeScript aprovados. Quatro testes de escolhas/API verificaram a capacidade, criação concorrente/idempotente, progressão, recursos e permissões. A interface original foi conferida em 1440, 768, 390 e 320 px usando cópias privadas das artes reais de Nana e Irineu em banco descartável: duas posições, nenhuma seta ou vaga extra e mesma altura de apoio. O fluxo também verificou fichas, evolução, orçamento de atributos e iluminação/revestimentos da House 2.0.

As cópias privadas usadas no diagnóstico do vídeo e das artes ficam somente em `.local/`; não devem ser versionadas. A execução normal do teste usa a silhueta pública. `CAMP_REAL_ART_DIRECTORY` aceita uma pasta local de fixture com `metadata.json` (`id`/`name`) e `<id>.png`.

Validação: `node scripts/test-character-advancement-isolated.mjs --choices-unit` e `node scripts/test-character-advancement-isolated.mjs --browser --choices` após o build, sempre em PostgreSQL descartável.

Publicação local incremental com backup validado, preservação dos arquivos anteriores e conferência do banco. Recarregar a aba carrega o layout restaurado.
