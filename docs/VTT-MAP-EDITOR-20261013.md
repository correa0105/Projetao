# Edição e navegação do mapa — 13/10/2026

O arrasto com o botão esquerdo funciona no espaço vazio, fora do mapa e sobre imagens de fundo travadas. O botão do meio ou Espaço + arrasto navega durante qualquer ferramenta. O editor de transparência encaminha esses gestos à mesma câmera; o espaço vazio também permite arrastar e a roda mantém o zoom. Soltar o botão, perder a captura ou sair da janela encerra a navegação.

O botão direito abre o menu de PV, CA, deslocamento, condições e ficha do personagem. O esquerdo seleciona e movimenta. As condições do painel e do menu usam o mesmo estado e a mesma gravação; jogadores conservam a restrição existente para remover condições. A ficha tem sua própria linha, afastada das condições. O campo “Cor da borda” foi removido.

Itens selecionados têm alças nos quatro cantos e nas bordas, ajustadas ao giro e ao zoom. Cantos preservam a proporção; Shift permite alterá-la. Bordas modificam apenas um eixo. O ponto oposto permanece fixo, o objeto não salta ao segurar, Escape cancela e cada gesto confirmado cria uma única etapa de desfazer. Tokens travados e a visão de jogador não oferecem essas alças.

Cada asset mantém uma medida natural em quadrados, com um personagem Médio como referência de um quadrado. As oito pedras pequenas medem 0,2–0,45 quadrado; rochas grandes e aglomerados têm dimensões próprias. Selecionar outro asset reinicia o multiplicador, e arrastar um asset diferente não herda uma escala anterior.

## Brush do mapa

O botão de pincel na barra esquerda abre seis texturas originais: grama, terra, areia, pedra, madeira e neve. Há formatos redondo, quadrado e irregular, raio, suavidade, opacidade e escala da textura. Até oito camadas podem ser nomeadas, ocultadas, reordenadas e ter sua opacidade alterada. A borracha limpa somente a camada ativa. Desfazer recupera tanto traços quanto alterações das camadas.

A pintura vive no documento da mesa no PostgreSQL. Somente o mestre administrador pode gravar o mapa. Rascunhos históricos que omitem pintura ou camadas preservam os valores já salvos; o protocolo 13 pede recarga dos clientes antigos. Não há migration nesta entrega. O renderer usa buffers limitados ao viewport, texturas ancoradas ao mundo e cache independente do movimento dos personagens.

## Transparência e ventos

Áreas podem detectar um item automaticamente ou selecionar explicitamente o objeto. O polígono é salvo em coordenadas locais e acompanha movimento, escala, espelho e giro. O renderer remove somente a parte selecionada do item antes de desenhar personagens e recompõe sua imagem acima deles na opacidade configurada. A silhueta alfa original é preservada, sem preenchimento escuro ou recorte sobre o chão. Áreas sobre o mapa de fundo conservam o fundo e o recompõem sobre personagens; o editor mostra os pontos apenas enquanto aberto. Árvores continuam com transparência automática de 35%, com seleção parcial disponível como alternativa. O painel foi ampliado e seus controles se reorganizam em telas estreitas.

“Vento” reutiliza diretamente o renderer do asset Vento da referência, com a mesma névoa, folhas, material e transparência, distribuído por toda a vista do mapa. “Ventania” mantém essa arte com correntes mais largas, rápidas e rajadas variáveis. Intensidade, velocidade, direção e movimento reduzido continuam disponíveis.

## Verificação

`tests/vtt-map-editor.test.ts` verifica alças giradas, ponto fixo, proporção, limites, vínculo local dos recortes, compatibilidade de camadas, escala natural das pedras e continuidade das rajadas. Os testes existentes de clima e áreas também são executados.

`scripts/test-vtt-map-editor-isolated.mjs` cria e remove um banco PostgreSQL descartável. A interface real verifica navegação em quatro situações, pintura/borracha/camadas, persistência após recarga, permissões, condições nos dois menus, redimensionamento/desfazer/refazer/cancelamento, recortes vinculados e painel em 1440, 390 e 320 px. O renderer é conferido por pixels para ordem das imagens, alfa do PNG, ausência da mancha escura, borracha por camada e opacidade. As duas opções de vento são gravadas pela interface e testadas em todos os quadrantes da tela. TypeScript e builds de cliente/servidor completam a validação.

A publicação incremental conserva mídias, dados, volumes, arte dos jogadores e ilustrador. As alterações independentes de monstros, cenário e armaduras permanecem fora desta entrega.
