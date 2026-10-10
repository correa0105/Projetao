# Lore, Empório e ficha da mesa — 10/10/2026

## Comportamento publicado

- A conta voltou ao retrato circular original de 48 px. A navegação voltou ao botão original no centro inferior da tela e aos seis ícones ilustrados. Foram retiradas apenas as mudanças de menu da Lore introduzidas em `2516db0`; os demais trabalhos daquele commit continuam presentes.
- Clicar no som ou nas notificações dentro da conta mantém o painel aberto. A lista de personagens fecha apenas ao sair da área da conta/lista, selecionar outro personagem ou usar Escape.
- A paisagem original da Lore cobre uma única cena com o cabeçalho e a linha temporal. Névoa, grão e um degradê contínuo unem as áreas. Os registros, engrenagens, seleção de eras e editor permanecem iguais.
- A Chave de vínculo (`keycharm`) recebeu uma edição original via `image_gen.imagegen` para corrigir a geometria. O WebP transparente mantém o endereço público e foi redimensionado proporcionalmente para 768 × 768. A ilustração anterior foi preservada como `keycharm-v1.webp`. PNG nativo, prompt completo e hashes estão em `data/shop-art-corrections-20261010/`.
- A oferta agrupada **Arma drow**, com 153 combinações de modelos/bônus, foi retirada do Empório. O seed conserva os produtos como inativos, inclusive em inicializações futuras. O catálogo público deixa de listar a oferta e sua categoria vazia **Itens mágicos especiais**. Compra individual e carrinho bloqueiam novas compras; mochilas, cofres, equipamentos e histórico anteriores continuam disponíveis. Repetir uma compra já concluída continua idempotente.
- **Armas na mesa** tem um título clicável para recolher/abrir os controles. Enter e Espaço funcionam. A seleção atual das armas e sua empunhadura permanecem iguais.
- As características da ficha da mesa têm quatro seções com títulos centrais: **Antecedente, Classe, Raça e Talentos**. A classificação acontece na origem dos dados derivados; talentos de origem e estilos de luta ficam em Talentos, traços raciais em Raça, recursos/maestrias em Classe e perícias/ferramenta/idiomas do antecedente em Antecedente. A lista antiga de características e todos os cálculos foram preservados para os demais consumidores.
- A lista visual da ficha mostra somente o peitoral quando o conjunto de armadura está presente. Componentes continuam no inventário, equipados quando aplicável e incluídos no peso. Um componente avulso sem o peitoral correspondente permanece visível.
- A caixa de aviso vazia junto à barra lateral do mapa foi removida. Avisos de espectador e de prévia ainda aparecem quando necessários; o zoom continua à direita.

## Validação

- TypeScript e build completos passaram no estágio limpo usado para publicação.
- `scripts/test-lore-menus-isolated.mjs --browser`: PostgreSQL UUID descartável e Edge real, cinco larguras da Lore (1898, 1440, 768, 390 e 320 px), conta/som/notificações, seis destinos, teclado/Escape, eras/engrenagens/editor e comparação integral dos registros da linha temporal.
- No mesmo teste: seeds repetidos, bloqueio de compra individual e checkout das 153 ofertas, replay da compra anterior, histórico/mochila/saldo preservados, equipamento de item inativo, loja sem a categoria/oferta e hash da nova chave.
- Ficha real em 1440, 768, 390 e 320 px: recolher armas por clique/Enter/Espaço, títulos centrais, características na seção correta, seis componentes no inventário da API e apenas o peitoral na apresentação. Rodapé sem caixa vazia e zoom alinhado.
- Comparação de 108 combinações de raça/classe com a implementação anterior: todos os cálculos e a lista antiga de características idênticos; cada característica tem exatamente uma seção.
- Publicação incremental `lore-key-v2-20261010`, derivada de `profile-token-v1-20261010`, saudável. Servidor, 42 bundles, HTML sem cache e 3496 mídias conferidos por hash.
- 112 tabelas completas idênticas antes/depois. No catálogo, somente 153 alterações de `active=true` para `false`; nenhum produto foi apagado ou teve preço/regras/arte alterados no banco. A tabela do ilustrador conserva identidade e disponibilidade, com heartbeat periódico e processo 32176 ativo.
- Fontes e dados independentes preservados, inclusive os 39 trabalhos de armaduras drow ainda pendentes. Nenhuma migration nova. O arquivo compartilhado `src/Vtt.tsx`, o contexto e o manifesto de arte recebem somente as partes pertencentes a esta solicitação no commit.
