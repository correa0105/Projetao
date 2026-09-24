# Reino do Norte — área editável

## Cena

O mapa regional usa Canvas 2D e começa com um retângulo vazio de 4096 × 3072 px virtuais. Não há fundo predefinido, terreno costeiro, árvores automáticas, trilhas ou névoa. Fora da área, uma cor neutra indica o limite navegável. O Mundo em Three.js/WebGL é independente.

O editor autorizado pode enviar um fundo PNG, JPEG ou WebP com até 128 MB, 12.288 px por lado e 100 milhões de pixels. O servidor valida o formato real com Sharp e grava os bytes no PostgreSQL. A câmera e os limites passam a usar as dimensões do arquivo recebido, sem esticá-lo. O fundo enviado tem projeção sem compressão vertical (`tilt=1`); a área vazia usa `tilt=0.58` para posicionar os sprites em perspectiva. O mapa virtual mede `largura × altura × 15000/3072` unidades.

**Remover fundo (área vazia)** exclui apenas o fundo enviado da conta autorizada. A área volta a ficar vazia nas dimensões padrão, sem substituir a imagem por outra. Os objetos salvos permanecem no rascunho. A câmera salva é associada à versão do fundo e volta ao enquadramento inicial quando o fundo muda.

## Objetos e câmera

Os 22 tipos de objeto vêm de `public/kingdom/nature.png` e das sete pranchas em `public/kingdom/structures/atlases/`. A câmera gira em passos de 45°; cada objeto usa o quadro correspondente e continua em pé na tela. `src/kingdom-scene.ts` contém projeção, recortes e ordem de desenho. `src/KingdomMap.tsx` controla gestos, editor e carregamento.

Arrastar o chão navega. No editor, clicar adiciona, arrastar um sprite move, Ctrl + clique alterna seleção e Ctrl + arraste marca ou desloca grupos. Há setas de movimento, duplicação, tamanho, giro, exclusão, desfazer e salvamento. O zoom de trabalho vai de 0,03 a 32, por roda, botões ou controle deslizante. **Definir visão atual como 100%** salva zoom, centro e giro; fora do editor, a navegação vai de 100 a 130% relativos a essa visão.

## Acesso e persistência

Só a conta `correa.l@icloud.com` pode abrir o editor. A UI oculta o controle para outras contas e o servidor rejeita com 403 as rotas `/api/kingdom/editor-draft`, `/editor-background` e `/editor-view`, incluindo leitura de imagem. A decisão de segurança usa a sessão do Better Auth no servidor. A implementação guarda rascunho (`kingdom_editor_drafts`), fundo (`kingdom_editor_backgrounds`) e visão (`kingdom_editor_views`) privados; salvar ainda não publica o mapa para outros jogadores.

Os seis locais regionais e as missões permanecem no banco. Sem objetos canônicos na cena, **Missões do reino** abre a lista; a seleção direta de cidade no mapa aguarda a composição definitiva. Não apagar dados SQL para limpar os assets antigos.

## Verificação

Execute `npm run build`, `npm test`, `npm run test:browser`, `npm run test:editor` e `ATLAS_BROWSER_GPU=1 npm run test:atlas` para conferir os fluxos. O teste de integração verifica upload 8K, proporção via metadados, restauração vazia, revisão otimista, zoom salvo e autorização no servidor. Os testes do navegador verificam o editor autorizado, a navegação regional e a ausência do builder para contas comuns.
