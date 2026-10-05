# Rolagens personalizadas

Guia em **Mesa virtual → Configurações e ajuda → Ajuda → Rolagens personalizadas**,
também disponível no lançador. Fórmulas podem ser digitadas no chat, lançador ou
salvas como macros da mesa. Nomes e explicações próprios em português; notações
curtas são mantidas para reutilizar fórmulas. Implementação independente em
`shared/vtt-roll.ts`, executada pelo servidor com aleatoriedade criptográfica.

| Função na Alvorada        | Sintaxe e exemplo               | Resultado                                                       |
| ------------------------- | ------------------------------- | --------------------------------------------------------------- |
| Lançamento                | `2d6+3`                         | Soma dois d6 e adiciona 3                                       |
| Conservar maior/menor     | `4d6kh3`, `2d20kl1`             | Mantém três maiores ou um menor                                 |
| Descartar maior/menor     | `4d6dh1`, `4d6dl1`              | Exclui um maior ou um menor                                     |
| Atalhos de conservação    | `4d6k3`, `4d6d1`                | Equivalentes a kh3 e dl1                                        |
| Lançamento adicional      | `3d6!`                          | Máximo acrescenta novo dado, repetindo enquanto ocorrer         |
| Gatilho personalizado     | `3d6!3`, `3d6!>4`               | Lança mais ao obter 3 ou pelo menos 4                           |
| Cadeia acumulada          | `5d6!!`                         | Adicionais se tornam um único valor por cadeia                  |
| Adicional com desconto    | `5d6!p`                         | Subtrai 1 de cada resultado adicional                           |
| Relançamento              | `2d6r<3`, `2d6r1r3`             | Substitui resultados até sair das condições                     |
| Segunda tentativa         | `2d6ro<3`                       | Substitui uma única vez por condição/dado                       |
| Contagem de acertos       | `10d6=1`, `10d6>4`, `10d6<2`    | Conta resultados iguais, a partir ou até o limite               |
| Contagem com contratempos | `10d6>4f1`                      | Acertos menos quantidade de resultados 1                        |
| Grupos de dados           | `{4d6+3d8}kh4`                  | Escolhe os quatro maiores dados de ambos os conjuntos           |
| Grupos de totais          | `{4d6,2d8}kh1`                  | Escolhe a maior soma dos dois conjuntos                         |
| Ajuste antes da contagem  | `{3d6+1}<3`                     | Soma 1 a cada dado antes de contar os valores até 3             |
| Organização da exibição   | `8d6s`, `8d6sa`, `8d6sd`        | Crescente por padrão ou decrescente                             |
| Dados de equilíbrio       | `4dF`                           | Cada dado vale −1, 0 ou +1, com probabilidades iguais           |
| Dados calculados          | `(2+1)d6`, `2d(4+2)`            | Calcula quantidade ou faces; quantidade arredondada             |
| Funções                   | `floor`, `ceil`, `round`, `abs` | Arredonda para baixo/cima/próximo ou remove sinal               |
| Cálculo                   | `+ - * / % **`                  | Soma, subtração, produto, divisão, resto e potência             |
| Repetições                | `4d6m`, `4d6mt`, `6d6mt3>4`     | Destaca iguais, conta grupos ou exige três iguais a partir de 4 |
| Destaques                 | `1d20cs>18cf<2`                 | Resultado excepcional/contratempo; não altera total             |
| Anotações                 | `2d6[Chamas]+1d8[Frio]`         | Legenda da parcela preservada na fórmula do histórico           |

`>` e `<` incluem a igualdade. Dados substituídos, descartados e adicionais
continuam no histórico dos lançamentos físicos; o total considera os modificadores.
Descarte não significa apagar o lançamento do chat.

A quantidade/faces calculadas e os grupos são resolvidos primeiro. Relançamentos
e adicionais ocorrem durante o lançamento; conservação/descarte e contagens
depois. Funções/parênteses, potências, produto/divisão/resto e soma/subtração
respeitam a precedência matemática. O resultado é publicado no chat; macros
salvas reutilizam a fórmula. Grupos com vírgula comparam totais; sem vírgula
operam nos dados individuais ajustados pela expressão.

Limites: 100 caracteres, 100 dados iniciais, 1–1000 faces, 500 lançamentos físicos,
10 níveis de agrupamento e total finito até um milhão em módulo. Condições que
continuariam para sempre são rejeitadas. Zero dados serve como constante. Até 30
lançamentos em formas suportadas usam a física 3D, inclusive percentuais e dados
de equilíbrio; quantidades maiores ou faces incomuns usam resultado textual.

Macros são as fórmulas salvas da própria mesa. Ataques e iniciativa usam botões
integrados com ownership/ficha no servidor. Templates de chat, expansão de
atributos/habilidades e perguntas aninhadas de outras plataformas não fazem
parte desse parser. Rolagem privada continua visível ao autor e ao mestre.

Referência funcional consultada em 05/10/2026:
[Dice Reference](https://help.roll20.net/hc/en-us/articles/360037773133-Dice-Reference#DiceReference-OrderofOperations).
Código e textos foram escritos para este projeto; marcas de sistemas externos
não são usadas como nomes de funcionalidades.
