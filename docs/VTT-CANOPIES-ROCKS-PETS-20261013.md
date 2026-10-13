# Copas, seleções transparentes, pedras e mascotes

## Uso no VTT

As 25 árvores do acervo são renderizadas sobre as criaturas. Ao encostar na parte visível da copa, ela passa a 35% de opacidade; ao sair, volta à aparência integral. A detecção acompanha posição, escala, giro e espelho, descontando os pixels vazios do PNG. Tokens ocultos e objetos nas camadas Mapa/Mestre não acionam a transparência. Névoa, visão e permissões continuam no fluxo existente.

O mestre abre **Áreas de transparência** na barra esquerda, ou **Configurações → Mapa → Editar áreas de transparência**. Escolha **Polígono**, **Seleção livre** ou **Retângulo**; clique em **Nova área** e contorne a parte desejada. Para polígonos, conclua a seleção. Os pontos podem ser arrastados ou ajustados com setas/Shift. Cada área tem nome, ativação, remoção e opacidade de 10–80%; padrão 25%. A opacidade geral das árvores também é ajustável. Clique em **Salvar áreas** para persistir.

As áreas elevam somente as partes selecionadas do fundo/objetos da camada Mapa acima das criaturas. Sobreposições usam a menor opacidade ativa, sem duplicar a pintura. Áreas inativas mantêm o desenho normal. Ao sair do editor, os contornos desaparecem. O fundo de uma imagem plana não contém o chão oculto sob telhados: na parte suavizada aparece a cor base do mapa e os tokens; isso não reconstrói uma camada de chão.

Campos opcionais `canopyAreas`/`canopyOpacity` no documento da cena; nenhuma migration. Até 80 áreas/128 pontos. A gravação existente permanece exclusiva do mestre dono administrador, com revisão otimista. Um rascunho antigo que omita os campos conserva as áreas já salvas; a lista vazia enviada pelo editor pode removê-las.

## Pedras

**Biblioteca → Assets → Pedras** contém 25 artes originais, divididas em Grandes (8), Pequenas (8) e Aglomerados (9). Busca, escala, prévia, inserção e arraste seguem as árvores, sem moldura, nome ou barra de vida no mapa. As 25 árvores e 330 criaturas anteriores permanecem disponíveis.

Artes individuais em `public/vtt/rocks-20261013/`, preservando os PNGs nativos transparentes, sem recorte, ampliação ou reprocessamento. Geração pela ferramenta embutida **image_gen**, com um prompt por asset. Prompts completos, fontes nativas, dimensões e SHA-256: `data/vtt/rock-art-20261013.json`. Catálogo: `shared/vtt-rock-catalog.json`.

## Mascotes

Todas as dez espécies usam o mesmo centro de apoio do cão no acampamento e nos perfis. Os animais pequenos continuam pequenos, porém ficam no ponto correto. Artes com equipamento são apresentadas pela caixa visível dos pixels, eliminando margens transparentes que afastavam ou encolhiam o animal. Os arquivos originais e o inventário são preservados.

## Verificação

Schema/geometria em testes unitários; API PostgreSQL descartável verifica dono/jogador, persistência e rascunhos antigos. Edge real em quatro larguras testa dez espécies, margens do equipamento, 25 PNGs únicos com alpha, coleção/escala/drop/busca das pedras, seleção/edição/gravação/recarga das áreas. Teste do renderer compara pixels ao entrar/sair da copa e do telhado, margens vazias, giro/espelho, token oculto, áreas sobrepostas e partes intactas do mapa. Comando: `node scripts/test-vtt-canopies-isolated.mjs` com o ambiente local de PostgreSQL.
