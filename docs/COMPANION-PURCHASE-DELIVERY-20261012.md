# Compras para mascotes e montarias — 12/10/2026

O Empório entrega acessórios na mochila individual do animal. No carrinho, cada item animal permite escolher entre os mascotes ou as montarias do personagem. O padrão é o animal exibido no acampamento; sem um animal exibido, usa o primeiro adquirido. Itens comuns continuam na mochila do personagem.

Conforme a escolha do usuário, sem um animal correspondente a compra é permitida e o acessório fica na mochila do personagem. O carrinho informa esse destino. Compras anteriores permanecem onde estavam; a transferência existente permite levá-las posteriormente ao animal. Comprar não equipa as peças automaticamente.

## Persistência e regras

- `equipmentTarget` resolve o tipo a partir do catálogo do servidor. O cliente envia somente o identificador opcional do animal; preço, propriedade e compatibilidade são conferidos no servidor.
- Compras individuais e carrinhos usam `grantPurchaseItems`. Todos os componentes de um conjunto de mascote entram na mesma mochila. Armaduras de montaria permanecem inteiras.
- `inventory` conserva o estoque total e `companion_inventory` registra sua alocação individual, conforme o modelo já existente. A mochila humana desconta as unidades alocadas; a entrega não cria cópias adicionais.
- Seleção explícita integra a chave de idempotência. Repetir a compra retorna o pedido anterior sem gastar ouro, duplicar itens ou mudar o destinatário. Animal alheio, tipo incompatível ou item humano enviado a animal rejeitam o carrinho inteiro sem efeitos parciais.
- O servidor trava personagem e animal durante a transação. Usa `ensureWardrobe` para conservar a importação dos acessórios legados da montaria. Não há migração ou alteração de compras antigas.
- A lista de animais precisa carregar antes de finalizar um carrinho com acessórios. Falhas ficam visíveis com opção de tentar novamente. A escolha é separada por personagem.

## Validação

Build completo passou: TypeScript, Vite e servidor. `scripts/test-companion-delivery-isolated.mjs` passou 18 testes em PostgreSQL descartável, incluindo autorização, economia, replay, entrega de conjuntos, equipamento e compatibilidade com armadura inteira de montaria.

`scripts/test-companion-delivery-isolated.mjs --browser` validou pela interface do Edge a compra mista, escolha explícita, padrão do acampamento, quatro mochilas animais independentes, imagens carregadas e compra sem animais. Carrinho conferido em 1440, 390 e 320 px sob CSP de produção, sem erro de JavaScript. Capturas e resultado ficam em `test-results/companion-delivery` no checkout de validação.

O ilustrador foi reativado com a sessão ChatGPT do Codex e heartbeat conferido, sem chave de API. A publicação local parte da imagem anterior, conserva todas as mídias e usa o build isolado para não publicar os trabalhos pausados de assets e monstros. Backup completo validado antes da atualização; imagem anterior retida para recuperação. Branch autorizada: `Welson`.

A conferência encontrou alterações de jogo na mesa ativa, já em andamento entre o backup e o snapshot anterior à publicação: posição, combate, imagem de um token e voz no soundboard. Comparação somente de leitura com o backup isolado confirmou os campos; os registros atuais foram mantidos. As outras 118 tabelas, incluindo todo o catálogo, permaneceram idênticas. O heartbeat do ilustrador seguiu ativo.
