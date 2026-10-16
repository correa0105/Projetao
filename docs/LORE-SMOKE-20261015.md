# Fumaça escura nas margens da Lore — 15/10/2026

A fumaça ocupa a área externa ao contêiner da biblioteca, inclusive cabeçalho, margens e rodapé, atrás dos controles. No refino de 16/10, a pedido do usuário, o campo passou a quatro oitavas e volumes largos: ruído em escala de 620 px, deformação mais discreta, contraste reduzido e borda suave junto à leitura. Os filamentos claros e dobras apertadas foram removidos. As formas evoluem continuamente em ritmo lento, sem deslocar uma imagem plana nem criar emenda de ciclo. O fallback também usa gradientes mais escuros e suaves.

A máscara segue o retângulo real da biblioteca ao rolar e redimensionar a janela. O canvas é decorativo, não recebe foco nem cliques. O QA lê nove pontos do framebuffer a cada quadro e exige alpha zero dentro da área de leitura; capturas com/sem o canvas comparam somente o trecho visível, evitando a recomposição de textos causada por capturas de elementos maiores que a janela.

Superfície limitada a 1056 px de largura / 800 px de altura e 15 quadros por segundo. O loop pausa com a aba oculta; movimento reduzido mantém um quadro estático. Há fundo estático/gradiente suave para WebGL indisponível, e recursos GPU/eventos são descartados ao sair da Lore.

QA em 1898, 1440, 768, 390 e 320 px: leitura preservada, ausência de rolagem horizontal, máscara na rolagem, formas evoluindo lentamente, pausa, movimento reduzido, fallback e desmontagem. Nenhuma modificação de dados ou áudio.

O build Vite passa a gerar também as cópias gzip de JS/CSS, para que a otimização do beta continue funcionando em builds futuros sem comandos locais adicionais.
