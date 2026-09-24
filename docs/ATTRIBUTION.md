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

`islands-map.png` foi uma referência histórica fornecida pelo usuário em 16/09/2026. O arquivo não é usado na aplicação atual e foi retirado do checkout; continua recuperável no histórico Git. Autoria/licença original não informadas.

`public/alvorada-fog.svg`: textura de nuvens procedural original, criada com filtros SVG. A referência de atmosfera é o mapa de Runeterra (https://map.leagueoflegends.com/); nenhuma imagem, áudio ou código da Riot foi incluído.

## Histórico dos ícones medievais

Os seis desenhos iniciais em src/GuildIcons.tsx eram vetores originais, desenhados para este projeto com inspiração estética na referência enviada pelo usuário (tinta marrom sobre pergaminho). Não são recortes ou cópias da prancha de referência. Os demais ícones funcionais continuam usando Lucide.

## Arquipélago da apresentação

O arquipélago anterior foi uma ilustração original gerada com imagegen integrada. Prompt em docs/ARQUIPÉLAGO-PROMPT.md. O arquivo foi retirado do checkout por não ser usado; pode ser recuperado no histórico Git. Não usa recursos da Riot.

## Mapa continental e relevo metálico

A versão continental anterior da apresentação/login foi criada com imagegen integrada. Prompt: docs/CONTINENTES-PROMPT.md. O arquivo foi retirado do checkout e permanece no histórico Git. O site https://map.leagueoflegends.com/ foi consultado como referência visual; geografia original, sem importar recursos da Riot. Os ícones SVG foram redesenhados com acabamento metálico em cobre, inspirados nas referências de pergaminho e bolsa fornecidas pelo usuário.

## Atlas ilustrado atual

O primeiro atlas ilustrado do menu substituiu os antigos desenhos SVG. Foi gerado com imagegen integrada a partir da prancha fornecida pelo usuário, que autorizou seguir de perto a espada, o livro e o mapa. Foi retirado do checkout após a nova versão ativa; prompt e técnica histórica em docs/ICONES-PROMPT.md. Demais controles continuam usando Lucide.

## Vela e capacete

public/guild-icons-candle-helmet.png é a versão ativa do atlas, editada com imagegen integrada. Vela adaptada da nova referência fornecida pelo usuário; capacete viking de fantasia criado no mesmo estilo. Prompt completo em docs/VELA-CAPACETE-PROMPT.md. public/dock-grain.svg é uma textura procedural original.


## Mapa ativo de apresentação — Alvorada Cinzenta

public/alvorada-map-v2.png é o mapa da apresentação/login, com grandes regiões e relevo, criado com imagegen integrada. A captura de Runeterra fornecida pelo usuário serviu como referência de composição. Geografia original, sem texto incorporado. Prompt completo e dimensões reais: docs/ALVORADA-MAPA-V2-PROMPT.md. A versão anterior foi retirada do checkout e permanece no histórico Git; prompt em docs/ALVORADA-MAPA-PROMPT.md. Este ativo é independente da ilustração do Mundo.

## Silhueta e relevo do Mundo

`public/atlas-world-v2.png` foi editada com imagegen integrada a partir da silhueta cartográfica fornecida pelo usuário e preservada em `docs/references/world-silhouette.png`. A referência geográfica foi incorporada a pedido dele; sua autoria/licença original não foi informada. A edição removeu os textos e preservou a geografia. A entrega plana foi substituída: o PNG agora fornece apenas máscara costeira e distribuição dos biomas para um terreno gerado em código. Prompt e resolução nativa de 1672 × 941 px em [ATLAS-WORLD-V2.md](ATLAS-WORLD-V2.md). Runeterra orientou a direção artística; nenhum asset da Riot foi incorporado.

Mundo usa geometria de relevo, rios, oceano e nuvens procedurais em Three.js (licença MIT), com câmera navegável. A visão do reino mantém seu módulo independente, carregado ao entrar na região. Detalhes em [ATLAS-WORLD-RELIEF.md](ATLAS-WORLD-RELIEF.md).

## Artes anteriores e visão do reino

`atlas-world.png` e `atlas-north.png` eram artes anteriores geradas com imagegen integrada para este projeto. Foram removidas do checkout e continuam no histórico Git. O site de Runeterra e o mapa regional enviado pelo usuário orientaram a interação e a direção artística; nenhum asset da Riot foi incluído. Prompts e técnica histórica em [ATLAS-PROMPTS.md](ATLAS-PROMPTS.md).

A antiga visão do reino usava geometria procedural original, com fallback em `atlas-north.png`. Overworld Audio (https://overworldaudio.com/) foi consultado como referência de profundidade e atmosfera; não foram copiados modelos, texturas ou código desse site. Essa técnica é histórica: [ATLAS-3D.md](ATLAS-3D.md). A visão regional atual é uma área vazia para compor com sprites de oito vistas, inspirados na leitura de Don't Starve, com arte medieval própria e sem ativos extraídos do jogo. Arquitetura em [KINGDOM-2D.md](KINGDOM-2D.md). As fontes de pinturas antigas foram retiradas do checkout e continuam no histórico Git.

As superfícies 3D regionais anteriores usavam **Forest Ground 04**, **Dark Rock** e **Brown Mud**, da Poly Haven, sob CC0. São nove mapas PBR de cor, normal e rugosidade preservados em `public/atlas-materials`. Mundo continua usando `ground-color.jpg` e `rock-color.jpg` como detalhe neutro de luminância e normais, preservando suas cores de biomas. Autores, fontes individuais, licença, dimensões e integridade dos arquivos estão registrados em [ATLAS-MATERIALS.md](ATLAS-MATERIALS.md). Não são pinturas de mapas nem recursos extraídos das referências de jogos.
