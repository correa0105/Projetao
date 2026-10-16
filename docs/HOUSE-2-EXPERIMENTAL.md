# House 2.0 — vizinhanças experimentais

## Acabamento e câmera — 16/10/2026

A câmera começa próxima do vilarejo e limita a janela inteira ao quadrado de
200 × 200. Arraste e zoom não expõem o fundo repetido nem permitem enquadrar
todo o cenário. Centralizar vizinhança mantém esse limite, inclusive no celular.

Os três primeiros modelos têm interiores ilustrados próprios, com as quatro
paredes internas visíveis no ângulo das referências, vigas, janelas emolduradas
e materiais distintos: madeira/reboco claro, pedra/madeira e madeira/reboco sálvia.
São casas vazias; os móveis continuam sendo os originais do VTT. As prévias de
compra mostram esses interiores. As outras 22 casas usam plantas ortográficas
com piso nítido, encaixes e janelas detalhadas. Nenhuma posição, orientação,
escala, posse ou compra salva é alterada pelo novo desenho.

As três ilustrações e o material de carvalho foram produzidos com imagegen
embutido. A face sul foi corrigida para apontar ao centro, com rodapé junto
ao piso e viga no limite externo. Arquivos em `public/house2/interior-cutaway-00{1,2,3}-v2-20261016.webp`
e `public/house2/oak-floor-20261016.webp`; prompts completos e hashes em
`data/house2-cutaway-interiors-20261016.json` e
`data/house2-interior-material-20261016.json`. Não substituir a mobília por
variantes geradas: o usuário esclareceu que a correção é na casa.

Em House 2.0 → Vizinhança → Luz do cenário, Manhã, Tarde, Entardecer e
Anoitecer mudam a iluminação e as sombras automaticamente. Os três períodos
de sol têm direções e comprimentos próprios, proporcionais à altura do objeto;
pedras ficam menos saturadas. A escolha visual é local ao navegador.

Grama e terra usam textura em escala menor para conservar detalhes no zoom.
Caminhos e margens do riacho têm bordas irregulares mescladas com o material
vizinho, preservando a nitidez do miolo. Não há personalização de grama por lote.

QA: `scripts/verify-house2-interiors.mjs` confere os 25 interiores, os três
cutaways, carregamento, janelas e pixels de três sombras diferentes. O smoke
da House valida cinco larguras, limites da câmera, quatro horários, compra
confirmada, arraste, tamanho, coordenadas livres, persistência e visita sem edição
em banco descartável. Nenhum teste usa o banco de produção.

Entrada em **Menu → Explorar → House 2.0 · testes** (`#house2`). A House original
continua disponível. A versão experimental tem dados próprios no PostgreSQL;
não migra casas, móveis ou compras da versão anterior.

Cada vizinhança possui um cenário de **200 × 200 quadrados**, com 12 lotes de
12 × 12, caminhos curvos, vegetação e riacho. Casas têm posições e
orientações variadas. Os modelos nos lotes livres são ilustrativos: terreno e
casa são adquiridos separadamente. A busca encontra vizinhanças por nome/descrição,
com filtros de disponibilidade e terrenos próprios. Três bairros iniciais em
Vigília usam a mesma paisagem; administrador vigente pode criar outros.

Dentro do bairro, o mapa ocupa a janela inteira e permite arrastar/aproximar.
O botão House 2.0 reúne Terrenos, Casas vazias, Mobília, Minha coleção,
Vizinhança, Meu terreno e Outras vizinhanças. Menu global permanece disponível.
Nome do personagem e do jogador aparecem ao passar o mouse ou focar o lote;
o botão de porta permite consultar o interior, escondendo apenas seu telhado.

## Compras de teste e posse

Por escolha explícita do usuário, cada conta dispõe de **20.000 créditos de
teste**, separados do ouro real. Terrenos custam 1.200; as 25 casas vazias do
VTT custam de 600 a 1.000. A coleção reutiliza as 100 peças da mobília superior
do VTT, com preços experimentais por área. Valores vêm do servidor; não são
preços definitivos nem compras do Empório. Nada tem revenda ou bônus de jogo.

O servidor confere personagem próprio, carteira bloqueada, terreno bloqueado,
saldo, chave idempotente e auditoria transacional. Repetir a mesma compra não
debita novamente; chave reaproveitada com outro pedido é recusada. Duas contas
disputando um lote produzem um único vencedor. Não existe recarga automática
do saldo de teste nem débito em `characters.gold_cp`.
Toda compra abre uma confirmação com custo, saldo disponível e saldo restante;
cancelar não compra. A loja exibe preços; Minha coleção mostra peças já compradas,
com estado Guardado/No terreno e ações Colocar/Ajustar, sem repetir os cards de venda.

**Só o proprietário pode editar o espaço comprado**, inclusive se outra conta
for administradora. `can_edit` é calculado no servidor a partir do personagem
do lote e da conta autenticada. O cliente não escolhe dono, preço ou permissões.
Visitantes consultam proprietários e decoração exposta, sem coleção ou saldo
privados. Não há edição das ruas, de lotes livres ou de vizinhos.

**A casa é fixa**, inclusive no servidor: salvar outra posição ou orientação
é recusado. Móveis permitem arraste livre, coordenadas decimais, giro de 90° e
tamanho entre 25% e 300%. Encaixar na grade de meio quadrado é opcional e começa
desligado; mostrar a grade também é opcional. A caixa inteira, após giro e escala, deve ficar
dentro do lote. O servidor repete essa validação; não basta limitar o cursor.
É possível mobiliar o interior ou a parte externa do próprio terreno.

Para girar um objeto, clique nele no próprio terreno ou use Minha coleção →
Ajustar peça. O bloco **Rotação** mostra o ângulo atual e os botões **Girar −90°**
e **Girar +90°**. O giro respeita os limites do terreno e é confirmado em
**Salvar**; **Descartar** conserva a orientação salva anteriormente. Visitantes
não recebem os controles. A estrutura da casa permanece fixa.

Salvar é explícito e usa revisão otimista. Descartar conserva a última versão
persistida. Guardar retira o móvel do lote, preservando a compra. Uma peça não
pode estar em dois lotes; para mudar de lote, guardar e salvar primeiro. Troca
de lote/bairro é bloqueada durante um rascunho, com orientação para salvar ou
descartar. Atualização periódica pausa durante a edição e em aba oculta.

## Persistência e verificação

Migration aditiva `099_house_v2.sql`: `house2_neighborhoods`, `house2_plots`,
`house2_accounts`, `house2_items`, `house2_orders`. Não modifica a House, VTT,
inventário de aventura ou ledger de ouro existente. Migrations aplicadas são
preservadas. Catálogos e pinturas anteriores são reaproveitados por referência.

Migration `100_house_village.sql` conserva coordenadas absolutas das casas e
móveis comprados, posse, saldo e histórico; acrescenta escala padrão 1 aos itens.
Reorganiza somente lotes livres e arquiva os excedentes sem apagar registros.
O snapshot anterior fica em `house2_village_layout_backups`. Bairros com mais de
12 compras recebem extensões, mantendo todas as propriedades.

Após a rejeição da perspectiva inclinada, o cenário foi refeito como composição
SVG em vista vertical de 90°, usando a grama, terra batida, água, árvores, pedras e
plantas do próprio VTT. Texturas repetem em unidades do mundo, preservando o detalhe
no zoom. Elementos naturais têm distribuição determinística e não cobrem os lotes
nem as ruas. A casa adquirida conserva suas coordenadas. Não há personalização de
grama, cancelada pelo usuário. A ilustração anterior fica apenas como histórico em
`public/house2/village-landscape-20261016.webp`, com prompt em
`data/house2-village-20261016.json`; não é o cenário ativo.

O terreno mistura a grama original com três novas texturas na mesma paleta:
grama curta, tufos e trevo. São 110 áreas irregulares, sobrepostas e suavizadas,
com escalas e giros diferentes para reduzir a repetição visível à distância.
Artes do imagegen embutido, prompts e hashes em `data/house2-grass-20261016.json`.

`node scripts/test-house2-isolated.mjs` testa autenticação, posse, concorrência,
replay, valores adulterados, limite geométrico, revisão, privacidade, coleção,
rollback por saldo e administrador revogado em banco UUID descartável.
`node scripts/test-house2-isolated.mjs --browser` cobre busca, compra, casa,
mobília, arraste, giro, salvar/recarregar/descartar, hover, visita somente leitura,
menu por teclado e cinco tamanhos de 320 a 1920 px.
`node scripts/test-house2-isolated.mjs --migration` verifica a preservação de
compras e coordenadas legadas e a divisão de bairros com mais de 12 propriedades.
