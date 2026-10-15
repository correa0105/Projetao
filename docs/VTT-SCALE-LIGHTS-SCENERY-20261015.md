# VTT — escala, iluminação, vínculos e terrenos — 15/10/2026

## Terrenos

Biblioteca → Brush do mapa: 18 texturas, incluindo terra batida, lama, cascalho, folhas secas, musgo, grama seca, paralelepípedos, terracota, mármore e madeira escura. Mantém raio, suavidade, opacidade, tamanho, camadas, borracha e desfazer. As oito texturas anteriores conservam seus IDs e arquivos. Os dez materiais novos usam originais PNG opacos e WebP com miniaturas leves; prompts e hashes em [manifest.json](../data/vtt/terrain-expansion-20261015/manifest.json). Ferramenta: ImageGen integrada.

## Chão após recarregar

Cada pincelada inicia seu salvamento ao terminar o traço. Os traços salvos continuam no documento da mesa. Imagens com falha de rede agora recebem novas tentativas, e o VTT tenta novamente ao recuperar a conexão. A textura que falhou deixa de bloquear permanentemente o chão. Materiais usados na pintura carregam antes dos demais assets. O teste de F5 simula uma resposta 503 inicial e verifica a recuperação visual sem repintar nem apagar traços.

## Cenário como token

O mestre abre o menu de botão direito da peça → Configurações do token. “Transformar cenário em token” move somente a instância colocada para Tokens, sem barra de vida, ficha ou combate. O catálogo continua sendo cenário. A conversão permanece ao desvincular e ao reabrir a mesa, até apagar a peça.

“Vincular cenário a um token” converte a peça automaticamente e mantém sua posição relativa ao apoio. Assim a carroça acompanha deslocamento e rotação do cavalo sem saltar para o centro dele. Somente o mestre cria ou remove esses vínculos, validado também no servidor. Um jogador que controle o cavalo pode movê-lo e levar a carroça já ligada pelo mestre. Vínculos de cavaleiros existentes continuam funcionando. Ciclos e travessias de paredes permanecem bloqueados.

## Escala física

Referência: token humano base de 1 quadrado; 1 quadrado representa 1,5 m para dimensionar o catálogo. 150 objetos soltos têm dimensões físicas explícitas em [vtt-object-dimensions.json](../shared/vtt-object-dimensions.json). Camas: solteiro 0,95 × 2,10 m; casal 1,60 × 2,10 m. As duas têm o mesmo comprimento. A renderização ignora margens transparentes de apresentação e conserva a arte sem deformar objetos.

65 interiores (25 casas e 40 comércios) foram revisados na mesma referência humana, em câmera vertical. Escalas de casas e identidades anteriores são preservadas; aliases visuais atualizam as artes em cenas salvas. Móveis soltos que conservavam exatamente o tamanho padrão anterior são calibrados uma única vez. Tamanhos personalizados são preservados, assim como posições, IDs e rotações. Casas vazias continuam disponíveis. A passagem central do estábulo ficou livre do poste.

Os PNG nativos ficam em data/vtt/human-scale-20261015; WebP e miniaturas em public/vtt/human-scale-20261015 e public/vtt/human-scale-thumbs-20261015. Prompts e registros em data/vtt/overhead-prompts-20261015.json e data/vtt/overhead-completed-20261015. Ferramenta: ImageGen integrada.

## Portas e luz

Folhas de portas são desenhadas abaixo do telhado: telhado opaco cobre a porta; a porta aparece no interior ou com o beiral transparente, respeitando giro e espelhamento.

Camadas → Iluminação e barreiras → Fonte de luz abre as luzes prontas. Tocha já vem com 20 ft fortes e 20 ft fracos, tom quente e oscilação. Outros presets: fogueira, vela, lanterna, braseiro e luz arcana. Distâncias são convertidas quando a mesa usa metros. Fontes já colocadas aceitam aplicar preset e editar animação. Velocidade ajustável de 0,25× a 3×. Movimento reduzido e efeitos desligados congelam a animação; luz e cor continuam respeitando paredes e alcance.

## Validação

128 testes de VTT e dois testes de recuperação de imagens cobrem dimensões, calibração única, tamanhos personalizados, presets, animações, vínculos, rotação, ciclos e persistência das 18 texturas. Verificações em canvas nativo cobrem 32 combinações de telhados, 90 casas, iluminação animada sem vazamento, movimento reduzido e pintura dos 18 materiais. O smoke de navegador usa banco descartável e verifica controles, salvamento, permissões e os 90 pares de telhado/interior. Protocolo VTT 20: abas antigas precisam recarregar.

## Guilda

Na aba Sede, a imagem da sala vem antes do cabeçalho e do painel de informações, ações e navegação. A frase “Um brasão. Oito histórias. Um lar.” foi removida. Editar, trocar salas e salvar decoração continuam disponíveis abaixo da sede.
