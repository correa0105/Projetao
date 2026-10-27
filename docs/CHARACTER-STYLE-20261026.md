# Roupa inicial, postura e bengala — 26/10/2026

Em Personagens → Criar personagem, depois dos seis atributos salvos no slot:

- Características físicas → Postura: padrão, ereta, levemente curvada ou curvada.
- Bengala de apoio: padrão, sem bengala ou bengala simples de madeira, independente da postura.
- Roupa inicial: quatro partes superiores, quatro calças compridas e quatro opções de calçado (incluindo descalço). Cor de cada peça, seis sugestões e seletor livre; faixa da cintura opcional, com cor própria conservada ao desligar.

As escolhas ficam em `choices.physicalTraits.posture/cane` e `choices.startingOutfit`, no JSON já existente. Schema estrito, cores hex validadas; nenhum campo atribuído aos legados e nenhuma migration de aparência. Trocar espécie/classe e retomar criação conserva a seleção. Nenhum bônus, arma, inventário, ouro, tamanho de regra ou cota extra.

Retrato, token, reparos e revisão recebem as mesmas escolhas. A roupa equipada substitui a base na sua posição. Sem faixa não remove cinto realmente equipado. Cores da roupa não recolorem corpo/metal. Calças continuam inteiras até tornozelos/calçado; sem trapos ou tecido atravessando membros. Sem seleção, manter o padrão anterior.

A referência de postura enviada é exemplo de inclinação do tronco e ombros, sem copiar sua identidade, caveiras ou equipamentos. Curvatura deliberada conserva anatomia e equilíbrio; revisão não deve endireitar o personagem. Bengala segura por mão livre, ponta no chão; ambas as mãos ocupadas preservam equipamentos e exigem transporte fisicamente apoiado. É acessório visual, sem perfil de cajado de combate. No token em zênite, tronco inclinado e bengala quase vertical têm projeção/oclusão reais, nunca figura frontal deitada ou haste estendida no piso.

Artes existentes permanecem: não foi solicitada geração para um personagem específico. As escolhas acompanham futuras gerações/Vestir, respeitando as substituições por equipamentos e o fluxo de escolha entre arte antiga/nova. O ilustrador precisa ser recarregado apenas com ambas as filas ociosas, sem interromper jobs.

Validação: TypeScript, builds, oito testes de schema/regras/Warforged; navegador real em 1440/768/390/320 px conferindo criação, cores, faixa, reconciliação, retomada e conclusão com fixture privada. Sete testes do pipeline de arte verificam geração/reparo/revisão/rejeição, par retrato/token, referências e transparência; fixture não representa uma imagem aprovada pelo ilustrador real. Resultados em `test-results/character-style` e logs `.local/style-*`.

A suíte histórica ampla `test-character-tokens-isolated` tem quatro cenários de API que não preparam os seis atributos exigidos desde o fluxo de slots e recebem 409 antes da operação que pretendiam testar. Os testes do pipeline e o fluxo novo de criação com atributos completos foram executados separadamente; essa limitação não deve ser relatada como suíte ampla aprovada.
