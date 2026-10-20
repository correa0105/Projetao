# Otimização geral — 20/10/2026

As páginas passam a carregar seus módulos e estilos quando são abertas. Ficha, Inventário, Conquistas, Mural, Empório, Estábulo, Mascotes, Eventos, Cartas e Lore deixam de engrossar a entrada do portal. Os formulários de personagem e publicação têm carregamento separado, inclusive quando usados por outras páginas.

## Medições do build

Comparação com o cliente instalado `lore-initial-20261020`, sem alterar resolução de imagem, densidade do canvas, efeitos ou frequência visual das animações:

| Arquivo principal | Antes | Depois | Redução |
| --- | ---: | ---: | ---: |
| JavaScript | 1.439.394 bytes | 314.088 bytes | 78,2% |
| CSS | 430.318 bytes | 118.860 bytes | 72,4% |
| JavaScript transferido | 373.862 bytes (gzip) | 93.642 bytes (Brotli) | 75,0% |
| CSS transferido | 89.304 bytes (gzip) | 24.962 bytes (Brotli) | 72,0% |

Esses valores medem os arquivos principais, não a soma de todos os recursos nem o tempo de abertura em uma rede específica. As abas continuam baixando os recursos de que precisam ao serem abertas. Brotli e gzip são produzidos durante o build, evitando recompressão dos bundles a cada acesso. Navegadores sem Brotli mantêm gzip ou a resposta original.

## Dados e VTT

- O catálogo não é baixado ao abrir Início, Acampamento ou outras páginas que não dependem dele. Empório e Torre o solicitam quando necessário, compartilham solicitações simultâneas e revalidam dados ao retornar após um minuto. A atualização periódica só consulta esse catálogo quando uma dessas duas páginas está ativa; as ações continuam atualizando os dados.
- O mapa carrega as texturas usadas na pintura e a textura selecionada no pincel. A biblioteca continua disponível integralmente, com as artes originais.
- Ao trocar o conteúdo/cena, o carregador solta imagens anteriores que não são mais necessárias e cancela suas tentativas de recarga. Recursos compartilhados permanecem disponíveis.
- O ciclo de animação do VTT pausa quando o documento fica oculto e volta ao retornar. Resolução, efeitos e limite visual de 60 fps permanecem iguais.
- Consultas periódicas do estado da sala e do ilustrador não se sobrepõem em conexões lentas. Miniaturas do VTT permitem decodificação assíncrona.
- Compêndio e estado da mesa usam gzip para respostas grandes. Autenticação, filtragem de conteúdo e `no-store` permanecem nas rotas originais; não há cache compartilhado de respostas privadas.

## Validação

- TypeScript e builds do projeto e da publicação isolada.
- 17 testes de transferência HTTP, carregamento/liberação de imagens, editor, cenários, terreno e fichas de monstros.
- `node scripts/test-performance-isolated.mjs`: 24 páginas em 1440 e 390 px, abertura sem catálogo desnecessário, respostas Brotli/gzip/idênticas ao original, criação de mesa, pintura/borracha/desfazer, persistência e recarga de textura, manutenção de `no-store` e observação de 61 segundos sem novo download do catálogo no Início.
- `node scripts/test-basic-pages-isolated.mjs`: regras pelo menu/reload/busca, contas básica/prévia/administrador, recuperação de importação e quatro abas dos perfis em quatro larguras.
- Os navegadores usam PostgreSQL UUID descartável. A comparação dos dados instalados é somente leitura.

Um smoke antigo de cenário (`smoke-vtt-scenery.ts`) encontrou seletores desatualizados: dois botões chamados Assets e expectativas de seis texturas, anteriores ao catálogo atual. A cobertura de pintura foi executada pelo smoke novo, usando o botão Brush do mapa e o catálogo vigente.

## Publicação

A publicação incremental deriva da imagem já instalada, conservando acervo, bundles antigos, configurações, banco e volumes. O servidor-base foi recompilado com SHA-256 idêntico ao servidor instalado antes de aplicar somente as alterações de transferência HTTP. O cliente usa a fonte isolada da versão instalada com as otimizações aplicadas, para não ativar protótipos ou alterações independentes presentes no checkout. Não há migration nem alteração de regras de jogo nesta entrega.

Imagem: `alvorada-cinzenta-app:performance-20261020`. O estágio e os relatórios ficam em `.local/performance-release/` e `test-results/performance/`; o overlay local é `.local/performance-compose.yaml`. A imagem anterior `alvorada-cinzenta-app:lore-initial-20261020` permanece disponível para reversão.

Publicação aplicada e saudável em `http://localhost:3000`. HTML e 12 verificações de transferência dos recursos iniciais conferidos contra o build. Os 13.749 arquivos de acervo fora de bundles/HTML mantêm o mesmo SHA-256 agregado (`8c144f0a0e2efa1e61253d70117efc603fdcd44802557689208aaae21519d981`). Das 145 tabelas auditadas, 144 mantêm conteúdo integralmente idêntico; somente `character_art_worker` teve a atualização normal do heartbeat, mantendo uma linha. O ilustrador continua ativo.
