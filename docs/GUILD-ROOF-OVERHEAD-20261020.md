# Telhado vertical da sede

Os três materiais existentes — ardósia, barro e madeira — agora usam artes ortográficas, com câmera a 90 graus, sem fachada em perspectiva ou volume de varanda. Os IDs de acabamento foram preservados.

Artes finais: `public/guild/roof-overhead-20261020/{slate,red,wood}.webp`. Geradas individualmente pela ferramenta imagegen embutida e convertidas para WebP preservando alfa. Prompts completos, fontes e hashes em `data/guild-roof-overhead-20261020.json`.

O retângulo de cobertura coincide com as paredes existentes. Os beirais ficam com 32% de opacidade quando o token controlado se aproxima da cobertura; o centro continua opaco e a borda interna tem transição suave. Bases de parede aparecem sob os beirais. Entrar remove o telhado e ativa a visão interna existente; sair restaura a cobertura. A porta externa usa a mesma posição, folha animada e estado da porta interna, eliminando a porta em perspectiva sobreposta.

Verificação no navegador em 1440 e 390 pixels: três materiais, transparência em cada uma das quatro bordas, centro coberto, controle de porta, movimento por arrasto até o interior, restauração ao sair e ausência de erros de página. TypeScript e build aprovados. Publicação incremental do cliente e das três imagens, preservando banco e servidor.
