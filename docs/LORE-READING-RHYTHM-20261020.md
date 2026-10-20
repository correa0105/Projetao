# Diagramação dos textos da Lore — 20/10/2026

Direção vigente após correção do usuário: a diagramação anterior foi restaurada
integralmente, incluindo alinhamentos, largura, entrelinha, espaços, quebras e
controle “Alinhamento” no editor. A única diferença em relação à versão anterior
ao experimento é a inicial Cinzel ampliada de 54 para 68 px, com o float e as
margens originais. Não reaplicar a coluna de 74ch ou o corpo forçado à esquerda.
Conferidos leitura/prévia, alinhamento central e esquerdo em 1440/760/390/320 px,
conteúdo preservado e ausência de overflow horizontal. Build aprovado; publicação
`lore-initial-20261020` somente do cliente, conservando servidor e arquivos antigos.

## Experimento anterior — desfeito a pedido do usuário

Após as referências do usuário, o texto livre da crônica passa a ter coluna de
leitura limitada a 74ch, corpo alinhado à esquerda, entrelinha de 1,85 e intervalo
regular entre parágrafos. O título continua respeitando seu alinhamento salvo,
com quebras equilibradas e espaço claro antes do corpo. No editor, a opção de
texto livre é identificada como “Alinhamento do título”.

A inicial decorativa aparece somente na primeira seção de prosa, em tamanho
discreto dentro da linha. Não flutua nem invade o parágrafo seguinte, mesmo se
a abertura for uma frase curta. Seções posteriores não repetem a inicial.

Linhas vazias continuam separando parágrafos. Quebras simples dentro de um mesmo
parágrafo fluem como texto corrido. O conteúdo salvo, os títulos, as citações,
caixas e imagens não são reescritos. Leitura e prévia usam o mesmo LoreBlocks;
imagens pareadas e alinhamentos dos demais tipos de bloco permanecem.

Conferência do componente real no Edge: cinco larguras (1440, 1024, 760, 390 e
320 px) × cinco composições (título centralizado, à esquerda, prévia, imagem
pareada e citação seguida de duas seções de prosa). Verificados texto integral,
parágrafos, alinhamento, inicial única sem float, ausência de overflow horizontal
e capturas de computador/celular. TypeScript e build aprovados.

Publicação `lore-reading-20261020` somente do cliente, derivada de
`item-padding-hall-filter-20261020`; servidor, arquivos anteriores e dados
preservados, sem migrations.
