# Arquivos de lore

A página de lore usa uma apresentação editorial medieval inspirada em
[Overworld Audio](https://overworldaudio.com/): imagens amplas, fundo escuro,
granulação discreta, névoa, revelação na rolagem e movimento suave do enquadramento
com o ponteiro. As imagens e a identidade pertencem ao próprio projeto.
Movimento reduzido desliga animações e deslocamentos.
O fundo da lore ocupa toda a largura da tela, sem as faixas laterais do layout
anterior. O cabeçalho mantém somente o título; a frase e o botão de abrir os
arquivos e a legenda “I · O MUNDO” foram removidos a pedido do usuário.

Pastas usam uma tigela rasa de bronze ornamentado com seis rolos encaixados
na abertura. A borda traseira fica atrás dos rolos e a parede frontal cobre
suas pontas. Os três ícones possuem volume,
papel envelhecido, detalhes de material/lacre e tamanho ampliado.
Cada crônica recebe um pergaminho fechado antes do título
no arquivo e aberto durante a leitura. Luz azul clara e partículas saem do papel
aberto. Quatro fios de luz partem de pontos distribuídos no papel e se desenrolam
em curvas diferentes ao redor dele. São fitas preenchidas que afinam até a ponta, com
revelação e deriva independentes; sem contorno fixo ou giro conjunto.
Brilho mais fosco e discreto, com as três estrelas de quatro pontas preservadas.
Os traços luminosos permanecem visíveis mesmo com movimento reduzido.

Passar o mouse sobre uma pasta faz a raposa de cristal correr apressada,
esbarrar na tigela e seguir adiante. O contato inclina o recipiente, balança
os papéis e faz um rolo tombar sobre a borda, deslizar para fora e cair ao lado.
O trajeto sobe apenas 3 unidades do SVG e mantém folga da parede na descida.
A sequência de 2,1 segundos acontece uma única vez por entrada do ponteiro.
O rolo caído fica imóvel emitindo magia até
clicar na pasta ou sair de cima dela. Clique/sair cancela também uma sequência
incompleta; a próxima passagem começa do início. Foco por teclado também ativa
o efeito. Toque apenas abre a pasta. Com movimento reduzido, mostra a posição
final e a luz estática, sem corrida, chacoalhada ou queda animadas.
A raposa segue as três referências fornecidas: cauda alongada e afunilada,
olhos em roxo sem borda branca, orelhas e cristais preservados.
Arte, prompt e montagem do atlas em [MASCOT.md](MASCOT.md).

Abrir uma crônica pelo clique ou teclado toca `public/audio/lore-scroll-open.wav`,
um efeito original de papel desenrolando de 1,24 segundo, gerado por
`scripts/generate-lore-scroll-sound.mjs`. Cada abertura reinicia o efeito sem
sobrepor cópias. O volume/mute geral do site controla também esse som; não toca
automaticamente ao carregar, editar ou salvar a página.

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
- O autor, a staff e a conta gestora da lore podem editar ou enviar imagens
  para uma página. Por pedido explícito, **Pai do Cris** pode editar textos e
  imagens de qualquer crônica, inclusive as iniciais sem autor, de outras
  contas e em outras regiões. A autoria original e os snapshots são preservados.
  Rascunhos permanecem privados para leitores comuns; autor, staff e gestão
  da lore têm acesso para edição.
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
- A gestão da lore é uma permissão própria, conferida no servidor em cada
  operação. Não altera a staff nem concede permissões em outras áreas do jogo.

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
conferem a mesma visibilidade da página; não expõem imagens de rascunhos a leitores comuns.
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
Valida edição de crônica inicial, pastas em outra região, remoção da legenda,
efeito azul visível com movimento reduzido e reprodução/repetição do som.
Confere ainda o contato da raposa antes da inclinação, tombamento sem subida
exagerada, descida pela lateral, saída do mascote,
permanência no chão sem reiniciar enquanto o mouse fica na pasta, reset por
clique/saída e alternativa sem movimento. Capturas:
`test-results/lore-mascot-approach.png`, `test-results/lore-mascot-bump.png`,
`test-results/lore-mascot-falling.png`,
`test-results/lore-scroll-holder-fallen.png` e `test-results/lore-scroll-wisps.png`.

A suíte geral executada nesta entrega passou 41 de 43 testes. As duas falhas
são anteriores à alteração e pertencem a `tests/world-fleet.test.ts`
(limite angular dos tentáculos e expectativa de ausência da cabeça do kraken).
Os arquivos de mundo e esses testes não foram alterados nesta entrega.
