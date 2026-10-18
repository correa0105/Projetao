# House 2.0 — paredes, pisos e controles

Atualização de 18/10/2026.

## Comportamento

- Paredes passam de três para **25 acabamentos**, acompanhando os 25 telhados e 25 pisos. Os três IDs e preços anteriores continuam válidos. O material substitui a superfície da parede usando sua silhueta nativa, preservando piso, abertura e movimento da porta.
- Telhados, Paredes e Pisos começam recolhidos, sem categoria selecionada. Clicar abre a categoria; clicar novamente na mesma categoria recolhe. Isso não remove o revestimento aplicado na casa.
- Oito pisos de madeira usam repetição em unidades do mundo, proporcional aos móveis. As tábuas não são esticadas conforme o tamanho da casa. A referência para novas artes é madeira com tábuas menores, como o primeiro anexo do usuário, evitando pranchas gigantes. Pedras, mosaicos e pisos originais das casas conservam sua apresentação.
- Apagar uma luminária retira a emissão de luz e o som associado; a arte conserva as cores originais.
- **Cama de alcova** (`furniture-113`) e **Cama com dossel recolhido** (`furniture-115`) saem da venda na House 2.0. As unidades já compradas, layouts e o catálogo do VTT continuam disponíveis. Repetir uma compra histórica concluída não cobra novamente.
- O administrador encontra **Ajustar hora do dia** junto ao relógio superior. Pode informar hora/minuto, alterando o relógio compartilhado e a iluminação correspondente. O painel Vizinhança conserva o mesmo controle. Autorização vigente é conferida no servidor; revisão protege alterações simultâneas.
- **Guardar** no painel lateral retira o objeto e persiste sua devolução à coleção imediatamente. **Backspace** (tecla acima do Enter) ou **Delete**, com um objeto selecionado, executam a mesma ação. Não é necessário apertar Salvar. Campos de texto, seleção e diálogos não acionam esse atalho.
- Guardar mantém os demais ajustes não salvos. O endpoint modifica somente a colocação do item escolhido, atualiza a revisão do terreno e devolve o layout persistido para rebase do rascunho. Alterações concorrentes causam 409; propriedade e terreno são conferidos sob transação e locks. Nenhum bem comprado é excluído.

## Arte

As 22 novas texturas foram geradas individualmente pelo **imagegen embutido**, em vista superior ortográfica e com iluminação neutra. Os arquivos de produção são WebP 768 × 768; miniaturas têm 192 × 192.

- Artes: `public/house2/walls-20261018/`.
- Miniaturas: `public/house2/wall-thumbs-20261018/`.
- Prompts finais: `data/house2/walls-20261018/prompts.json`.
- Fontes, hashes e metadados individuais: `data/house2/walls-20261018/completed/`.
- Contato e revisão: `review.png` e `visual-review.json` no mesmo diretório.

As artes originais do gerador ficam preservadas fora do conjunto público. A aplicação depende somente dos WebP versionados no projeto.

## Validação

Build e TypeScript em checkout de preparação contendo somente as alterações deste trabalho; alterações independentes do VTT/loja não são incluídas na publicação.

- Suite House 2.0: 20 testes, incluindo guardar, ownership, revisão, não interferência em outros itens, replay de compra histórica e retirada das duas camas.
- Tokens e revestimentos: nove testes, incluindo 25 opções em cada categoria, compra, replay, cobrança, aplicação, revisão e restauração.
- Relógio: dois testes, incluindo autorização administrativa e concorrência.
- Navegador real: Guardar pelo painel, Backspace, edição de texto sem guardar, preservação de outro rascunho, cores de objetos apagados, luzes e visita sem edição, em quatro larguras.
- Navegador real: categorias inicialmente recolhidas, abrir/recolher, 25 paredes, compra, aplicação, recarga e montaria, em quatro larguras.
- Galeria: 25 materiais distintos em 25 modelos de casa, silhueta e piso preservados, quatro giros de porta.
- Galeria de telhados/pisos: 25 de cada, 625 encaixes de telhados, 25 modelos com escala fixa de madeira e amostras mobiliadas em alta resolução.
- Fluxo geral: compra, edição, arraste, giro, pintura, relógio ADM, captura HD e visita, em cinco larguras.

Todos os testes que escrevem dados usam PostgreSQL descartável. Publicação incremental no Docker local, com backup decodificado, preservação de arquivos anteriores e comparação das 138 tabelas. As 137 tabelas restantes ficaram idênticas. A única diferença foi uma edição concorrente da sala VTT: posições/giros de tokens e duas adições de terreno, com revisão avançando de 2877 para 2883. Comparação com o dump confirmou a origem anterior e a revisão posterior preservada; nenhum dado foi restaurado por cima da edição. Nenhuma migration nova.
