# VTT — Vista superior, animais e comércios

Entrega de 15/10/2026.

## Biblioteca

Em **Biblioteca → Assets → Comércios** há 40 locais mobiliados. Cada modelo tem telhado e interior independentes; entrar com o personagem ativo revela o interior. As dimensões abaixo estão em quadrados de 1,5 m do grid. A escala pode ser ajustada na prévia.

| Local | Dimensões |
| --- | --- |
| Ferraria | 9 × 9 |
| Taverna | 14 × 10 |
| Boticário | 8 × 7 |
| Biblioteca | 14 × 12 |
| Padaria | 9 × 7 |
| Açougue | 9 × 7 |
| Peixaria | 8 × 7 |
| Hortifrúti | 9 × 8 |
| Mercearia | 10 × 9 |
| Alfaiataria | 9 × 9 |
| Sapataria | 8 × 7 |
| Marcenaria | 12 × 10 |
| Oficina de carroças | 14 × 12 |
| Olaria | 10 × 9 |
| Vidraçaria | 10 × 9 |
| Joalheria | 8 × 7 |
| Relojoaria | 7 × 7 |
| Livraria | 9 × 8 |
| Papelaria | 7 × 7 |
| Casa de mapas | 9 × 9 |
| Templo | 12 × 14 |
| Clínica | 10 × 10 |
| Estalagem | 16 × 12 |
| Estábulo | 16 × 10 |
| Casa de banhos | 14 × 10 |
| Tinturaria | 10 × 9 |
| Curtume | 12 × 10 |
| Loja de velas | 8 × 7 |
| Perfumaria | 7 × 7 |
| Oficina arcana | 10 × 10 |
| Floricultura | 9 × 9 |
| Celeiro mercantil | 12 × 10 |
| Moinho de grãos | 12 × 12 |
| Vinícola | 12 × 10 |
| Cervejaria | 14 × 10 |
| Casa de leilões | 14 × 12 |
| Casa de penhores | 9 × 8 |
| Casa de câmbio | 10 × 9 |
| Correio | 8 × 7 |
| Casa dos mercadores | 16 × 12 |

Em **Biblioteca → Assets → Animais** há 40 tokens de corpo inteiro, vistos verticalmente de cima. Eles podem ser movidos, girados e atribuídos a um jogador como os demais tokens. Animais sem controle ativo não revelam telhados.

Cavalo, Cavalo com sela, Gato, Cachorro, Alce, Cervo, Corça, Javali, Porco, Vaca, Touro, Cabra, Ovelha, Burro, Mula de carga, Pônei, Lobo, Raposa, Urso-pardo, Urso-polar, Texugo, Guaxinim, Coelho, Elefante, Esquilo, Ouriço, Rato, Lontra, Castor, Ganso, Pato, Galinha, Galo, Peru, Pavão, Coruja, Águia, Falcão, Corvo, Jacaré.

## Perspectiva e compatibilidade

As casas, suas versões vazias, 100 peças de mobília, 25 peças de jardinagem, 25 peças de mercadores e 25 moradores usam novas artes em câmera ortográfica vertical. As cenas antigas mantêm os IDs, URLs lógicas, posições, rotações, tamanhos e permissões já salvos. O carregador resolve as artes para a pasta versionada de 15/10. Os arquivos anteriores são preservados.

Portas são folhas estreitas no plano horizontal da parede. A abertura gira em torno da dobradiça e respeita a passagem física. A renderização não depende da distância do personagem. O telhado só se torna translúcido quando o corpo ou um quadrado ocupado do personagem o intercepta, e desaparece ao entrar.

As janelas são aberturas reais dos modelos, com campo de visão gradual pela proximidade. Paredes sem janela não concedem esse campo. Os ícones de portas de outras casas ficam ocultos na visão interna.

O protocolo VTT é 19; abas antigas recebem a instrução para recarregar. Nenhuma migration ou alteração dos dados de mesas é necessária.

## Artes e rastreabilidade

- Prompts: [overhead-prompts-20261015.json](../data/vtt/overhead-prompts-20261015.json).
- PNGs nativos: `data/vtt/overhead-20261015/`.
- WebPs transparentes: `public/vtt/overhead-20261015/`.
- Miniaturas de até 224 px: `public/vtt/overhead-thumbs-20261015/`.
- Mapa de compatibilidade: [vtt-asset-visuals.json](../shared/vtt-asset-visuals.json).
- Geração: ferramenta integrada ImageGen, uma chamada por arte. WebP e miniatura derivam do PNG nativo, conservado.

## Validação

Verificadas as 371 artes, com PNG nativo preservado, transparência real, hashes, unicidade, proporções e miniaturas de até 224 px. Os 25 interiores vazios também conservam a referência do interior mobiliado correspondente. Todos os lotes passaram por revisão visual.

Passaram 114 testes de geometria, catálogo e compatibilidade, 90 verificações nativas de casas/comércios sem vazamento de visão, 75 assets de moradores/jardinagem/mercadores e oito cenários de mobília e portas, incluindo abertura distante do personagem. O navegador real verificou biblioteca, imagens, arrastar, escala, giro, movimento da câmera, permissões do servidor, obstrução das portas, entrada/saída dos 90 modelos e larguras de 1440/768/390 px. TypeScript e os builds de cliente e servidor passaram.

Relatórios em `test-results/overhead/`, `test-results/house-vision/`, `test-results/village-renderer/`, `test-results/home-renderer/` e `test-results/vtt-nature/`. Os registros permanentes de origem e hashes ficam em `data/vtt/overhead-completed-20261015/`.
