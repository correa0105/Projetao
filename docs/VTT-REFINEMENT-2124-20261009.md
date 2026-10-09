# Refino visual do vídeo e das imagens — 09/10/2026

O vídeo de 56,53 segundos foi revisado integralmente. Modelos identificados: Maré de fogo, Cometas de brasas, Flor de gelo, Gaiola elétrica, Poça corrosiva, Salpicos corrosivos, Sopro venenoso, Espiral tóxica, Tornado de água, Cortina de chuva, Redemoinho de poeira, Correntes cruzadas, Véu de areia, Rajada de pressão, Flor de sombras, Rastro espectral, Chuva celeste, Fluxo restaurador e Fenda dimensional. As imagens acrescentam Raízes, Folhas ao vento, Coroa de espinhos, Medo, Correntes espectrais, Chamas de almas e Chamas.

## Mudanças

- Nove artes transparentes originais geradas individualmente com image_gen.imagegen: cipó folhado, cipó espinhoso, corrente de aço, aparição espectral, língua de fogo, corrente de água, vapor alongado, fluxo luminoso e esteira de espuma. WebP em `public/vtt/refined-2124-20261009/`; fontes e prompts completos em `data/vtt/refined-flow-2124-20261009.json`. O script `scripts/prepare-vtt-refined-flow.mjs` só redimensiona/converte o alpha nativo.
- Cipós e espinhos usam casca, nervuras e sombreamento reais; folhas usam o objeto nativo. Correntes encadeiam a textura dos elos continuamente sobre a curva, sem elos separados nem junções de vários arcos. Aparições têm crânio legível e cauda de vapor.
- Fogo ganha núcleo quente e filamentos luminosos; cometas têm núcleo, cauda e brasas. Água usa lâminas transparentes com espuma e refração; ácido usa poça/respingo/fluxo e vapor. Vento tem correntes longas deformadas, poeira em grãos e ondas de pressão. Descargas têm filamentos claros, brilho e ramificações. Gelo agrupa os cristais atrás do corpo, com partículas finas na frente. Luz/espectros têm correntes contínuas; a fenda tem abertura escura e bordas de energia.
- O renderer aplica esses materiais às famílias dos 40 efeitos adicionais, além dos modelos das imagens. IDs, sons, cor/tamanho/opacidade/duração, presets e regras existentes continuam compatíveis.
- A cor usa rotação de matiz preservando os detalhes e o núcleo claro, inclusive fogo azul. Cache de cores limitado a 32; imagens decodificadas uma vez. Água/vento/luz espirais usam atlas de UV polar contínuo com quatro fases e cache de 16, sem recortes de retângulos. Campos largos ficam atrás do corpo; partículas finas ficam na frente. Não há leitura de pixels por frame nem remoção de fundo em código.
- Barco conserva exatamente a oscilação e o giro existentes. A água perde as elipses desenhadas; duas esteiras de espuma advectam para a popa, alargam e desaparecem. Pausa, velocidade, intensidade, movimento reduzido e efeitos desligados seguem disponíveis.

## Validação

- TypeScript e build de cliente/servidor em checkout limpo, sem o protótipo pausado de monstros.
- Nove sprites com alpha nativo, margem transparente e nenhum corte opaco.
- 105 efeitos animados e 16 assets do catálogo instalado: movimento e estados estáveis reduzidos/desligados; nove novas artes efetivamente decodificadas, caches limitados e sem erro de navegador. A seleção legada de estandarte permanece compatível, mas não reaparece no catálogo.
- Pranchas e movimento revisados com os tokens privados de Irineu e Nana lidos sem alterações no banco. Fixtures e resultados privados permanecem em `.local`/`test-results`, fora do Git e da publicação.
- Seis composições simultâneas: média de submissão de desenho de 0,81 ms e cadência exibida de 5,55 ms no navegador com GPU. São medidas do fixture local, não uma garantia para qualquer mapa/dispositivo.
- Release conserva os controles de tamanho, materiais e a versão superior do moinho v4 instalada durante este trabalho, além da correção de direção `9578fcf`. Esses ajustes independentes não foram restaurados por uma cópia anterior do cliente, e seus arquivos locais foram preservados.
- Conservados fichas, estoque, cotas, compras e artes pessoais: auditoria de 61 tabelas e backup PostgreSQL validado de 475.008.106 bytes. Sessenta tabelas mantiveram linhas completas idênticas. Houve uma edição de sala durante a captura; seu `updated_at` precede a recriação do app, e a linha inteira permaneceu estável depois da atualização. Identidades dos tokens de criaturas e grades conferidas contra backup; remoção prévia de um moinho não foi revertida. Protocolo 8, sem schema/migration nova. O ilustrador continua no release vigente, sem reinício.

O trabalho 330 × 4 de monstros permanece pausado, preservado no checkout principal e excluído da versão instalada.
