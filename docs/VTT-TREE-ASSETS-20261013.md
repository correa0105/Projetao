# Assets de árvores — 13/10/2026

Na Biblioteca do VTT, Galeria passa a se chamar Assets. A coleção abre em Árvores, com 25 artes originais em PNG transparente e projeção ortogonal de cima, a 90 graus. Criaturas continua oferecendo as 330 artes anteriores, sem alterar Monstros, Presets, Magias ou Assets animados.

O acervo tem carvalhos, coníferas, árvores caducifólias, secas, de clima quente e fantásticas. Busca aceita nomes sem acentos e múltiplos termos; os tipos filtram a coleção. Cada peça tem prévia, escala de 0,5×, 1×, 1,5× ou 2×, botão Colocar no mapa e arraste direto ao tabuleiro. A escala base varia de dois a quatro quadrados conforme a espécie.

Árvores são peças da camada Mapa. A imagem preserva os espaços transparentes entre folhas e galhos, sem moldura circular, nome ou barra de vida. Usam a seleção, movimento, tamanho e rotação já existentes. Somente o mestre coloca peças; jogadores podem consultar o acervo. Salvar mesa persiste a imagem, posição e escala pelo documento de cena existente. Não há migração nem mudança no servidor ou nas permissões das salas.

As 25 imagens foram geradas separadamente pelo imagegen embutido, com referência artística da biblioteca indicada pelo usuário e composições originais. Os PNGs nativos foram copiados sem redimensionamento nem edição de pixels. Resolução: 1254 × 1254. Arquivos finais em public/vtt/trees-20261013. Prompts completos, origem nativa, dimensões, tamanho e SHA-256 estão em data/vtt/tree-art-20261013.json.

Validação: TypeScript e Vite; inspeção das 25 artes no fundo de terreno, alpha real com mínimo 0/máximo 255, 25 hashes distintos e nenhum corte nas bordas. Edge real com PostgreSQL descartável: HTTP/PNG/hashes dos 25 arquivos, pesquisa sem acentos, categorias, escala de 1,5×, botão de inserção, drop no tabuleiro, camada Mapa, salvar/recarregar, 330 criaturas e larguras de 1440/768/390/320 px. Nenhum erro de JavaScript nem mídia faltante. Executar scripts/test-vtt-trees-isolated.mjs com DATABASE_URL local; o runner cria e remove somente um banco de teste identificado por UUID.

Publicação incremental conserva os bundles e todas as mídias anteriores, adicionando apenas o cliente atualizado e os 25 PNGs. A produção recebe somente leitura para conferência; nenhuma sala é usada como fixture.
