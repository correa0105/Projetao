# Brush, efeitos e contexto dos personagens — 13/10/2026

## Desempenho do VTT

O renderer anterior reconstruía e desfocava todos os traços quando a câmera ou o pincel mudavam. O novo renderer guarda blocos de 512 px no espaço do mapa, mantém a textura na resolução da tela e invalida somente os blocos afetados. A pintura em andamento reutiliza as camadas anteriores e posteriores. Borracha, opacidade, ordenação, desfazer e camadas ocultas continuam funcionando. O cache tem limites de 96 MiB para blocos e 24 MiB para máscaras, e desaparece junto com o canvas.

A suavidade usa um filtro separável de três caixas, com máscaras reutilizáveis. Eventos do pincel são agrupados por frame, preservando os pontos do traço. As dimensões do canvas só são alteradas quando a tela realmente muda de tamanho.

Máscaras de iluminação, visão e névoa são reutilizadas enquanto sua geometria não muda. Alterar posição, cor da luz, paredes, câmera, visão ou escala invalida a máscara. Sprites fora da tela não são desenhados; suas fontes de luz e visão continuam participando da cena. As superfícies de cor dos efeitos também são reaproveitadas por tamanho, sem reduzir resolução nem partículas.

## Perfis, guildas e cartas

- Entrada de perfil público abre o acampamento do personagem. Clicar no avatar/nome do viajante abre o perfil da conta. Navegação por hash recarrega o contexto, inclusive quando o usuário permanece o mesmo.
- Capas dos cards das Crônicas usam o mesmo quadro 16:9, mantendo a preferência de preenchimento de cada imagem.
- A guilda usa o personagem selecionado. Outro personagem da mesma conta é visitante, não recebe funções de proprietário nem progresso de missão como membro. O diretório e o perfil da conta identificam o personagem efetivamente inscrito. A política existente de uma inscrição por conta permanece; não há alteração de membros ou migration.
- Salão das Cartas tem uma bancada compacta, quatro cartas por linha, três espaços de equipamento e detalhes abaixo do acervo. Compra/equipamento precedem a história opcional. Uma única rolagem substitui os painéis estreitos com rolagens independentes. Respostas antigas de outro personagem são descartadas.

## Validação

- Benchmark do brush no Edge: 120 traços, 9.600 pontos, viewport 1280×800 e DPR 2. Depois de aquecer o cache, pintura passou de 1.288,7 para 4,3 ms por frame, navegação de 1.259,4 para 0,55 ms. O primeiro preenchimento do cache continua necessário: 802,8 ms neste cenário, frente a 627,9 ms antes. Essas medidas são locais, não uma garantia para qualquer mapa/hardware.
- Benchmark de efeitos/iluminação e comparação de pixels em superfícies separadas das medições, para evitar a mudança automática do Chromium de rasterização GPU para CPU após leituras. Luz, paredes, visão de jogador, névoa e fogo nativo preservam o resultado; diferenças máximas de um canal em dois pixels na alternância de zoom.
- Testes de suavidade, editor/canopies/atmosfera; testes de guildas com banco descartável, incluindo economia, replay, limite de oito, propriedade, duas personagens da mesma conta, missões e privacidade.
- QA de navegador no editor real, permissões, pintura/camadas/borracha, navegação, transparência, redimensionamento, condições, perfis, capas, troca de personagem na guilda e compra/equipamento de cartas em quatro larguras.

Publicação incremental exige aplicação saudável, preservação dos arquivos públicos anteriores, comparação somente leitura das tabelas e ilustrador disponível. Trabalhos independentes do acervo permanecem fora do release.
