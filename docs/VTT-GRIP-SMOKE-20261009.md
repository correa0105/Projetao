# Empunhadura e fumaça de seleção — 09/10/2026

Armas versáteis enviavam o texto de apresentação, como `1d8 (1d10 com duas mãos)+2`, ao parser de dados. Agora `sheetAttacks` separa o dado básico e `versatileDice`; nenhuma anotação faz parte da rolagem. O parser conserva seus limites.

Em Ficha → Ataques → Armas na mesa, uma arma versátil oferece **Uma mão / Duas mãos**, com os respectivos dados. Duas mãos limpa e desativa a mão secundária. Armas que exigem duas mãos continuam usando ambas; armas sem variante não recebem dano inventado. A escolha persiste por sala na migration 089, sem alterar equipamento ou estoque do site. Clientes anteriores que omitem o novo campo conservam a empunhadura se a arma principal não mudou.

A barra rápida usa o dano da arma ativa na sala, inclusive ao reabrir um atalho. Trocar a arma ou a empunhadura durante um ataque exige selecionar o ataque novamente, evitando rolar o dano da escolha anterior. Críticos continuam dobrando os dados e mantendo o modificador uma vez.

Refino posterior: o retrato foi ampliado dentro do efeito e ganha dissolução completa **antes** dos limites da imagem. Isso impede que o corte do busto deixe lados retos visíveis. A alternativa SVG também mantém a máscara dentro do enquadramento. A textura de fumaça continua além da silhueta, com fundo transparente.

O retrato de seleção conserva o recorte do peito ao rosto. A fumaça nativa agora tem advecção, redemoinhos e pequenos volumes que sobem em ciclos de 2,8 segundos, em um canvas WebGL pequeno. A imagem do rosto permanece estável; apenas a máscara das bordas se desfaz. A densidade foi reduzida para manter o personagem legível. O renderer libera recursos ao trocar a seleção e para quando a aba fica oculta. Movimento reduzido e efeitos desligados usam o retrato estático; navegadores sem WebGL têm a alternativa SVG.

Validação: TypeScript e builds; runner de banco descartável `scripts/test-vtt-weapons-portrait-isolated.mjs --unit` verifica todos os dados do catálogo e críticos; o runner sem `--unit` verifica titularidade, persistência, mãos conflitantes, seleção pela ficha, rolagem pela barra rápida, imagens privadas, movimento real entre dois frames e quatro larguras de tela. A revisão 330×4 continua pausada.
