# Visão do reino — cenário 3D procedural

**Documento histórico.** Em 23/09/2026, o usuário substituiu a cena regional 3D por um cenário Canvas 2D com sprites de oito orientações, descrito em [KINGDOM-2D.md](KINGDOM-2D.md). Os arquivos e comportamentos regionais citados abaixo pertencem à versão anterior, não devem ser restaurados. O Mundo mantém seu relevo Three.js em [ATLAS-WORLD-RELIEF.md](ATLAS-WORLD-RELIEF.md).

Este documento descreve a **visão do reino**, que mantém geometria verdadeiramente tridimensional. A visão geral **Mundo** também possui relevo navegável, em um módulo separado: [ATLAS-WORLD-RELIEF.md](ATLAS-WORLD-RELIEF.md). A entrega mundial plana V2 foi rejeitada. O retorno da região é identificado como Voltar ao mundo.

Na visão do reino, a pintura sobre uma malha continua substituída por geometria gerada em código, com limites que evitam a borda vazia apontada anteriormente. Referências visuais: [Overworld Audio](https://overworldaudio.com/) e [Runeterra](https://map.leagueoflegends.com/). Nenhum modelo, textura ou código desses sites foi incorporado.

## Responsabilidades

- `src/atlas-terrain.ts`: terreno, montanhas, florestas, construções, caminhos e água. `createAtlasTerrain(mode, onUpdate)` retorna `group`, `heightAt(u,v)`, `ready` e `dispose()`; a geografia não depende de pixels de imagens. Objetos repetidos usam instâncias para reduzir chamadas de renderização.
- `src/atlas-materials.ts`: materiais PBR com texturas de pequenas superfícies fotográficas de solo e rocha. Projeção triplanar evita esticar a textura em encostas e dispensa UV nas instâncias. Inclinação/altitude misturam solo, rocha e neve; normal maps e rugosidade respondem à iluminação. As fotografias não substituem a geometria por uma pintura de mapa.
- `src/AtlasScene.tsx`: renderer WebGL da visão do reino, carregado de forma lazy ao entrar na região; iluminação, sombras, câmera, transições, marcadores e fallback regional 2D. A câmera observa um plano XY com altura no eixo Z. As posições do banco são normalizadas: X=(u−0,5)×24 e Y=(0,5−v)×15.
- `src/atlas-atmosphere.ts`: névoa regional em espaço 3D, compartilhada entre materiais e marcadores. Ruído volumétrico determinístico, sem imagens de nuvens nem recursos dos sites de referência.
- `src/WorldAtlas.tsx`: seleção dos territórios/locais e painel de missões. O formulário, endpoints e tabelas SQL permanecem os mesmos do mural.
- `src/WorldMap.tsx`, `src/world-relief.ts`, `src/world-clouds.ts` e `src/world-map.css`: câmera, relevo e atmosfera mundiais, separados da cena regional. `public/atlas-world-v2.png` fornece máscara costeira e biomas, sem ser aplicado como pintura no terreno. Entrar no Reino do Norte carrega `AtlasScene`.

Na região, montanhas combinam picos assimétricos, contrafortes e vales escavados pelos rios; planícies conservam espaço entre as cadeias. Copas, ramos, pedras, casas, castelo, ponte e porto continuam sendo geometria. O acabamento de alvenaria é separado das pedras naturais; telhas e veios de madeira acrescentam detalhes aos edifícios sem novas texturas externas. Os antigos contornos 3D mundiais não definem a geografia da nova ilustração: ela segue a silhueta fornecida pelo usuário.

## Câmera e bordas

Mundo usa câmera ortográfica inclinada, pan e zoom, preenchendo a tela; as especificações atuais ficam no documento próprio. A câmera antiga a 53° e o enquadramento inteiro obrigatório do PNG V2 são históricos.

O Reino do Norte usa **câmera em perspectiva**, FOV vertical de 45°, próxima do terreno. O pedido de aproximadamente 80° foi interpretado como inclinação a partir da vertical: elevação nominal de **10° acima do solo**, corrigida quando necessário para evitar que a câmera atravesse encostas. O alvo acompanha a altura do terreno suavemente e inicia em Vigília. A largura de referência é 4,6 unidades (4 em telas estreitas), para que os locais vizinhos fiquem aproximadamente a uma tela de deslocamento; as cinco coordenadas SQL foram preservadas. A perspectiva e o relevo variam a distância aparente, portanto não há distância fixa em pixels entre cidades.

Scroll e botões fazem dolly real, com zoom de 0,75 a 1,8. Arrastar desloca a câmera; levar o cursor às bordas também percorre a região. Sair do canvas, desfocar a janela ou ocultar a página interrompe esse movimento. Os controles de giro cobrem ±180°. O alvo permanece entre X ±10,8 e Y ±6,6; centralizar retorna a Vigília. Toque permite arrastar e os botões mantêm zoom/giro acessíveis.

O oceano se estende muito além da área navegável. O terreno tem contornos próprios e continuidade para fora do enquadramento útil; não há um retângulo de imagem terminando no fundo cinza. Névoa de profundidade e nuvens periféricas suavizam a distância. Nenhuma dessas camadas intercepta cliques nos marcadores.

Na região, a névoa azul-acinzentada clareia ao redor do foco da câmera e encobre o terreno distante; ao navegar, a área revelada acompanha o movimento. O raio acompanha o zoom e a opacidade dos marcadores usa a mesma fórmula do shader. Locais ocultos não recebem cliques; continuam alcançáveis por teclado, cujo foco desloca a câmera até eles. A névoa é atmosférica, sem salvar descobertas por jogador no banco. Ruído e altura suavizam a transição; todos os materiais, inclusive árvores e construções, recebem o efeito.

## Desempenho e recuperação

O módulo da cena regional e suas texturas PBR são carregados ao entrar na visão do reino. Mundo tem seu próprio renderer WebGL e materiais procedurais. Na região: sombras estáticas, resolução de renderização limitada e frames sob demanda durante movimentos/interações. Movimento reduzido torna transições imediatas. Geometrias, materiais, texturas, shadow map, renderer, observadores e listeners são liberados ao sair. O carregamento aguarda as texturas antes de habilitar os marcadores; uma textura indisponível conserva material neutro e não bloqueia as missões.

Os nove JPGs em `public/atlas-materials/` são mapas de cor sRGB, normal OpenGL e rugosidade linear, 1024 × 1024, aproximadamente 7,05 MB no total. Servidos pelo próprio app, sem dependência de CDN durante o jogo. Origem, licença CC0, autores e checksums em [ATLAS-MATERIALS.md](ATLAS-MATERIALS.md) e no manifesto ao lado dos arquivos.

Se o navegador perder ou não conseguir criar um contexto WebGL na visão do reino, mostra **Mapa em 2D** e usa `public/atlas-north.png`; essa imagem não é solicitada no fluxo WebGL normal da região. A alternativa mantém navegação e missões. Mundo possui tratamento próprio para falha de WebGL, sem apresentar PNG plano como se fosse relevo. `public/atlas-world.png` permanece somente como histórico.

## Ferramentas de validação

O teste focado `--world-map-only` valida o relevo mundial, preenchimento da tela, pan/zoom, marcadores, entrada na região e retorno. Não se deve reutilizar as antigas asserções de PNG inteiro/ausência de WebGL. Os resultados registrados mais abaixo são de revisões anteriores.

`npm run test:atlas` é o teste dedicado ao fluxo SQL compartilhado com mural, navegação geográfica, desktop/celular e fallback regional. Na visão do reino, verificar integridade/respostas das nove texturas, câmera, limites, zoom, giro/reset e ausência de pintura de mapa no WebGL. O carregamento da V2 no Mundo fornece dados para máscara/biomas, não uma pintura aplicada ao material. Capturas dos extremos em `test-results/atlas-*-pan-*.png` e `atlas-*-yaw-*.png` permitem verificar visualmente a ausência de bordas vazias; o cálculo dos limites não é prova suficiente dessa aparência. Diagnóstico de câmera em `test-results/atlas-camera.json`.

`npm run test:atlas -- --visual-only` verifica materiais e câmeras, produz capturas mundial/regional, detalhe e giro, em desktop e celular, sem publicar missões. Utiliza uma conta temporária própria, removida ao terminar. Saída: `test-results/atlas-realism-*.png`.

`npm run test:atlas -- --navigation-only` confere a perspectiva regional, dolly pelo scroll sem rolar a página, navegação por bordas, revelação de cidades por gestos e teclado, painel/formulário e navegação em celular. Não publica missões.

`npm run test:atlas -- --regional-edges-only` isola os quatro extremos da nova câmera regional no desktop, usando gestos até a saturação e capturas para conferir a transição entre terreno, mar e névoa.

`npm run test:atlas -- --skip-camera-matrix` mantém missões, persistência, cache/texturas, celular e fallback, omitindo apenas a sequência extensa de gestos nos limites. Use para correções de acabamento posteriores a uma matriz já conferida; o comando padrão continua executando todos os gestos. Uma resposta HTTP 304 só é aceita para uma textura cujos bytes e checksum já foram verificados naquela página.

O cenário é uma geografia de fantasia estilizada, não um levantamento geográfico nem uma simulação física. Os detalhes podem ser ampliados sem mudar as relações de missões no PostgreSQL.

## Histórico anterior ao Mundo ilustrado V2

A primeira versão procedural de 17/09/2026 passou pelo smoke completo, mas o usuário rejeitou o acabamento plano e os continentes arredondados. A revisão seguinte acrescentou geografia recortada, normais suaves e materiais de superfície fotográficos; não reutilizar medições da versão anterior como se fossem da cena atual.

Validação da revisão de acabamento: build/TypeScript aprovados. Matriz de câmera completa em desktop/toque executada e capturas dos extremos revisadas. O assert agregado da primeira rodada rejeitou nove respostas 304 legítimas; após corrigir o watcher, o fluxo de texturas/cache, missões, SQL, XP, persistência, celular e fallback passou com `--skip-camera-matrix`. Não houve erro inesperado de shader/JavaScript nem contas temporárias restantes. O último ajuste de altura da água e caminhos sobre os triângulos do terreno recebeu build e conferência visual no navegador.

Revisão posterior de navegação próxima: `--navigation-only` aprovado em desktop e 390 px; build Docker/TypeScript aprovado e acabamento conferido no navegador. No build final, `--skip-camera-matrix` validou novamente cadastro no mapa/mural, persistência, conclusão/XP, histórico, celular e fallback 2D. A espera da transição no teste foi alinhada ao limite de 30 segundos do carregamento, após uma expiração no renderizador de software que já mostrava a região correta na captura de falha. Nenhum erro inesperado de JavaScript/shader no fluxo final.

Os quatro extremos regionais também passaram com `--regional-edges-only`: saturação em X ±10,8 / Y ±6,6, câmera e pinos imóveis após gesto adicional e capturas revisadas sem fim de plano ou faixa cinza vazia. Relatório em `test-results/atlas-regional-camera-edges.json`. Contas temporárias removidas ao final.
