# House 2.0: fluidez — 18/10/2026

O cenário passa a desenhar árvores, objetos e telhados próximos da câmera. Uma faixa adicional de oito quadrados, arredondada em células de oito, mantém as peças prontas antes de entrarem na tela. O teste de interseção inclui a diagonal da arte girada e espaço para sombras; a navegação conserva os mesmos limites e zoom.

Máscaras de grama, mistura dos caminhos e luz ambiente ficam limitadas à mesma região. A iluminação dispensa a máscara quando não há luminárias visíveis e compartilha o cálculo de obstrução entre brilho e clareamento. As sombras, a oscilação das luzes e a mistura orgânica do terreno continuam presentes.

O cenário procedural é reutilizado enquanto a geometria dos terrenos não muda. Camadas estáticas e pintura usam memoização; respostas de atualização idênticas conservam o estado atual. A câmera agrupa movimentos até o próximo quadro e aplica a última posição ao soltar o ponteiro. Os intervalos de sincronização permanecem iguais, preservando atualizações de outros jogadores.

As 350 peças do catálogo compartilhado usam suas miniaturas publicadas na loja e coleção, com carregamento sob demanda. Mapa, confirmação de compra e PNG em alta qualidade continuam usando as artes completas. Não há alteração de servidor, regras, compras, posições, inventário ou banco.

## Medição

Comparação com o commit `e5f5fe8e`, no Edge headless, usando uma vizinhança fixa com 12 casas e 360 móveis. Cada execução arrasta a câmera com cem movimentos; o protocolo do navegador simula uma CPU quatro vezes mais lenta durante a medição. Isso mede o tempo de trabalho da thread principal, não FPS ou velocidade de download.

| Cenário | Antes | Depois | Redução |
| --- | ---: | ---: | ---: |
| Processamento do arraste, 1440 px | 3346 ms | 1381 ms | 58,7% |
| Processamento do arraste, 390 px | 3278 ms | 1264 ms | 61,4% |
| Elementos ativos próximos da casa, 1440 px | 2358 | 702 | 70,2% |
| Móveis ativos próximos da casa, 1440 px | 360 | 79 | 78,1% |

Dados completos e metodologia em `data/house2/performance-20261018.json`. O tempo de carregamento variou entre as execuções e não é apresentado como ganho. O teste usa uma cena artificial reproduzível; o ganho em cada computador depende da cena e do hardware.

## Validação

TypeScript/build isolado, quatro testes de janela/miniaturas e oito regressões de câmera, floresta e beirais. Comparação de pixels do mapa próximo da casa sem diferença perceptível; preservação das artes e do relevo da grama. Navegador real com navegação até o rio e caminhos, pintura com bordas mescladas, casas, edição/arraste/giro/redimensionamento, salvar/descartar, ownership, luz direta no objeto e som, personagens/pets/montarias e recarga. Testes de interface em cinco larguras e captura PNG de 5760 × 3600. Os testes de API e interface usam bancos descartáveis.

Publicação incremental somente do cliente sobre a imagem local anterior. Servidor idêntico, sem migrations; backup PostgreSQL validado e auditoria das 138 tabelas. Arquivos públicos anteriores, acabamento do cabeçalho e alterações independentes do VTT/loja preservados.
