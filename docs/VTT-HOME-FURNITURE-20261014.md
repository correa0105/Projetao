# Mobílias e casas vazias — 14/10/2026

Biblioteca → Assets → Mobílias oferece 100 sprites individuais com alpha transparente, nomes e escala em quadrados. A primeira coleção traz móveis; a segunda traz utensílios, equipamentos e decoração sem repetir os mesmos móveis. Use a prévia para escolher a escala, arraste para o mapa e use a alça de giro ou Shift + roda do mouse.

Biblioteca → Assets → Casas vazias oferece 25 interiores sem móveis removíveis. Piso, paredes, portas, janelas existentes e estruturas fixas, como lareiras, foram preservados. As 25 casas mobiliadas continuam em Casas. Um personagem dentro da casa revela o interior para posicionar a mobília; ao sair, o telhado cobre os objetos internos. Objetos colocados do lado de fora continuam por cima do cenário.

As portas foram ajustadas entre os batentes e projetadas como faces verticais articuladas. A entrada permanece alinhada a uma célula do grid. Os botões ficam junto à soleira; na visão interna só aparecem as portas da casa ocupada. Telhados distantes permanecem opacos, os beirais só ficam translúcidos quando o corpo ou um quadrado ocupado pelo personagem os alcança, e o telhado some ao entrar.

A visão pelas janelas começa em toda a abertura e amplia ângulo, distância e visibilidade gradualmente com a aproximação. Somente janelas cadastradas a partir da arte produzem essa visão; paredes externas também bloqueiam seus raios. A máscara interna acompanha o alpha do interior.

As oito cartas prismáticas receberam ilustrações mais sóbrias e nítidas, sem a névoa colorida permanente. Reflexos animados e dependentes do giro ficam no material da carta. As versões de O Corvo não têm penas soltas nem o galho desconectado. A funcionalidade Gravar tela foi retirada da aplicação.

Artes geradas exclusivamente pelo imagegen embutido. PNGs nativos ficam em data/vtt/home-furniture-20261014, data/vtt/home-furniture-refined-20261014 e data/vtt/empty-houses-20261014. WebPs públicos correspondentes ficam em public/vtt. O manifesto data/vtt/home-assets-manifest-20261014.json registra prompts, referências, caminhos e hashes dos 125 assets ativos. As cartas e a folha de porta têm os prompts e originais preservados em data/cards e data/vtt.

Validação: 71 testes de geometria e regressão, TypeScript, builds, 50 máscaras/telhados nativos, material animado das cartas e interface real em bancos UUID descartáveis. Nenhuma migration ou transformação de mapas salvos foi necessária. Protocolo VTT 17; publicação Docker incremental conserva mídias antigas e alterações independentes.
