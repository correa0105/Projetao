# Retrato e fumaça de seleção — 09/10/2026

O usuário rejeitou a moldura de fumaça grossa. O retrato agora usa filamentos
individuais que sobem dos ombros e da base, com dispersão lateral e vida de 3,4 s.
A borda do busto dissolve com ruído fluido, enquanto rosto e cabelo permanecem
estáveis. Imagem, enquadramento, identidade e nome do personagem são preservados.

O WebGL compõe retrato e vapor na mesma superfície, com UV calculada pelo mesmo
`xMidYMin meet` do SVG, sem distorcer a imagem. Alfa pré-multiplicado conserva
os fios finos. Fallback SVG estático, movimento reduzido, efeitos desligados,
contexto gráfico perdido e redimensionamento mantêm o rosto e o quadro visíveis.
Recursos são liberados na troca da seleção e a animação para na aba oculta.

Textura original `public/vtt/effects/portrait-wisp-v2.webp`, criada com a ferramenta
built-in image_gen. Prompt e origem estão em `data/vtt/portrait-wisp-20261009.json`.
A imagem nativa foi revisada e reduzida tecnicamente para 640 px, preservando alfa.

Validação: TypeScript/build, seis tamanhos de janela/três densidades de pixels,
arte real privada em QA local, alternativas estáticas e teste de navegador da mesa
com ficha/armas/miniaturas/permissões. Refinamento de magias e áudio continua
em andamento por novo pedido do usuário; não confundir esta mudança com ele.
Protótipo 330 × 4 permanece pausado e excluído do release.
