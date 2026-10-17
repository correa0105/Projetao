# Retomada das artes em planta — 17/10/2026

**Conclusão em 17/10/2026:** as 255 artes foram completadas, revisadas e integradas. A expansão adicional de 150 móveis e 20 pincéis também terminou: 425 imagens distintas, sem pendências. VTT e House 2.0 compartilham as novas peças; a House ganhou pintura persistida por terreno e relógio global editável somente pelo administrador, com iluminação automática. Publicação `medieval-complete-v1-20261017` saudável, com backup e auditoria dos arquivos e dados anteriores. Detalhes e validação em [VTT-HOUSE2-MEDIEVAL-COMPLETE-20261017.md](VTT-HOUSE2-MEDIEVAL-COMPLETE-20261017.md). Os checkpoints abaixo são históricos.

## Retomada seguinte: House em vista vertical publicada

Os três interiores experimentais em perspectiva da House 2.0 foram retirados da renderização. House e VTT agora resolvem as mesmas plantas ortográficas pelos IDs existentes; os caminhos antigos continuam como aliases. O renderer usa as dimensões e o giro salvos e o telhado correspondente do catálogo, sem alterar compras, posse, coordenadas, escalas ou dados de jogadores.

TypeScript e build de produção passaram em cópia de trabalho isolada com somente os quatro arquivos da correção. O renderer real das 25 casas foi conferido aberto/fechado nas quatro rotações: nenhum erro de JavaScript, interiores ocultos quando fechados, telhados com cobertura integral e móveis preservados. Capturas e métricas em `test-results/house2-topdown-20261017/`.

Publicação incremental `house-topdown-v1-20261017`, sobre `header-polish-v1-20261017`: 66 arquivos novos, servidor e 13.990 arquivos anteriores preservados por SHA-256, exceto o index atualizado. O CSS anterior do Hall e da Linha Temporal permanece carregado. Saúde, index e três imagens novas conferidos por HTTP. Registro local em `.local/house-topdown-deployment-result.json`. Nenhuma migration ou seed executada.

O checkpoint anterior continha outros oito exports recuperados (commerce-028 a 031 e house-empty-002 a 005), levando o total a 117. Nesta retomada, house-empty-006 e 007 foram gerados pelo imagegen integrado, revisados e exportados: 119/255, com 136 ainda pendentes. Esses totais representam arquivos exportados; somente os três interiores vazios 001–003 foram integrados nesta publicação. A fila completa de artes continua pendente.

Pedido retomado neste chat após desconexões do chat anterior. Direção vigente em `data/vtt/nadir-refit-20261016/art-direction.json`: conservar o acabamento dos interiores aprovados house-023, house-021 e house-011; vista ortográfica vertical, paredes estreitas e equivalentes nos quatro lados, telhados completos correspondentes e interiores residenciais mobiliados/vazios.

Plano completo: 255 imagens para 25 casas, 40 comércios e 100 móveis. Prompts e destinos individuais: `data/vtt/nadir-refit-20261016/prompts.json`. Os registros em `completed/` são exports de arte; não significam publicação nem aprovação de integração. Catálogos, IDs, compras, posições, giros, escalas, ownership e economia devem ser preservados.

Retomada começou em 83 exports. Novas peças geradas, revisadas e exportadas neste chat: furniture-036, furniture-037, furniture-039 a furniture-047, furniture-049 a furniture-052 e furniture-057 a furniture-061 (20 peças). Seis interiores comerciais previamente salvos pelo outro chat também foram exportados e revisados visualmente: commerce-022-interior a commerce-027-interior. Total: 109/255; 146 pendentes. Todos os 109 arquivos e hashes foram conferidos; fila permanente de revisão em `review-pending.json` e guia geométrico em `guides/weapon-rack-plan.png`.

Ferramenta utilizada: image_gen integrado, com transparência e as duas referências de estilo do plano. Fontes e prompts por peça ficam em `.local/nadir-refit-generated/`; os manifests permanentes, dimensões, hashes e miniaturas ficam em `data/vtt/nadir-refit-20261016/completed/`, `public/vtt/nadir-20261016/` e `public/vtt/nadir-thumbs-20261016/`.

Furniture-038 (tapete retangular) continua pendente: cinco tentativas mantiveram fundo/halo visível fora do tecido; não contar essas tentativas como concluídas. Preservar os originais das tentativas para comparação. Furniture-046 foi corrigido usando guia geométrico e está exportado. Ainda reprovados: furniture-048 (tabuleiro irregular), furniture-053 (panelas frontais), furniture-054 (moinho inclinado), furniture-055 (pilão oblíquo) e furniture-056 (jarro oblíquo). Candidatos e motivos em `.local/nadir-refit-rejected/`. Rever também a lista histórica `.local/nadir-review.json` antes de encerrar o lote.

Os últimos pedidos recuperados do outro chat incluem retirar a faixa vazia acima do Hall no perfil visitado e centralizar título/frase da Linha Temporal. Ambos foram corrigidos em `src/hall-immersive.css` e `src/lore.css`. Conferência do CSS em 1912, 1440, 768, 390 e 320 px: padding e afastamento do Hall iguais a zero, erro de centralização da Linha Temporal igual a zero, texto contido. TypeScript e build do cliente passaram. Os ensaios com o servidor Vite não concluíram a navegação; a verificação final usou os seletores/estrutura reais e CSS de produção em Chromium, sem escrever no banco. Métricas em `test-results/header-css-metrics.json`.

Publicação incremental aplicada ao Docker local: `header-polish-v1-20261017`, partindo exatamente de `house2-architecture-v3.1-20261016`. Acrescentados apenas stylesheet versionado e seu gzip, mais link no index. Servidor e 13.988 arquivos anteriores iguais por SHA-256; HTTP/stylesheet/health aprovados. Novas artes continuam em preparação e não foram incluídas nesta publicação.

Comandos de retomada, executados a partir da raiz do projeto: `node .local/nadir-assets.mjs status`, `node .local/nadir-assets.mjs next 8` e, após revisão visual e registro da fonte, `node .local/nadir-assets.mjs export`.

Após completar e revisar as artes, integrar referências sem alterar dados dos jogadores, validar a interface e o renderer, então seguir o fluxo de publicação e Git da branch Welson estabelecido no projeto. Este checkpoint não afirma que o lote foi integrado ou publicado.
