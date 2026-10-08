# Exclusão no inventário e armadura do cachorro — 08/10/2026

Clique em um item da Mochila ou do Cofre e use **Excluir item** nos detalhes.
Escolha a quantidade e confirme em **Excluir**; a quantidade inicial é uma.
Cancelar mantém o item. Excluir parte de uma pilha diminui a quantidade; excluir
todas as unidades livres remove o espaço da grade. Quantidade e peso atualizam
imediatamente e persistem após recarga.

A exclusão é permanente, sem devolução de ouro. O histórico de compras permanece.
Unidades equipadas no personagem, montaria ou mascote precisam ser desequipadas
primeiro. Outras unidades livres da mesma pilha podem ser excluídas normalmente.

POST /api/inventory/discards recebe character_id, item_id, source (backpack/vault),
quantity e idempotency_key. O servidor valida ownership e estoque sob bloqueio de
conta/personagem, considerando todas as reservas. A mesma chave não exclui duas
vezes e não pode ser reutilizada com dados diferentes. Migration 085 registra
origem, quantidade e chave; catálogo e compras não são apagados.

No Inventário → **Mascote**, selecione o cachorro com armadura. **Partes da armadura
na imagem** oferece seis opções, como no cavalo: cabeça, pescoço, peito,
tronco/flancos, patas dianteiras e traseiras. Marque as proteções desejadas e use
**Vestir**. Todas começam marcadas; a escolha do último pedido é recuperada após
recarga e não passa de um animal para outro.

As opções controlam a próxima imagem. Estoque, unidades equipadas, ouro e atributos
permanecem iguais. As referências dos componentes desmarcados ficam fora da
composição; a referência principal define os materiais das regiões marcadas.
Manto, bandana, coleira e outros acessórios equipados permanecem independentes,
escolhidos pelos espaços de equipamento existentes. Todas desmarcadas produzem
o cachorro sem proteção de armadura, conservando os acessórios da lista.

O campo barding_parts existente guarda também a cobertura dos cães. Valores
duplicados/desconhecidos e uso em outras espécies de mascote são recusados.
Geração e revisão recebem a mesma seleção e exigem anatomia canina, pelagem
nas partes desmarcadas e encaixes proporcionais. Um cão sem referência de armadura
não recebe proteção inventada. A imagem atual permanece até uma nova geração
válida; o worker conserva fila, cota e autorização existentes.

Validação: TypeScript/Vite/tsup e build Docker. Dois testes isolados de exclusão/
transferência, com isolamento, reservas, saldo/histórico, concorrência e idempotência.
Quatro testes de companheiros, cão, ilustrador e regressão da barda. Navegador em
1440/768/390/320: cancelar, quantidade máxima, exclusão parcial/total da mochila/
cofre, recarga, escolha de regiões do cachorro, controles por toque e persistência.
Revisão visual das telas, sem overflow ou erros de página.

Testes de Vestir usam uma fixture interna para completar a fila e verificam as
instruções enviadas ao ilustrador/revisor com CLI de teste. Nenhuma imagem de
jogador foi gerada/substituída pelos testes. Backup integral validado:
.local/backups/before-inventory-delete-dog-armor-20261008.dump.

Aplicado no Docker local após os testes: migration 085 registrada, app saudável,
bundles e servidor idênticos ao release validado. Ilustrador reiniciado com fila
vazia para carregar as instruções do cachorro; heartbeat online. Comparação de
44 tabelas completas confirmou preservação dos dados existentes, incluindo
mochila/cofre, reservas, compras, imagens de personagens/animais, VTT e House.
As 320 vistas novas e 274 imagens anteriores da House, 155 sons, 36 efeitos e
330 artes privadas do VTT também foram conferidos. A revisão 330×4 pausada
permanece fora deste release.
