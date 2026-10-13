# Água, emendas de pintura, cartas e edição da House

As linhas grandes relatadas eram pixels semitransparentes nas bordas dos blocos
de 512 pixels do cache, não a grade da mesa. Cada bloco agora tem dois pixels de
margem com a pintura real dos vizinhos. A composição atribui cada pixel da tela
a um único bloco; zoom e câmera fracionários não abrem frestas nem duplicam
opacidade. O tamanho e a configuração da grade permanecem independentes.

O novo brush Água usa uma arte original, estática, verde-azulada. A espuma e o
raso acompanham o contorno combinado da água, sem círculos em cada passada.
Uma máscara pequena com margem vizinha gera a costa somente após mudanças na
pintura; o mapa usa o resultado em cache ao navegar. A margem aparece ao soltar
o pincel. Sobrepor terra, apagar, esconder ou mudar a opacidade de uma camada
atualiza a margem. Camadas, traços e borracha continuam no documento da mesa.
Cache de blocos permanece limitado a 96 MiB; máscaras, a 24 MiB.

Selecionar, seleção livre e régua estão no topo. Dados ficam depois de Névoa e
Camadas depois de Dados. Brush usa Paintbrush, distinto da caneta Pencil.
Desenho reúne caneta, formas e texto em um menu lateral. Formas conserva
retângulo, círculo, cone e linha em um segundo nível; Escape retorna ou fecha.

Cartas mostram quatro por página e detalhe ao lado. O bloco de história e
comentário foi retirado desse detalhe; a arte maior fica centralizada sobre nome,
raridade, descrição e ações. Compra, coleção e três espaços continuam existentes.

As novas artes individuais seguem estas raridades, sem escrever a raridade na
face da carta: Vigília e Corvo comuns/brancas; Espelho e Raízes incomuns/verdes;
Lua e Âncora raras/azuis; Último Corte muito rara/roxa; Trono Vazio lendária/laranja.
As comuns são mais simples e têm espaço branco. Detalhes crescem com a raridade.
Raras usam um brilho discreto e um ponto de luz; muito raras, três; lendárias,
cinco e um brilho mais intenso. Animação usa apenas opacidade e transformações,
respeita movimento reduzido e não aparece nas cartas pequenas equipadas.
Raridade é apresentação do catálogo; não acrescenta bônus, drops ou upgrades.
IDs, preços, disponibilidade e propriedade das cartas foram conservados.

Na House, oito alças nas bordas da seleção ajustam escala uniformemente,
mantendo proporção e contato no piso. Segurar uma alça não altera tamanho.
O botão direito abre o mesmo inspector junto do objeto, com posição limitada ao
viewport; Escape, clique externo ou fechar dismissam o menu. Os ajustes saíram
da lateral. Direção real, setas de vistas, distorção limitada, camadas, guardar,
leitura e salvamento continuam disponíveis e respeitam ownership/busy.

Artes foram geradas pelo image_gen embutido. Fontes originais, prompts e SHA-256:
`data/vtt/terrain-water-reviewed-20261013.json` e
`data/cards/tarot-rarity-reviewed-20261013.json`. Artes anteriores conservadas.

Validação: 42 combinações de textura/zoom/DPR com grid desligado sem frestas;
camadas semitransparentes sem bordas duplicadas; costa, cobertura por terra,
camada oculta e cache; brush/layers/borracha/performance; navegador real em banco
PostgreSQL descartável para ferramentas, cartas, compras e House; tamanho,
perspectiva, distorção, hold/drag e salvamento. Capturas em
`test-results/terrain-seams`, `test-results/tarot-art`,
`test-results/map-editor` e `test-results/house-item-menu`.
