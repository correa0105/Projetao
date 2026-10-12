# Imagens das peças de armadura e acabamento das cartas — 12/10/2026

O perfil público de cartas usa agora `/cards/private-archive-20261012.webp`, a mesma sala de arquivo gótica da coleção privada. A biblioteca azul antiga deixa de aparecer nessa aba. O NPC do Salão permanece na imagem original; seu botão com texto foi substituído por um contorno dourado sobre a silhueta, clicável e acessível por teclado. O contorno acompanha o recorte do background em telas largas e pequenas.

## Artes e integração

- `public/shop/armor-parts-20261012/`: 80 recortes originais com transparência, criados pelo image_gen integrado, e 2.155 variantes renderizadas pelo sistema nativo de materiais.
- `data/armor-piece-art-20261012.json`: prompts completos, referências, fontes PNG, destinos, dimensões e hashes; também registra os materiais usados nas variantes.
- `shared/armor-piece-images.json`: 2.235 vínculos entre conjunto, posição e imagem. Inclui as cinco artes anteriores de placas, preservadas.
- `scripts/build-armor-piece-art.mjs`: importa os recortes e produz as variantes locais. Reutiliza as texturas e perfis de materiais existentes. Nos modelos de escamas de dragão e Tramontane, incorpora o acabamento da própria arte do conjunto.

Os modelos humanos recebem peças de cabeça, antebraços, pernas, pés e ombros. Os quatro modelos de mascote têm peças adequadas à anatomia animal, incluindo quatro proteções para patas. Bardas inteiras de montaria continuam inteiras. Os IDs, preços, pesos, propriedades e posse dos itens não são alterados. O seed corrige os caminhos das 2.230 peças que antes mostravam ícones genéricos, inclusive as peças já guardadas. A geração de aparência passa a receber a imagem da peça individual.

O modo de geração é **image_gen integrado** para os 80 recortes originais, com `transparent_background=true`, seguido de exportação WebP local. As variantes mágicas são composição nativa de materiais sobre esses recortes; não são 2.155 gerações independentes de IA. As referências visuais são as artes existentes de cada armadura.

## Validação e preservação

O build TypeScript, Vite e servidor foi realizado em checkout isolado baseado em `cbaa901`, sem incluir os trabalhos pausados do VTT. As quatro pranchas de originais e a prancha de 27 famílias mágicas foram inspecionadas. Testes em bancos UUID descartáveis cobrem os 459 conjuntos, entrega/replay, peso, ownership, equipamento humano e animal, referências da geração de aparência e transparência das imagens. O smoke de navegador cobre clique e teclado no NPC, cinco larguras do Salão, quatro do perfil e carregamento de 20 peças no inventário.

A publicação adiciona arquivos à imagem anterior, preservando os recursos já existentes. O backup local completo é `.local/backups/before-armor-parts-host-profile-20261012.dump`, validado por decodificação. A auditoria local compara as tabelas do banco, todos os campos não visuais do catálogo e os hashes dos arquivos anteriores. Não altera personagens, moeda, inventário ou equipamentos de jogadores para testar.

Os projetos de assets de cenário do VTT e de monstros continuam pausados. As alterações independentes do checkout são preservadas e ficam fora deste commit.
