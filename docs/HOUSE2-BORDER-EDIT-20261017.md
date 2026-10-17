# House 2.0 — edição pela borda

Selecionar uma mobília própria mostra oito alças na moldura e um controle circular de giro. Arrastar a moldura move o item; arrastar uma alça redimensiona proporcionalmente, mantendo o lado ou canto oposto fixo. O giro continua em passos de 90°.

As alças acompanham o zoom com tamanho constante na tela e aceitam mouse e toque. Pelo teclado, foque uma alça e use as setas ou +/− para mudar o tamanho em 5 pontos percentuais. No controle de giro, Enter/espaço ou as setas giram a peça. Esc cancela o gesto em andamento; cancelamento de ponteiro ou perda de captura também restaura o rascunho anterior.

Salvar e Descartar continuam usando o layout existente no PostgreSQL. A escala permanece entre 25% e 300%, limitada também pelo espaço disponível no terreno. Toda a imagem permanece dentro do lote, inclusive após giro. Somente o proprietário recebe os controles; casas fixas e visitas conservam suas permissões.

Implementação em `src/House2ItemBorder.tsx`, `src/house2-item-transform.ts`, `src/House2.tsx` e `src/house2.css`. Sem alteração de servidor, esquema ou artes.

Validação:

- TypeScript e builds de cliente/servidor.
- Três testes de geometria: canto oposto fixo nas quatro rotações, oito alças nos limites e giro com encaixe dentro do lote.
- Navegador real em banco UUID descartável: resize por mouse e toque, giro, teclado, Esc, salvar/recarregar, descarte, visitante sem controles, propriedade, compras e pintura do terreno.
- Layout em 1920, 1440, 768, 390 e 320 px; sem erros de JavaScript.
- Publicação incremental local em `alvorada-cinzenta-app:house2-border-v1-20261017`, preservando os arquivos anteriores e o servidor por SHA-256. Evidência local: `.local/house2-border-deployment-result.json`.

Para carregar a versão publicada em uma aba já aberta, recarregar a página.
