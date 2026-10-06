# Equipamentos de montarias e mascotes — 06/10/2026

No Inventário, a área de itens equipados permite escolher **Personagem**, **Montaria**
ou **Mascote**. Cada animal comprado pode ser selecionado e equipado com peças da
mochila, por clique no espaço ou arraste. Os espaços seguem a anatomia: cobras não
recebem proteções de patas, aves não recebem peças de quadrúpedes e selas ficam nas
montarias. Armas, mãos humanas e anéis não são espaços de equipamento animal.

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
- `POST /api/companions/:characterId/art`: `{kind, companion_id, idempotency_key}`.
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
