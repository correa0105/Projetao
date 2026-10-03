# Arquivos de lore

A página de lore usa uma apresentação editorial medieval inspirada em
[Overworld Audio](https://overworldaudio.com/): imagens amplas, fundo escuro,
granulação discreta, névoa, revelação na rolagem e movimento suave do enquadramento
com o ponteiro. As imagens e a identidade pertencem ao próprio projeto.
Movimento reduzido desliga animações e deslocamentos.
O fundo da lore ocupa toda a largura da tela, sem as faixas laterais do layout
anterior. O cabeçalho mantém somente o título; a frase e o botão de abrir os
arquivos foram removidos a pedido do usuário.

Pastas usam um vaso de cobre cheio de pergaminhos. Cada crônica recebe um
pergaminho fechado antes do título no arquivo e aberto durante a leitura,
com brilho quente e pequenas brasas inspiradas na fogueira dos personagens.

## Organização e edição

- As 22 regiões vêm de `world_regions`, incluindo regiões ainda não exploráveis.
  Disponibilidade de exploração não impede documentar sua lore.
- Cada região possui Cidades, Capital, Religião, Lendas, Criaturas e História.
  É possível adicionar pastas e subpastas, até quatro níveis, dentro da região.
- **Nova crônica** cria um rascunho particular na região/pasta escolhida.
  O autor pode alterar título, subtítulo, região e pasta no editor.
- Blocos de imagem aceitam retrato à esquerda, centro ou direita; paisagem
  inteira; e meia paisagem à esquerda ou direita. Também possuem legenda,
  descrição acessível, enquadramento completo ou preenchido e efeito opcional.
  Mostrar imagem inteira não amplia nem corta a referência.
- Blocos de texto oferecem texto livre, caixa de pergaminho escuro, inscrição
  e citação. Todos possuem título e alinhamento; parágrafos são texto simples,
  nunca HTML executável. Imagem lateral pode acompanhar o texto no desktop;
  caixas voltam à largura inteira no celular.
- Blocos podem ser removidos e reordenados pelas setas. Desfazer guarda as
  últimas 40 alterações da edição aberta. Prévia mostra o mesmo renderizador
  usado para a crônica publicada.
- **Salvar rascunho** deixa a página privada; **Publicar** compartilha a leitura
  com usuários autenticados. Publicação e edição não criam mensagens externas.
- Só o autor e a staff podem editar ou enviar imagens para uma página.
  Crônicas iniciais sem autor continuam editáveis apenas pela staff.
- A conta **Pai do Cris** pode editar todas as pastas existentes pelo lápis:
  renomear e escolher outra pasta superior na mesma região. O servidor impede
  ciclos, nomes duplicados e mais de quatro níveis, inclusive nas subpastas.
- A lixeira ao lado de cada pasta permite excluí-la junto com as subpastas.
  Se houver crônicas, é obrigatório escolher outra pasta da região para
  guardá-las; textos, imagens, autoria e publicação são preservados.
  **Pastas excluídas** permite restaurar a estrutura. Crônicas sem edições
  posteriores à exclusão também voltam ao local original; as já revisadas
  permanecem onde foram guardadas. Restaure primeiro uma pasta superior
  excluída e mantenha o limite de quatro níveis.
- A gestão de pastas é uma permissão própria, conferida no servidor em cada
  operação. Não altera a staff nem dá acesso a rascunhos ou à edição de textos
  de outros autores.

## Persistência e validação

Migration `041_lore_library.sql`: `lore_folders`, `lore_pages`, `lore_images` e
`lore_page_versions`. Seed copia as duas crônicas existentes para História do
Reino do Norte uma única vez, preservando `world_entries` e o texto original.
Não sobrescreve edições posteriores. Novas categorias não inventam conteúdo.
Migration `042_lore_folder_management.sql` concede a gestão de pastas somente
à conta existente `limawelsn@gmail.com` e cria revisões, exclusão recuperável e
registro das movimentações. A exclusão não apaga crônicas nem uploads. Escritas
de pastas e movimentações de páginas usam a mesma trava transacional.

Uploads PNG/JPEG/WebP estáticos, até 12 MB e 40 megapixels, são decodificados,
orientados e normalizados para WebP de até 2560 px. Binários ficam no PostgreSQL
e não dependem de arquivos locais ou serviços externos. Rotas de imagens
conferem a mesma visibilidade da página; não expõem imagens de rascunhos.
Só imagens pertencentes à própria página podem ser associadas aos blocos.

Salvamento usa transação, revisão otimista e snapshot da versão anterior.
Conflitos entre janelas retornam 409 sem sobrescrever a edição alheia.
Snapshots são preservados no SQL; interface de restauração histórica ainda
não foi implementada. Até 50 blocos por página e 100 uploads por página.

## Verificação

`npm run test:lore` usa um PostgreSQL descartável para testar regiões/subpastas,
preservação das crônicas, uploads, ownership, publicação, imagens privadas,
referências entre páginas, revisões e snapshots.
Também verifica permissões de pastas, edição de categorias existentes, ciclos,
reorganização, exclusão com destino, restauração, limite de profundidade e
preservação de edições posteriores à exclusão.

`npm run test:lore -- --browser` verifica no Edge criação de subpasta/crônica,
upload real, formatos e posições, caixas, prévia, reordenação, publicação,
recarga, responsividade e movimento reduzido. Capturas em `test-results/lore-*`.
Confere ainda ícones fechado/aberto, largura completa em 1890 px, edição,
exclusão com preservação de conteúdo e restauração pela interface.

A suíte geral executada nesta entrega passou 41 de 43 testes. As duas falhas
são anteriores à alteração e pertencem a `tests/world-fleet.test.ts`
(limite angular dos tentáculos e expectativa de ausência da cabeça do kraken).
Os arquivos de mundo e esses testes não foram alterados nesta entrega.
