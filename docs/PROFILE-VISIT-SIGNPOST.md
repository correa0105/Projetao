# Visita de perfil e placas — 07/10/2026

A visita de Personagens usa a mesma grade de 1.100 px, escala racial, proporção
contain e chão da aba padrão. O fundo ocupa um viewport, independente da altura
das avaliações abaixo. `CampBackdrop` compartilha o cálculo do enquadramento e
das brasas: base da fogueira a 66% da arte 1672×941, alinhada ao chão das figuras.
Montaria e mascote compartilham os mesmos hooks de posição do acampamento.
O tamanho opcional da espécie vem da ficha, sem expor o documento privado.

A chegada de detalhes antes do perfil também é tratada: a chave do perfil faz
os hooks medirem novamente quando os elementos realmente entram na página.
Não usar altura/posição provisórias como resultado final da visita.

`ProfileSignpost` substitui a caixa lateral por cinco placas: Personagens,
Conquistas, Hall da Fama, Ficha e Cartas. Hover, foco por teclado e aba ativa
destacam o contorno alpha da madeira. Nomes são texto HTML acessível sobre a
arte, sem espelhar letras quando a seta alterna de lado. O seletor no canto
superior direito troca o personagem visitado e seus companheiros/dados públicos;
não muda o personagem selecionado da conta visitante. A visita segue somente
consulta. Dados sociais, amizade e avaliações permanecem abaixo do cenário.

Artes originais produzidas pela imagegen integrada, com alpha real:

- `public/profile-signboard-v1.webp`: 2172×724; viewBox 15 100 2145 510.
- `public/profile-signpost-v1.webp`: 1139×1381; viewBox 520 15 100 1355.

As fontes PNG foram preservadas; WebP apenas converte o formato. A composição
é feita no DOM, com placas alternadas e haste ao fundo. Não inserir fundo opaco
na arte nem voltar à caixa de botões.

Prompts usados: uma placa única de nogueira envelhecida apontando à esquerda,
câmera frontal horizontal, centro vazio para rótulo HTML, bevel de madeira,
pequenos pregos de ferro/cantos de cobre, luz discreta de fogueira noturna,
realismo de fantasia medieval, transparência verdadeira, sem texto/cenário/sombra
externa; uma haste única de nogueira escura, vertical, estreita, câmera frontal,
veios verticais, extremidades arredondadas, mesma luz/realismo, sem placas,
letras, chão ou sombra externa, fundo transparente.

`node scripts/test-vtt-social-isolated.mjs --profile-browser` compara a visita
com a aba padrão em 1880×812, 1440×900, 768×900, 390×844 e 320×700. Verifica
chão, enquadramento, proporção/tamanho de atores e companheiros, navegação nas
cinco placas, contorno, teclado, seletor, carregamento de detalhes antes do perfil
e ausência de alterações nos bens/saldos. Capturas e métricas ficam em test-results.
