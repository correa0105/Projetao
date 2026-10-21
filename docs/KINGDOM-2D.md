# Reino do Norte — área editável

## Decisão posterior de 21/10/2026

Por solicitação explícita, o editor antigo foi retirado da interface para todos,
incluindo administrador. O botão Editar mapa e o painel Editor do reino não são
mais montados. A tela usa sempre o mapa publicado em 150%, com navegação e pins.
O cliente não consulta os rascunhos/fundos privados durante essa navegação.
Os dados privados e suas APIs administrativas anteriores permanecem guardados,
sem apagar uploads, câmeras ou rascunhos. As seções históricas abaixo descrevem
essa implementação preservada, não uma ferramenta disponível na interface atual.
O antigo smoke-editor, que pressupõe abrir o builder, é histórico; o smoke de
pins valida a ausência do editor e as ferramentas atuais de mapa.

## Fundo publicado do Reino do Norte

A visão pública usa a imagem definitiva enviada em 21/10/2026, em
`public/kingdom/reino-do-norte-20261021.jpg` (4096 × 2633), com os mesmos bytes do
arquivo original e proporção preservada. Substitui o mapa de teste Sonnenberg.
O clique em **Reino do Norte** no Mundo abre esse mapa; zoom, arraste e retorno ao
mundo continuam disponíveis. **Missões do reino** abre o registro, incluindo
publicação e histórico, sem prender o acesso às coordenadas do mapa de teste.
Nenhum local SQL foi renomeado ou removido. O editor continua privado: ao abri-lo,
carrega seu próprio fundo, rascunho e câmera; ao fechá-lo, volta ao mapa publicado.
As descrições de área vazia abaixo se aplicam somente ao rascunho privado sem upload.

Arquivo original `mapa 1 alvorada copia.jpg`: SHA-256
`49fe342adf41f87ff7f92dd12d534aba8cc4cf7b20a65ceef9199e2e57c29673`.
O arquivo publicado mantém esse mesmo hash. Verificação de navegador em
1440×900 e 390×844 cobriu o clique no território no Mundo, bytes da imagem servida,
metadados 4096×2633, projeção sem compressão vertical, abertura do registro de missões
e retorno ao Mundo. Capturas em `test-results/portal-controls/north-map-*.png`.
Publicado em `https://alvoradacinzenta.com` com a imagem Docker
`alvorada-cinzenta:north-map-20261021`; os bytes servidos em producao conservam
o hash original. Backup anterior: `/opt/alvorada/backups/north-map-before-20261021T171001Z.dump`.

Atualização de enquadramento em 21/10/2026: verificação real em 1440×900, 813×600
e 390×844 confirmou preenchimento dos quatro cantos, região com as dimensões
exatas da viewport, zoom fixo após roda/teclado/pinça e redimensionamento, arraste,
ausência dos controles públicos e abertura/fechamento do registro de missões.
O painel de missões começa abaixo do cabeçalho da conta, mantendo o botão de fechar
acessível. TypeScript e build aprovados; testes em banco descartável, sem alteração
de contas, fichas ou dados do editor em produção.

## Cena

O mapa regional usa Canvas 2D e começa com um retângulo vazio de 4096 × 3072 px virtuais. Não há fundo predefinido, terreno costeiro, árvores automáticas, trilhas ou névoa. Fora da área, uma cor neutra indica o limite navegável. O Mundo em Three.js/WebGL é independente.

O editor autorizado pode enviar um fundo PNG, JPEG ou WebP com até 128 MB, 12.288 px por lado e 100 milhões de pixels. O servidor valida o formato real com Sharp e grava os bytes no PostgreSQL. A câmera e os limites passam a usar as dimensões do arquivo recebido, sem esticá-lo. O fundo enviado tem projeção sem compressão vertical (`tilt=1`); a área vazia usa `tilt=0.58` para posicionar os sprites em perspectiva. O mapa virtual mede `largura × altura × 15000/3072` unidades.

**Remover fundo (área vazia)** exclui apenas o fundo enviado da conta autorizada. A área volta a ficar vazia nas dimensões padrão, sem substituir a imagem por outra. Os objetos salvos permanecem no rascunho. A câmera salva é associada à versão do fundo e volta ao enquadramento inicial quando o fundo muda.

## Objetos e câmera

Os 22 tipos de objeto vêm de `public/kingdom/nature.png` e das sete pranchas em `public/kingdom/structures/atlases/`. A câmera gira em passos de 45°; cada objeto usa o quadro correspondente e continua em pé na tela. `src/kingdom-scene.ts` contém projeção, recortes e ordem de desenho. `src/KingdomMap.tsx` controla gestos, editor e carregamento.

O mapa publicado ocupa toda a viewport, sem moldura ou faixas vazias, com escala
de cobertura da tela e aproximação fixa em **150%**. O arraste e as setas navegam
pela imagem, com limites que mantêm a tela preenchida. Home centraliza novamente.
Roda, pinça e teclas de zoom não alteram essa aproximação. Os controles de zoom,
giro e centralização foram retirados da visão pública; a orientação é fixa.
Redimensionar a janela ou girar o celular recalcula a cobertura, mantendo 150%.

No editor, clicar adiciona, arrastar um sprite move, Ctrl + clique alterna seleção e
Ctrl + arraste marca ou desloca grupos. Há setas de movimento, duplicação, tamanho,
giro, exclusão, desfazer e salvamento. O zoom de trabalho continua de 0,03 a 32, por
roda, botões ou controle deslizante. **Definir visão atual como 100%** salva zoom,
centro e giro do editor; rascunhos e enquadramentos privados são preservados.

## Acesso e persistência

Só a conta `correa.l@icloud.com` pode abrir o editor. A UI oculta o controle para outras contas e o servidor rejeita com 403 as rotas `/api/kingdom/editor-draft`, `/editor-background` e `/editor-view`, incluindo leitura de imagem. A decisão de segurança usa a sessão do Better Auth no servidor. A implementação guarda rascunho (`kingdom_editor_drafts`), fundo (`kingdom_editor_backgrounds`) e visão (`kingdom_editor_views`) privados; salvar ainda não publica o mapa para outros jogadores.

Os seis locais regionais e as missões permanecem no banco. Sem objetos canônicos na cena, **Missões do reino** abre a lista; a seleção direta de cidade no mapa aguarda a composição definitiva. Não apagar dados SQL para limpar os assets antigos.

## Verificação

Execute `npm run build`, `npm test`, `npm run test:browser`, `npm run test:editor` e `ATLAS_BROWSER_GPU=1 npm run test:atlas` para conferir os fluxos. O teste de integração verifica upload 8K, proporção via metadados, restauração vazia, revisão otimista, zoom salvo e autorização no servidor. Os testes do navegador verificam o editor autorizado, a navegação regional e a ausência do builder para contas comuns.
