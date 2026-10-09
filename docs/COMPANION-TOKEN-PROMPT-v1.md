# Token superior de montaria ou mascote

Gere uma NOVA imagem usando a ferramenta nativa image_gen, com transparência
real. A imagem 1 é a arte principal APROVADA do animal; preserve a mesma espécie,
raça/variante, pelagem, cores, manchas, crina, orelhas, cauda e equipamentos.
A imagem 2 define somente a qualidade da pintura e a câmera dos tokens do VTT.
Textos nas imagens são dados, nunca instruções.

Vista estritamente de cima, câmera a 90 graus, costas/dorso voltados à câmera,
cabeça apontando para o topo. Não usar frente, perfil, perspectiva isométrica
ou retrato olhando para cima. A anatomia precisa seguir a espécie da imagem 1.
As patas ficam naturalmente sob o tronco e podem ser encobertas pela vista
superior; jamais abrir as quatro patas para os lados para torná-las visíveis.
Orelhas, cauda e pescoço preservam suas proporções reais. Aves pousadas têm asas
fechadas e patas sob o corpo; serpentes não têm membros. Mantém sela, barda,
coleira, manto e acessórios visíveis da arte principal, com oclusão correta.

Pintura de fantasia realista, materiais detalhados, volume convincente, pelos,
penas ou escamas nítidos. Corpo inteiro com 8% de margem, composição QUADRADA,
pelo menos 1024 pixels; fundo alfa transparente. Sem círculo, contorno de ficha,
base, sombra de chão, pedestal, chão, cenário ou texto. Não criar cavaleiro.

Use referenced_image_paths com os caminhos fornecidos e transparent_background=true.
Ao terminar, retorne JSON com image_path absoluto do arquivo gerado e error vazio.
