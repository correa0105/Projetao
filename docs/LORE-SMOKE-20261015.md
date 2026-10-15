# Fumaça escura nas margens da Lore — 15/10/2026

A fumaça ocupa a área externa ao contêiner da biblioteca, inclusive cabeçalho, margens e rodapé, atrás dos controles. O campo procedural usa seis oitavas de ruído e camadas de deformação independentes para formar volumes, dobras e filamentos. As formas evoluem continuamente em ritmo lento, sem deslocar uma imagem plana nem criar emenda de ciclo.

A máscara segue o retângulo real da biblioteca ao rolar e redimensionar a janela. O conteúdo preserva seus pixels e seus controles: o canvas é decorativo, não recebe foco nem cliques. Arredondamento de composição de até um nível RGB foi observado no celular, sem sobreposição visual.

Superfície limitada a 1056 px de largura / 800 px de altura e 15 quadros por segundo. O loop pausa com a aba oculta; movimento reduzido mantém um quadro estático. Há fundo estático/gradiente suave para WebGL indisponível, e recursos GPU/eventos são descartados ao sair da Lore.

QA em 1898, 1440, 768, 390 e 320 px: leitura preservada, ausência de rolagem horizontal, máscara na rolagem, formas evoluindo lentamente, pausa, movimento reduzido, fallback e desmontagem. Nenhuma modificação de dados ou áudio.

O build Vite passa a gerar também as cópias gzip de JS/CSS, para que a otimização do beta continue funcionando em builds futuros sem comandos locais adicionais.
