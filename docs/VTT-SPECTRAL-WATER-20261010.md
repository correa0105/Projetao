# Correções de água, vento e espectros — 10/10/2026

Aplicadas no renderer compartilhado da mesa e da galeria.

- **Gêiser de água:** removidos os três jatos ilustrados rígidos e as gotas sobrepostas. A superfície animada anterior permanece exatamente igual, inclusive escala, cor, velocidade e opacidade. O primeiro plano desse efeito fica vazio. Onda de maré conserva todas as suas camadas.
- **Rastro espectral:** ecos do personagem e névoa saem em Y local negativo, atrás do personagem. A transformação existente continua fornecendo giro e espelhamento; os ecos mantêm a orientação da imagem original.
- **Procissão espectral:** um único espectro encapuzado, com máscara vazia e boca larga em grito, percorre uma órbita oval pelas laterais do personagem. A cabeça permanece legível enquanto uma onda contínua de tecido alonga e ondula a capa. A ilustração original tem transparência nativa; o processamento técnico somente reduz proporcionalmente e codifica em WebP. Vórtice de almas continua com seus dois espíritos anteriores.
- **Correntes cruzadas:** reconstruídas com dois fluxos curvos que atravessam o personagem, fitas afinadas e bordas em camadas translúcidas. Movimento advectivo e partículas seguem o campo de velocidade; sem os cinco carimbos rígidos de fumaça anteriores.

Arte, prompt integral, hashes, tamanho e revisão: \`data/vtt/spectral-procession-20261010.json\`. Originais do ImageGen preservados na pasta de geração. O novo helper carrega uma única imagem, sem cópias de fantasmas, leitura de pixels ou caches de tokens a cada quadro.

## Validação

\`scripts/review-vtt-spectral-water.mjs\` usa o renderer real e o componente React da galeria, com prévias de 152 × 112 px, mapa com personagem privado, desktop e celular. Confere:

- Superfície de água idêntica por pixels em três momentos; primeiro plano vazio.
- Rastro atrás em quatro rotações e dois espelhamentos, para duas artes distintas.
- Somente um espectro ilustrado, repartido entre as passagens de profundidade sem duplicação.
- Evolução temporal, deslocamento suave, movimento reduzido estável e quatro efeitos em aproximadamente 1,8 ms por quadro de submissão.
- Os outros 101 efeitos, excluindo a morte tratada separadamente, idênticos ao commit \`4a685db\` em três momentos. As superfícies de comparação usam Canvas com leitura frequente para evitar arredondamentos da GPU entre operações iguais; a galeria e o mapa mantêm seu renderer normal.
- TypeScript, build e a revisão geral de 105 efeitos e 16 assets animados aprovados.

A publicação usa quatro camadas incrementais sobre a versão da loja com 974 itens. O servidor permaneceu idêntico. Após publicação: 43 bundles, nova arte, 2.017 mídias da loja, três mídias recentes de Lava/Corrente elétrica e 21 mídias elementais anteriores conferidos por hashes. Todas as 60 tabelas e todas as ofertas mantêm linhas integrais iguais. Aplicação saudável; ilustrador PID 32176 disponível com heartbeat recente.

O preenchimento de todos os itens mágicos continua em andamento; esta revisão não altera o catálogo nem antecipa a importação dos focos de Eberron.
