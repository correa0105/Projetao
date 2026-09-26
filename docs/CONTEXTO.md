# Memória do projeto — Alvorada Cinzenta

## Fundo publicado do Reino do Norte

A visão pública agora usa a imagem fornecida pelo usuário em `public/kingdom/north-sonnenberg.png` (1154 × 866), com proporção original, zoom e arraste. Sonnenberg é o único ponto para abrir o registro de missões do reino, incluindo publicação e histórico; o botão acompanha a projeção do mapa. Nenhum local SQL foi renomeado ou removido. O editor continua privado: ao abri-lo, carrega seu próprio fundo, rascunho e câmera; ao fechá-lo, volta ao mapa publicado. As descrições de área vazia abaixo se aplicam somente ao rascunho privado sem upload.

## Estado atual

A aba Personagens agora é um acampamento ilustrado com figuras de corpo inteiro.
Limite de dois personagens por conta; dois pedidos de imagem por personagem por
mês civil UTC (imagem inicial incluída, falhas liberam cota). Novos personagens
são criados somente após a arte ficar pronta; antigos sem imagem mostram silhueta.
Migration 015 guarda referências privadas, fila e imagens no PostgreSQL. Um agente
local em `npm run art:worker` chama a geração nativa de `codex exec` com login
ChatGPT, sem API key. Depende do host ligado e da assinatura do operador; não roda
dentro do Docker. Prompt fixo `docs/CHARACTER-ART-PROMPT-v1.md`, referência visual
`docs/references/character-style-v1.png`. Consulte `docs/CHARACTER-ART.md`.

O acampamento alinha títulos e rodapé à largura/margens do cabeçalho superior
(máximo 1524 px). Placeholder ilustrado em `public/character-silhouette-v2.png`.
Não exibir contadores de imagens nem datas de renovação; apenas a regra mensal
no rodapé e erro ao exceder. Status do ilustrador no canto esquerdo, com ponto
verde online/vermelho offline (exceção de cor solicitada para esse indicador).
O fundo cobre toda a viewport, inclusive atrás do cabeçalho. O acampamento
distribui a altura disponível sem rolagem da página; figuras se reduzem conforme
a tela. Silhuetas pretas com contorno cobre iluminado apenas em hover/foco.
Cada cartão oferece Excluir personagem, confirmado pelo nome. Migration 016
marca `deleted_at`: remove o personagem da seleção e libera a vaga, bloqueia
compras, novas inscrições e geração de arte, mas preserva auditoria e missões
anteriores. A imagem é removida. Pedidos de arte em andamento impedem a exclusão.
Avisos de falha existem apenas no estado do frontend por cinco segundos (ou até
fechar no X), quando um pedido observado em andamento falha. Falhas antigas nunca
são notificadas ao carregar a página. Não há dispensa persistida nem localStorage.
A fila mantém o registro técnico da tentativa, sem consumir cota em falhas.
Migration 018 remove a antiga coluna de dispensa criada pela 017.

O portal usa React/TypeScript, Node.js, PostgreSQL e Docker Compose. O único território com visão regional é o Reino do Norte. O Mundo continua em Three.js/WebGL, com 22 territórios, relevo, oceano e nuvens. Preserve a silhueta em `docs/references/world-silhouette.png`, a geografia em `public/atlas-world-v2.png` e os materiais em `public/atlas-materials/`. A visão inicial do Mundo é 100%, com zoom máximo próximo de 246% e navegação elástica. Consulte `docs/ATLAS-WORLD-RELIEF.md` e `docs/ATLAS-TERRITORIES.md`.

## Reino do Norte e editor

A composição regional ainda não foi definida. O mapa abre como uma área vazia de 4096 × 3072 px virtuais, sem imagem, pintura, objetos automáticos ou névoa. O usuário autorizado pode enviar PNG/JPEG/WebP como fundo e posicionar sprites com oito vistas dos atlas `public/kingdom/nature.png` e `public/kingdom/structures/atlases/`. Fundos enviados mantêm a proporção original (`tilt=1`); a área vazia usa projeção inclinada (`tilt=0.58`). O zoom de trabalho vai de 0,03 a 32, e **Definir visão atual como 100%** salva zoom, centro e giro. **Remover fundo (área vazia)** apaga somente o upload de fundo do autor; os itens do rascunho permanecem. Consulte `docs/KINGDOM-2D.md`.

**Apenas `correa.l@icloud.com` pode usar o editor neste momento.** A interface esconde o botão para outras contas, e o servidor responde 403 em todas as rotas de rascunho, fundo e visão do editor. A comparação de e-mail é insensível a maiúsculas/minúsculas. O projeto ainda usa rascunhos e fundos privados por usuário: salvar no editor não publica automaticamente a composição para os demais jogadores. O acesso a imagens privadas também é restrito no servidor. Os dados existentes no PostgreSQL não foram apagados pela limpeza de arquivos.

O editor oferece colocação, arraste direto, seleção múltipla com Ctrl + mouse, movimento por setas, duplicação, escala, direção, exclusão, desfazer, upload de fundo e zoom. As migrations 011, 013 e 014 guardam rascunho, fundo e câmera privados. A área virtual usa `15000/3072` unidades por pixel de imagem para aceitar fundos grandes. O mapa e o Mundo têm renderizadores independentes; o reino usa Canvas 2D. Não há fallback de terreno costeiro nem asset padrão.

## Regras e dados a preservar

Better Auth gerencia sessões. Consultas privadas filtram pelo usuário autenticado. Compras usam transação, bloqueio de linha, idempotência e auditoria, com valores inteiros em peças de cobre. Missões, eventos e ganchos compartilham `board_posts`; a geografia vive em `world_regions` e `world_locations`. O servidor resolve o local e deriva a região. Novas missões têm data/hora; o autor conclui, recebe resumo e credita XP uma vez. Eventos exigem `guild_staff`. Os seis locais regionais e missões existentes permanecem no SQL, acessíveis por **Missões do reino**, ainda sem marcadores no mapa.

## Validação

`npm run build` verifica TypeScript e gera cliente/servidor. `npm test` exercita autenticação, isolamento, editor e regras com PostgreSQL real. `npm run test:browser` cobre o fluxo geral. `npm run test:editor` verifica pela interface o editor autorizado, zoom, upload proporcional e restauração vazia em uma instância de teste. `ATLAS_BROWSER_GPU=1 npm run test:atlas -- --world-map-only` verifica o Mundo com GPU real; `--terrain-only` verifica navegação da área regional vazia e `--editor-only` verifica que uma conta comum não recebe acesso ao editor. A API autorizada do editor é testada em `tests/integration.test.ts` com um e-mail de editor temporário injetado apenas na instância de teste; o app real mantém o e-mail fixo acima.

Dados de jogadores e volumes Docker não devem ser apagados. Migrations aplicadas não devem ser modificadas; adicione uma nova quando necessário. O histórico de mapas descartados pode ser consultado nos commits Git anteriores, sem carregar seus grandes arquivos no checkout atual.
