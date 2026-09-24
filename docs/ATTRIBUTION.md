# Fontes e atribuição

Este trabalho inclui material do **System Reference Document 5.1 (SRD 5.1)**, de
**Wizards of the Coast LLC**, disponível em
https://www.dndbeyond.com/srd e https://dnd.wizards.com/resources/systems-reference-document.
O SRD 5.1 é licenciado sob **Creative Commons Attribution 4.0 International (CC BY 4.0)**:
https://creativecommons.org/licenses/by/4.0/legalcode.

Os nomes dos equipamentos foram traduzidos para português e as descrições foram
resumidas/adaptadas. Preços, pesos e propriedades numéricas foram obtidos do dataset
do 5etools. Não há associação, patrocínio ou endosso por Wizards of the Coast ou 5etools.

## Catálogo

- Consulta: https://5e.tools/items.html
- Dataset: https://github.com/5etools-mirror-3/5etools-src
- Commit exato e data de importação: `data/catalog.json`.
- Importador: `scripts/import-catalog.ts`.
- Restrição: oito equipamentos identificados como `srd`, com `source=PHB` (2014).
- Snapshot conserva somente os campos necessários de cada item; não replica livros,
  ilustrações, texto de suplementos ou o conjunto completo do 5etools.
- O link específico de consulta é armazenado em `source_url` por item no PostgreSQL.

**Alvorada Cinzenta**, **Bastião da Alvorada**, localidades, personagens de demonstração,
missões e lore desta versão são conteúdo original do protótipo. As curvas cartográficas são SVG/CSS próprio. O brasão foi removido a pedido do usuário. A paisagem `public/alvorada-bastion.png`
foi criada com a ferramenta integrada imagegen; o prompt está em `docs/BASTIAO-PROMPT.md`.
Os ícones usam Lucide (licença ISC).

## Mapa de apresentação

O banner atual do Início, `public/alvorada-dawn-banner.png`, é arte original criada com imagegen integrada, sem neve, com fortaleza e vale ao amanhecer. Prompt em `docs/ALVORADA-BANNER-PROMPT.md`. A paisagem anterior `public/alvorada-bastion.png` foi preservada.

`public/islands-map.png`: imagem de referência fornecida pelo usuário em 16/09/2026 e incorporada a pedido dele. Autoria/licença original não informadas. O arquivo foi preservado; o efeito fosco é aplicado apenas pela interface em CSS.

`public/alvorada-fog.svg`: textura de nuvens procedural original, criada com filtros SVG. A referência de atmosfera é o mapa de Runeterra (https://map.leagueoflegends.com/); nenhuma imagem, áudio ou código da Riot foi incluído.

## Histórico dos ícones medievais

Os seis desenhos iniciais em src/GuildIcons.tsx eram vetores originais, desenhados para este projeto com inspiração estética na referência enviada pelo usuário (tinta marrom sobre pergaminho). Não são recortes ou cópias da prancha de referência. Os demais ícones funcionais continuam usando Lucide.

## Arquipélago da apresentação

public/alvorada-archipelago-previous.png é uma nova ilustração original gerada pela ferramenta imagegen integrada para o projeto. Prompt completo: docs/ARQUIPÉLAGO-PROMPT.md. Foi usado em uma versão anterior da apresentação e do login; não usa recursos da Riot.

## Mapa continental e relevo metálico

public/alvorada-map-previous.png é uma versão anterior da apresentação/login, criada com imagegen integrada. Prompt: docs/CONTINENTES-PROMPT.md. O site https://map.leagueoflegends.com/ foi consultado como referência visual; geografia original, sem importar recursos da Riot. O arquipélago anterior está preservado. Os ícones SVG foram redesenhados com acabamento metálico em cobre, inspirados nas referências de pergaminho e bolsa fornecidas pelo usuário.

## Atlas ilustrado atual

public/guild-icons-atlas.png substitui os antigos desenhos SVG do menu. Gerado com imagegen integrada a partir da prancha fornecida pelo usuário, que autorizou seguir de perto a espada, o livro e o mapa. Prompt e técnica de integração em docs/ICONES-PROMPT.md. Demais controles continuam usando Lucide.

## Vela e capacete

public/guild-icons-candle-helmet.png é a versão ativa do atlas, editada com imagegen integrada. Vela adaptada da nova referência fornecida pelo usuário; capacete viking de fantasia criado no mesmo estilo. Prompt completo em docs/VELA-CAPACETE-PROMPT.md. public/dock-grain.svg é uma textura procedural original.


## Mapa ativo de apresentação — Alvorada Cinzenta

public/alvorada-map-v2.png é o mapa da apresentação/login, com grandes regiões e relevo, criado com imagegen integrada. A captura de Runeterra fornecida pelo usuário serviu como referência de composição. Geografia original, sem texto incorporado. Prompt completo e dimensões reais: docs/ALVORADA-MAPA-V2-PROMPT.md. A versão public/alvorada-map.png foi preservada; prompt anterior em docs/ALVORADA-MAPA-PROMPT.md. Este ativo é independente da nova ilustração de Mundo.

## Silhueta e relevo do Mundo

`public/atlas-world-v2.png` foi editada com imagegen integrada a partir da silhueta cartográfica fornecida pelo usuário e preservada em `docs/references/world-silhouette.png`. A referência geográfica foi incorporada a pedido dele; sua autoria/licença original não foi informada. A edição removeu os textos e preservou a geografia. A entrega plana foi substituída: o PNG agora fornece apenas máscara costeira e distribuição dos biomas para um terreno gerado em código. Prompt e resolução nativa de 1672 × 941 px em [ATLAS-WORLD-V2.md](ATLAS-WORLD-V2.md). Runeterra orientou a direção artística; nenhum asset da Riot foi incorporado.

Mundo usa geometria de relevo, rios, oceano e nuvens procedurais em Three.js (licença MIT), com câmera navegável. A visão do reino mantém seu módulo independente, carregado ao entrar na região. Detalhes em [ATLAS-WORLD-RELIEF.md](ATLAS-WORLD-RELIEF.md).

## Artes anteriores e visão do reino

`public/atlas-world.png` e `public/atlas-north.png` são as artes anteriores geradas com imagegen integrada para este projeto. O site de Runeterra e o mapa regional enviado pelo usuário orientaram a interação e a direção artística; nenhum asset da Riot nem recorte daquela referência foi incluído nesses dois arquivos. Ambos são históricos e não substituem o Mundo nem o novo cenário regional. Prompts, dimensões reais e técnica histórica de relevo em [ATLAS-PROMPTS.md](ATLAS-PROMPTS.md).

A antiga visão do reino usava geometria procedural original, com fallback em `atlas-north.png`. Overworld Audio (https://overworldaudio.com/) foi consultado como referência de profundidade e atmosfera; não foram copiados modelos, texturas ou código desse site. Essa técnica é histórica desde 23/09/2026: [ATLAS-3D.md](ATLAS-3D.md). A visão regional atual usa chão ilustrado e sprites com oito vistas, inspirados na leitura de Don't Starve, com arte medieval própria e sem ativos extraídos do jogo. Arquitetura em [KINGDOM-2D.md](KINGDOM-2D.md); procedência e prompts dos novos ativos em [KINGDOM-ART.md](KINGDOM-ART.md).

As superfícies 3D regionais anteriores usavam **Forest Ground 04**, **Dark Rock** e **Brown Mud**, da Poly Haven, sob CC0. São nove mapas PBR de cor, normal e rugosidade preservados em `public/atlas-materials`. Mundo continua usando `ground-color.jpg` e `rock-color.jpg` como detalhe neutro de luminância e normais, preservando suas cores de biomas. Autores, fontes individuais, licença, dimensões e integridade dos arquivos estão registrados em [ATLAS-MATERIALS.md](ATLAS-MATERIALS.md). Não são pinturas de mapas nem recursos extraídos das referências de jogos.
