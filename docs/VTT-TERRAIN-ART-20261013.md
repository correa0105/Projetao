# Seis texturas de chão — 13/10/2026

Grama, terra, areia, pedra, madeira e neve foram substituídas por seis artes originais individuais, vistas de cima, com detalhe natural e cores próximas das árvores e rochas do VTT. A grama tem pequenos tufos e solo aparente; terra e areia têm grãos irregulares; pedra usa fragmentos naturais; madeira usa tábuas envelhecidas; neve mantém variação e textura sem branco estourado.

Produção pelo `image_gen.imagegen` embutido, uma chamada por material. Nenhum atlas foi usado como substituto das seis imagens. PNGs originais em `data/vtt/terrain-v3-sources-20261013/`; imagens de uso no site em `public/vtt/terrain-v3-20261013/`, WebP 1024×1024, qualidade 95. A conversão apenas dimensiona e codifica o resultado nativo.

O manifest `data/vtt/terrain-v3-reviewed-20261013.json` registra os seis prompts completos, nomes, caminhos de origem/publicação, dimensões, bytes e SHA-256. As texturas e o manifest anteriores permanecem preservados. Os IDs dos materiais não mudam: mapas já pintados recebem as novas artes sem alterar traços, camadas, posições, tamanho da textura, opacidade, borracha ou histórico.

Revisão visual em repetição 3×3 e mapa com pincel/camadas, estrada, árvores e rocha reais. `scripts/verify-vtt-terrain-art.mjs` verifica imagens nativas, catálogo, carregamento, renderer e reaproveitamento durante navegação, sem banco. Benchmark do brush repete o cenário de 120 traços/9.600 pontos com a nova grama. QA do editor em banco descartável também confere a paleta e seus fluxos.

A publicação mantém todas as mídias anteriores e apenas adiciona as seis versões novas. A aplicação, os dados e o ilustrador são conferidos novamente após a troca do cliente/servidor.
