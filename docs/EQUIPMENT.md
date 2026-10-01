# Equipamentos do personagem

Na Mochila, **Itens equipados** oferece cabeça/capacete, peitoral, ombreiras, braçadeiras, calça/pernas, mão principal,
mão secundária/escudo, dois anéis, pescoço, capa, luvas, botas, mochila/costas e
cinto/bolsa. Cada posição mostra a imagem original do item e permite equipar ou
desequipar unidades realmente presentes no inventário do personagem selecionado.
O painel usa o mesmo fundo de pergaminho da mochila/cofre. Itens livres da mochila
podem ser arrastados para uma posição: categoria incompatível exibe um aviso por
5 segundos, sem equipar nem consumir o item. Itens do cofre devem primeiro ser
transferidos à mochila. A lista continua disponível para teclado e celular.
Comprar a armadura de placas completa entrega peitoral, capacete, braçadeiras com
luvas, calça, botas e ombreiras, separados no inventário. O preço continua 1.500 PO
e o peso total continua 65 lb (peitoral 27, capacete 8, braçadeiras 6, calça 12,
botas 8 e ombreiras 4). As demais armaduras, incluindo meia armadura, não entregam
peças extras. A migration 038 captura os conjuntos antigos da mochila e do cofre;
o seed entrega suas cinco peças adicionais uma única vez. Novas compras têm suas
entregas registradas em `purchase_item_grants` na mesma transação da cobrança.

Braçadeiras de placas incluem as luvas: equipá-las libera luvas separadas para a
mochila e bloqueia outro par até desequipar as braçadeiras. Cada peça usa uma
unidade real, preservando as regras de conservação.

A aba **Cosméticos** oferece capa de viajante (5 PO), colar com gema azul (5 PO),
tiara (10 PO), luvas de couro (2 PO) e botas de viagem (3 PO), sem efeitos mágicos.
Charuto (0,1 PO) fica em Itens mundanos. Preços e pesos desses acessórios são
valores definidos para o projeto. Tocha, lanterna, corda, gancho, charuto e outros
objetos portáteis podem ocupar uma das mãos. Uma unidade não ocupa as duas mãos;
uma arma de duas mãos continua bloqueando a mão secundária.

As novas artes seguem a armadura original da loja, com fundo transparente.
Referência, arquivos e prompts: [EQUIPMENT-ART.md](EQUIPMENT-ART.md).

Os equipamentos iniciais da ficha SRD continuam registrados separadamente.
Equipar itens não altera automaticamente CA, bônus mágicos ou proficiências.

## Persistência e conservação

Migration 036 cria `character_equipment` e `character_art_equipment`.
`POST /api/inventory/equipment` recebe `character_id`, `slot` e `item_id` (null
para desequipar). O servidor valida proprietário, posição e quantidade usando
o mesmo bloqueio de conta/personagem das transferências. Uma unidade não pode
ocupar duas posições. Armas de duas mãos liberam a mão secundária e bloqueiam
equipar escudos ou outras armas nela.

Equipamentos permanecem em `inventory` para contabilizar patrimônio e peso.
A grade da mochila apresenta somente unidades livres, enquanto o painel mostra
as equipadas. O servidor impede guardar no cofre unidades reservadas; desequipe
antes. O retorno de `/characters/:id/storage` inclui `equipped`, além de inventory
e vault. Compras, saldos e histórico permanecem no fluxo transacional existente.

## Escolha antes de gerar

Na aba Personagem, **Gerar imagem** / **Nova imagem** carrega os equipamentos e
pré-seleciona aqueles com referência visual. Desmarque os itens que não devem
aparecer. Nenhuma seleção gera roupa simples, sem inventar armadura ou armas.
Pedidos para criar personagens novos seguem o fluxo anterior: não possuem itens
comprados para selecionar antes de sua criação.

`equipment_slots` é uma lista fechada de posições. O cliente não escolhe caminhos,
imagens nem nomes de itens. O servidor resolve cada equipamento e seu arquivo local
do catálogo, normaliza a imagem e salva uma cópia no pedido, mantendo-a estável se
os itens forem trocados enquanto a geração aguarda. O worker anexa estilo, aparência
e imagens dos equipamentos nesta ordem, com correspondência explícita de posição.
O prompt pede os mesmos materiais, cores, adornos e modelos, pintados diretamente
no personagem. A fidelidade final depende da geração; a interface não sobrepõe imagens.

## Verificação

`npm run test:equipment -- --all` executa a suíte em PostgreSQL local descartável.
`npm run test:equipment -- --browser` valida no Edge equipamentos, persistência,
seleção de referências, envio e desktop/celular. O teste do ilustrador usa um CLI
simulado para verificar anexos e instruções, sem gastar geração ou cota real.
`npm run test:inventory` verifica o fluxo de transferências existente.
`npm run test:equipment -- --armor` valida compra da full plate e cosméticos,
os 15 espaços, as imagens dos itens, objetos nas mãos e referências na geração.
