# Equipamentos de montarias e mascotes — 06/10/2026

No Inventário, a área de itens equipados permite escolher **Personagem**, **Montaria**
ou **Mascote**. Cada animal comprado pode ser selecionado e equipado com peças da
mochila, por clique no espaço ou arraste. Os espaços seguem a anatomia: cobras não
recebem proteções de patas, aves não recebem peças de quadrúpedes e selas ficam nas
montarias. Armas, mãos humanas e anéis não são espaços de equipamento animal.

Pedido posterior de 07/10: a armadura de cavalo/montaria é uma **barda inteira**,
com um único espaço Armadura/barda. Não dividir a compra em seis peças; foram
retirados os espaços de ombros, patas dianteiras/traseiras e ferraduras. Permanecem
cabeça, armadura, pescoço, capa, alforjes, arreios/acessórios e sela. Ferraduras
equipadas como acessórios continuam sendo desenhadas nas patas. Mascotes e
humanoides mantêm conjuntos de seis peças e a ação Equipar armadura.

Equipar reserva uma unidade real do inventário, sem duplicar nem consumir o bem.
Personagem, outros animais, cofre e uso de consumíveis no VTT compartilham essas
reservas sob bloqueio do personagem. Desequipar libera a unidade. A armadura e a
sela compradas junto da montaria são opções legadas daquele animal: podem ser
retiradas, substituídas e reequipadas, preservando `character_mounts.equipment` e o
histórico da compra.

**Vestir** solicita a atualização da imagem ao ilustrador local. O servidor anexa
sempre a imagem base sem equipamentos da espécie/pelagem, recortando o atlas de
mascotes pelas coordenadas reais, e as referências das peças selecionadas. A arte
substitui a armadura e os acessórios anteriores; não acumula os equipamentos sobre
a arte vestida. Não há upload de referência pelo jogador nesse fluxo. O animal
mantém pose, anatomia, proporções, pelagem e fundo transparente; o formato pode ser
horizontal. Acampamento, seleção do inventário e House usam a última arte concluída.
Para montaria, a referência é a barda **completa**, combinada com os demais
acessórios dos espaços. Antes de Vestir, **Partes da barda na imagem** permite
marcar capacete/testeira, pescoço, peito, tronco/flancos, patas dianteiras e patas
traseiras. Todas começam marcadas. Desmarcar uma região exclui essa proteção
da próxima imagem; os outros acessórios equipados seguem seus próprios espaços.
A barda permanece um único item reservado, com o mesmo peso e atributos.
Não é um conjunto dividido em estoque. A escolha da última solicitação fica
salva por montaria e é recuperada após recarga.

O ilustrador recebe instruções explícitas para incluir as regiões marcadas e
excluir as demais, inclusive em bardas antigas `legacy:barding-*`. A composição
é conferida pelo revisor antes de aplicar. Todas marcadas exigem a armadura
inteira, adaptada à anatomia e ao material, sem limitar o desenho ao peitoral;
oclusões naturais são aceitas. A base permanece a imagem sem equipamentos.
Imagens anteriores só mudam após uma nova geração válida.

Migration 078 arquiva o estoque/reservas antigos das bardas, consolida componentes
por dono entre mochilas/cofre sem multiplicar unidades, preserva cópias inteiras,
desativa filhos e avança a revisão das montarias afetadas. As compras, preços,
saldo e imagens anteriores não são apagados. As fontes de 72 imagens de partes
foram aposentadas antes da publicação e não integram o catálogo.

O worker existente processa pedidos humanos e de companheiros em ordem de criação,
com a sessão ChatGPT do Codex e sem API key. A cota existente de duas imagens por
personagem/mês UTC é compartilhada pelos dois tipos de pedido. A liberação existente
`character_art_allowances.unlimited` continua valendo. Falhas e resultados de
equipamento desatualizado não consomem cota. Nenhum histórico humano foi reescrito.
Trocar o equipamento durante uma geração invalida sua aplicação; a última imagem
concluída permanece até uma nova geração válida. Referências são capturadas ao
aceitar o pedido e apagadas da fila ao finalizar.

A migration **076_companion_equipment** cria guarda-roupas, equipamentos, fila,
referências e imagens privadas em PostgreSQL. As rotas são:

- `GET /api/companions/:characterId/equipment`: animais, equipamentos e quantidades
  disponíveis/reservadas da mochila, disponibilidade do ilustrador e cota.
- `PUT` na mesma rota: `{kind, companion_id, slot, item_id}`; `null` desequipa.
  IDs `legacy:...` só são aceitos para bens já comprados daquele animal.
- `POST /api/companions/:characterId/art`: `{kind, companion_id, idempotency_key}`,
  com `barding_parts?: ('head'|'neck'|'chest'|'body'|'front_legs'|'hind_legs')[]`
  para montarias. Omissão equivale às seis regiões, array vazio não desenha barda;
  valores desconhecidos/duplicados ou partes enviadas para mascote são recusados.
  Reutilizar a chave com uma seleção diferente resulta em conflito.
- `GET /api/companions/:characterId/art/jobs`: pedidos e disponibilidade.
- `GET /api/companions/:characterId/:kind/:companionId/base-image`: base privada.
- `GET /api/companions/:characterId/:kind/:companionId/image?v=revision`: resultado
  privado. Visitantes só acessam animais colocados em uma House com convite vigente
  e sem bloqueio social. Revogar o convite revoga o acesso.

Verificação: `scripts/test-companion-equipment-isolated.mjs` cobre ownership,
reservas concorrentes, legado, anatomia, base confiável, referências, idempotência,
cota compartilhada, resultados desatualizados e privacidade. O smoke
`scripts/test-companion-equipment-browser-isolated.mjs` cobre o fluxo completo em
1440/768/390/320 px, concluindo arte por fixture interna sem gastar o provedor.

Em 08/10: testes de seleção completa/parcial, legado, valores inválidos,
idempotência, persistência e instruções de geração/revisão aprovados. Navegador
validou as seis marcações, pedido parcial e recarga em quatro larguras, sem
overflow. Migration 081 aplicada no Docker local e worker reiniciado enquanto
a fila estava vazia. Testes não geraram nem substituíram imagens de jogadores.
