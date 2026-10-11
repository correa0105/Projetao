# Vinte novos efeitos da mesa — 10/10/2026

A biblioteca **Efeitos** do mestre passa de 127 para **147 modelos**. Os vinte novos modelos têm formas, materiais, movimento e sons próprios. Selecionar um modelo mostra uma prévia privada sobre o token; o editor mantém cor, tamanho, duração, aplicação, salvamento e uso na barra rápida.

| Modelo | Material e movimento |
|---|---|
| Plumas da fênix | Sete plumas de fogo com nervuras quentes e pontas que se desfazem. |
| Encruzilhada de prata | Quatro correntes entrelaçadas com nós que percorrem as curvas. |
| Coral arcano | Três conjuntos de ramos, brotos e terminações iluminadas. |
| Faixas de mercúrio | Faixas líquidas largas, dobras e reflexos nas cristas. |
| Tinta do abismo | Volumes de tinta escura, bordas violetas e vazios internos. |
| Lótus das marés | Pétalas de água translúcida com espuma irregular. |
| Pacto de espinhos | Ramos arqueados, espinhos e folhas com nervuras. |
| Queda de estrelas | Pequenos cometas com núcleos luminosos e caudas afiladas. |
| Estilhaços lunares | Fragmentos facetados que orbitam e giram sobre seu próprio eixo. |
| Mariposas solares | Asas superiores e inferiores batendo em ritmos distintos, com pó dourado. |
| Trama carmesim | Veios entrelaçados e pontos de luz que pulsam. |
| Lótus de geada | Cristais ramificados com faces preenchidas e nervuras frias. |
| Velas do éter | Membranas translúcidas que se dobram com bordas iluminadas. |
| Sol de obsidiana | Oito fragmentos escuros com fissuras quentes e brasas. |
| Raízes do trovão | Descargas bifurcadas que surgem e decaem em pulsos alternados. |
| Casulos de jade | Volumes transparentes com reflexos e nervuras internas. |
| Memórias de areia | Três correntes de areia, pequenas dunas e partículas nas cristas. |
| Cascata de opalas | Gotas preenchidas, reflexos, películas e deslocamento de órbita. |
| Fios da alma | Três fios sinuosos ligados a pequenas almas luminosas. |
| Respiração de nova | Frentes de pressão irregulares e filamentos de plasma. |

## Referências e fabricação

Referência visual indicada pelo usuário: [Pinterest — Magical Shader Effect: Ark Style](https://br.pinterest.com/pin/786089310021947590/). A prévia pública estava parcialmente coberta pelo painel de login. Na [biblioteca oficial JB2A](https://library.jb2a.com/), foram observadas as animações públicas Water Splash, Flames e Energy Field; Ice Spikes também consta como referência de cristais. Os arquivos produzidos aqui são materiais originais, gerados por campos de densidade contínuos com ruído, nervuras, faces, espuma e reflexos. Nenhuma mídia dos sites foi copiada.

Cada modelo usa 32 quadros transparentes de 224 × 224 pixels, em dois atlas WebP com padding. O ciclo dura cinco segundos e interpola quadros adjacentes, inclusive a passagem do último ao primeiro. O passe posterior fica atrás do personagem; o anterior usa máscara de profundidade e opacidade menor. Os formatos seguem a base do token e seus controles de giro, espelho e tamanho. As miniaturas permanecem estáticas até foco/hover e respeitam movimento reduzido.

O cache compartilha atlas e duas superfícies entre tokens/miniaturas e fica limitado aos vinte tipos. Alterar a cor não cria novas texturas. Cada modelo tem uma gravação estéreo original curta, sintetizada com envelope suave, sem clipping, usando os controles de som/volume já existentes.

Fontes: `shared/vtt-effects-living.ts`, `scripts/living-density-fields.mjs`, `scripts/bake-living-effects.ts` e `src/vtt-effects-living.ts`. Manifest com hashes das 40 animações e 20 sons e resultados da revisão: `data/vtt/living-effects-20261010.json`.

## Compatibilidade e validação

Os 127 IDs anteriores conservam ordem, regras, referências de mídia e comportamento. A comparação real em canvas conferiu os 126 renderers anteriores de efeitos; Morte segue seu componente próprio sem alteração. Protocolo 12 exige recarregar clientes do protocolo 11 antes de acessar a biblioteca ampliada. Cliente e servidor são publicados juntos, sem migration nova.

TypeScript/build e dez testes de biblioteca, geometria, projeção e footprint aprovados. A revisão Edge mediu visibilidade de todos os modelos, 190 comparações de geometria, movimento, continuidade do ciclo, transparência, cor branca personalizada, intensidade zero/parcial e movimento reduzido. Conferiu hashes/dimensões/alpha dos 40 atlas e duração, canais, pico, envelopes e unicidade dos vinte sons.

O teste integrado usa PostgreSQL descartável e navegação real: 41 modelos no editor, prévia privada, aplicação, presets dos vinte novos tipos, gravação/reload, permissões de mestre/jogador/espectador e bloqueio do protocolo anterior. Galeria e menus conferidos em 1440, 768, 390 e 320 pixels.

Publicação incremental `alvorada-cinzenta-app:living-effects-v1-20261010`, sobre a versão `weather-live-v2-20261010`. Rollback preservado em `before-living-effects-v1-20261010`. A imagem acrescenta as sessenta mídias e troca somente os bundles/HTML e servidor necessários. Verificações ao vivo comparam bytes das novas mídias, servidor, bundles, HTML sem cache e mídias anteriores, além das 113 tabelas completas estáveis e da disponibilidade do ilustrador.
