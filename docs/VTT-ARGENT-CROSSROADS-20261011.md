# Encruzilhada de prata

Pedido de 11/10/2026: refazer o efeito inteiro a partir de zero.

O ID `argent-crossroads`, o nome, a cor salva, os controles de escala/intensidade/duração e o som permanecem. O novo renderer procedural `src/vtt-argent-crossroads.ts` substitui os dois riscos e o atlas anteriores por quatro faixas de prata entrelaçadas. Curvas ondulantes, torção na largura, perspectiva, faces escuras, reflexos claros, bordas finas e nós luminosos em movimento. Os segmentos são ordenados por profundidade e divididos entre os passes de trás/frente do personagem. O centro conserva espaços abertos para mostrar a arte.

Ciclo contínuo de oito segundos, movimento reduzido congelado pelo renderer comum, cor personalizada e alfa zero para intensidade zero. Paletas reutilizadas com limite de oito entradas e halos desenhados em curvas contínuas; não há leitura de pixels por quadro, novo arquivo de imagem ou dependência de WebGL. A integração em `drawLivingEffect` atende o renderer superior usado pelo VTT/galeria e o modo alternativo. Os materiais de outros efeitos continuam passando pelo tratamento de cor aprovado.

`scripts/review-vtt-argent-crossroads.mjs` usa Edge nativo e a prévia React real. Confere desenho diferente do anterior, sombras/reflexos, duas camadas, movimento/ciclo, tamanho salvo, intensidade, cores, formato retangular, card sem recorte, animação por hover e movimento reduzido, desktop/celular e desempenho. Compara os outros 145 efeitos renderizáveis contra `dc4af6c`, em contextos Canvas equivalentes, admitindo somente até três níveis de diferença premultiplicada por antialiasing. Morte usa seu renderer separado e fica fora dessa comparação.

TypeScript/build no estágio limpo e dez testes de renderer/footprint/projeção. Publicação incremental somente de bundles/HTML sobre `organic-colors-pets-v1-20261011`; servidor, mídias existentes, banco, volumes, ilustrador e 61 arquivos independentes conservados. Snapshot de tabelas antes/depois, hashes das mídias e bundles ao vivo; commit exclusivo desta mudança em `origin/Welson`.
