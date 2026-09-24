# Alvorada Cinzenta — identidade e direção visual

Guilda: Alvorada Cinzenta. Sede: Bastião da Alvorada, em Vigília. Região: Domínios da Alvorada.

## Direção visual

Tema exclusivamente escuro, azul de noite, cinza de pedra, marfim e cobre envelhecido. Nome escrito, sem brasão; favicon AC. Libre Baskerville 700 para o nome na apresentação (menor e mais robusto), Inter 700 para Iniciar aventura, Marcellus para título do login, Cinzel para títulos internos e DM Sans para interface. Não reintroduzir modo claro. Verde-musgo dessaturado somente na paisagem.

## Apresentação

Referência: captura do mapa de Runeterra enviada pelo usuário. Composição ampla, título central forte e botão destacado abaixo. Arte original, sem copiar geografia ou assets da Riot. Até três grandes massas de terra, montanhas com relevo, neve ao norte, florestas musgo e regiões áridas, mar azul escuro.

Texto: Explore o desconhecido; Alvorada Cinzenta; Iniciar aventura. Sem slogans, rótulos nos cantos, rodapé ou seta no botão. Hover de cor/brilho, sem movimento e sem alternância abrupta entre gradiente e cor. Névoa periférica mais branca, com movimento coordenado para a direita; pausa e movimento reduzido preservados.

- public/alvorada-map-v2.png: mapa ativo, gerado com imagegen integrada. Prompt e dimensões reais em ALVORADA-MAPA-V2-PROMPT.md. Sem zoom animado; nuvens continuam em movimento.
- public/alvorada-fog.svg: névoa procedural animada.
- public/alvorada-dawn-banner.png: banner ativo do Início, com vale/fortaleza sem neve e amanhecer cinzento. Prompt em ALVORADA-BANNER-PROMPT.md. A arte anterior alvorada-bastion.png foi preservada.
- public/alvorada-contours.svg: curvas cartográficas.
- src/alvorada.css: identidade dos componentes do jogo.
- src/journey.css: apresentação, autenticação e navegação flutuante.
- public/alvorada-map.png, alvorada-map-previous.png, alvorada-archipelago-previous.png e islands-map.png: versões/referência preservadas, não usadas na entrada atual.

Moldura fina com quinas iluminadas; controle de pausa junto à margem inferior. Login minimalista, uma única borda e mesmas texturas dock-grain/dock-waves do menu. Clicar fora ou Escape fecha o formulário; não reintroduzir slogans, marca repetida ou botão Voltar.

Passagem para o login em duas etapas: apresentação dissolve e painel surge com movimento curto, escala e nitidez progressiva. Saída também animada. Névoa permanece em movimento no login; pausa manual e movimento reduzido respeitados. Desfoque do fundo gradual, sem troca abrupta.

## Navegação

Mundo é a visão geral com **relevo cartográfico navegável**, preenchendo toda a tela, sem moldura ou barras reservadas. A entrega anterior com PNG plano foi rejeitada. Preservar a silhueta enviada pelo usuário (`docs/references/world-silhouette.png`): disposição, contornos, estreitos, mares interiores, gelo ao norte e formação circular no sudoeste. Não voltar a três ilhas ovais. Cordilheiras e planaltos amplos, fora de escala literal, devem lembrar a leitura do atlas de Runeterra, com biomas representativos, musgo dessaturado, pedra, neve clara, areia discreta e mar azul-noite. Relevo é geometria com iluminação; nuvens são uma camada independente em movimento. A arte V2 fornece apenas máscara costeira e biomas. Câmera inicial em 100% (antigo enquadramento de 142%), com composição deslocada mais 8% da altura da tela para baixo; arraste e zoom permitem aproximar os territórios. Os marcadores dos 22 territórios mantêm seu desenho aprovado, projetados sobre o terreno. Implementação em [ATLAS-WORLD-RELIEF.md](ATLAS-WORLD-RELIEF.md).

O usuário aprovou a modelagem mundial com nove cordilheiras e costa suavizada: manter seus contornos. Refino posterior pede pedra cinza mais neutra, musgo um pouco mais escuro, detalhes fotográficos discretos de solo/rocha e ondulações muito leves nas planícies. Nuvens ligeiramente mais densas e 25% mais rápidas. A visão inicial e mínimo usam 100%, com frustum recalibrado para o antigo 142%. Bordas de arraste devem ter resistência elástica e retorno suave para dentro, preservando o oceano contínuo.

Reino do Norte abre a **visão do reino em 2D**, conforme a mudança explícita de 23/09/2026. A inspiração em Don't Starve vale para a câmera inclinada e a leitura de objetos ilustrados que permanecem em pé, com oito vistas e giro de 45°; a arte é própria, medieval, com contornos expressivos, sombras desenhadas, musgo, pedra, madeira e detalhes mágicos discretos. Chão, trilhas, estradas, pontes e rios pertencem à imagem-base. Árvores, rochas, construções clicáveis e totens são objetos separados, ordenados por profundidade. A decisão anterior por geometria regional 3D foi revogada; o Mundo mantém seu relevo Three.js. Implementação vigente em [KINGDOM-2D.md](KINGDOM-2D.md).

A visão regional usa Canvas 2D como caminho principal, sem depender de WebGL. `public/atlas-north.png` e `public/atlas-world.png` são históricos; seus prompts permanecem em [ATLAS-PROMPTS.md](ATLAS-PROMPTS.md). Usar Mundo, visão do reino e Voltar ao mundo como vocabulário de navegação. Paleta e menu principal permanecem; painel de missões sai pela direita e, no celular, ocupa a parte inferior com lista rolável. A apresentação/login continuam com seus próprios ativos, sem trocar `alvorada-map-v2.png` pela arte do Mundo.

No Mundo, não exibir orientação de escolher território, inclusive no cabeçalho; o usuário pediu sua remoção. Sem título Mundo duplicado no cenário e sem legenda visível de arraste no rodapé. Deixar oceano atrás do cabeçalho e margem antes das terras no enquadramento inicial. Nuvens maiores, mais espalhadas e com formas amplas; evitar fileiras de pequenos bancos concentrados.

Cabeçalho em painel escuro com a textura do menu e uma borda: somente nome da guilda, página atual, seletor de personagem e Sair. Sem avatar/inicial, escudo no seletor ou edição das regras. Sem rodapé com slogan e sem PRIMEIRA ERA: não havia sistema de eras por trás desse texto. Manter as atribuições reais na Biblioteca/Regras.

Manter painel compacto, círculos centralizados verticalmente, ícones a 72%, efeito de luz acompanhando o mouse, granulado e ondas irregulares discretas. Acionador Menu se transforma no painel, sem X ou setas. Acionador Menu restaurado para 108 × 34,2 px. Painel aberto até 456 × 106 px no desktop e 196 × 152 px no celular em grade 3 × 2. Botões levemente menores (até 62 px desktop, 44–50 px celular), espaços mais reduzidos: gap de 10/8 px, padding lateral de 16/14 px, folga vertical de 21 px. Dimensões calculadas pelo conteúdo; não usar space-between para ampliar os intervalos.

Ícones ilustrados em public/guild-icons-candle-helmet.png: vela em Início, capacete em Personagem, espada em Aventura, bolsa em Loja, mapa em Explorar e livro em Biblioteca. Transparência em SVG via filtro alfa específico, sem máscara circular. Prompts históricos das ilustrações em ICONES-PROMPT.md e VELA-CAPACETE-PROMPT.md.

Legenda única central acima do painel, com as pontas laterais centrais exatamente no topo externo da borda do menu (top -1px e translateY(-50%)), plaqueta reduzida em aproximadamente 20%, texto DM Sans 9 px e espaçamento compacto (6 × 14 px, largura mínima de 108 px). Plaqueta escura opaca com pontas chanfradas, contorno fino de cobre e sombra discreta, entrada curta sem desfoque. O usuário rejeitou a névoa: dock-caption-fog.svg está preservado somente como histórico. Sem placas individuais sobre cada botão ou texto em arco. A névoa da apresentação continua independente.

Submenus em balões de até 198 px próximos ao botão acionador, com ponta, animação de pop, margem lateral mínima de 16 px e rolagem se necessário. Não aumentar o painel nem centralizar todos os balões sobre ele. Mais detalhes de comportamento e tamanhos em CONTEXTO.md.

Refino visual: nuvens mundiais levemente mais transparentes (alpha máximo 0,51), mantendo tamanho, distribuição e movimento.

### Acabamento mundial vigente — 17/09/2026

Base de câmera reduzida pelo fator 1,42: 100% mantém o enquadramento aprovado; limite máximo 3,5/1,42 preserva a aproximação física anterior. Verde e ocre mais vivos, montanhas cinza neutro, fotografias CC0 de solo/rocha em duas escalas com contraste e relevo de superfície reforçados. Nuvens deslocam-se cerca de 75% mais rápido e deformam-se continuamente; a espiral da tormenta gira mais rapidamente, com ruído também em rotação. Movimento reduzido continua respeitado. Fulkushima usa uma única malha contínua de cratera, encostas, baixadas e costa irregular (raio 2,9), com nove rochedos/ilhotas adjacentes, textura fotográfica e lava rebaixada dentro da cratera; área clicável acompanha a ilha ampliada, sem contorno circular. Build Docker/TypeScript e teste mundial desktop/celular aprovados; sem mudanças de SQL ou regras.
