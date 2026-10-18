# Ícones das tags no estilo da referência — 18/10/2026

Os dez ícones foram refeitos com o ImageGen integrado usando a segunda imagem enviada pelo usuário como referência de desenho: contorno azul-preto forte, planos angulares, sombras chapadas, expressão exagerada e silhueta natural. Fundo transparente, sem medalhão, círculo ou borda. O cubo gelatinoso mantém a forma de cubo, sem inventar um rosto humanoide.

Arquivos finais: `public/tags/comic-heads-20261018/{bugurso,cubo-gelatinoso,esqueleto,gnoll,goblin,hobgoblin,kobold,ogro,orc,zumbi}.webp`. Os PNGs originais foram codificados para WebP de 256 px com alfa preservado e sem recortar ou alterar a composição. A apresentação usa `object-fit: contain`, fundo transparente e nenhum recorte ou borda circular. Cabeças com orelhas e chifres permanecem inteiras. O fundo de madeira e as contagens das tags são preservados.

Referência visual preservada em `docs/references/tag-head-style-20261018.png`. Prompts completos, arquivos nativos de origem e hashes/URLs finais estão em `data/tag-comic-heads-20261018.json`. Uma chamada independente por criatura; ferramenta integrada, sem API externa.

Prompt comum: criar um único ícone de cabeça de monstro usando a imagem anexada como referência de estilo, com contorno azul-preto, cel shading angular e cores fortes. Vista frontal, cabeça e pequena terminação do pescoço, margem transparente ao redor de orelhas/chifres/cabelo/queixo. Remover o fundo amarelo da referência; proibir círculos, molduras, medalhões, cenário, texto e marcas. Cada prompt acrescenta a anatomia e a paleta próprias do monstro.

QA: dez imagens distintas com alfa real, nenhuma moldura circular por CSS, fundo igual ao Catálogo de conquistas, carregamento e navegação sem erros; apresentação conferida em 1440, 1280, 768 e 390 px. Publicação somente do cliente e das dez mídias, preservando o servidor e os dados existentes.
