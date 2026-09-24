# Materiais PBR do atlas

Uso vigente em **23/09/2026**: o Mundo continua usando os mapas de cor de solo e rocha. A cena regional PBR descrita neste documento foi substituída por [Canvas 2D e sprites](KINGDOM-2D.md); os demais mapas permanecem como ativos históricos. Preservar a pasta, as licenças e o manifesto.

Obtidos em **17/09/2026**, diretamente da Poly Haven. São texturas de superfícies reais
para detalhar a geometria 3D do atlas: solo, rocha e terra. Não são mapas ilustrados
de continentes e não substituem o relevo, os prédios ou as árvores por imagens.

## Licença e origem

Os três conjuntos são disponibilizados sob **CC0 1.0**, conforme a
[licença oficial de assets da Poly Haven](https://polyhaven.com/license) e a indicação
CC0 em cada página de material. A licença permite redistribuição e uso comercial;
o crédito abaixo é preservado voluntariamente para documentar a procedência.
Referência da licença: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

| Uso no atlas | Material original e autores | Superfície |
| --- | --- | --- |
| `ground` | [Forest Ground 04](https://polyhaven.com/a/forest_ground_04), Rob Tuytel (fotografia/processamento) e Rico Cilliers (ajustes) | Solo florestal seco com pedrinhas, terra e detritos; castanho neutro, recebe o tom de musgo do cenário. Amostra de aproximadamente 3,2 m. |
| `rock` | [Dark Rock](https://polyhaven.com/a/dark_rock), Amal Kumar | Pedra escura com fissuras e estratos. Amostra de aproximadamente 2,4 m. |
| `soil` | [Brown Mud](https://polyhaven.com/a/brown_mud), Rob Tuytel | Terra compacta cinza-marrom, com pequenos gravetos e grãos, usada em caminhos. Amostra de aproximadamente 1,3 m. |

O material `ground` não é uma fotografia de musgo puro: sua cor original é castanha.
O verde-musgo escuro e dessaturado pertence à direção de cor do shader/cenário.
As escalas físicas de origem não definem o tamanho geográfico das regiões do atlas.

Os arquivos foram descobertos pela [API oficial](https://api.polyhaven.com/), usando
a documentação [OpenAPI](https://api.polyhaven.com/api-docs/swagger.json) e o endpoint
`GET /files/{id}`. Os [termos da API](https://github.com/Poly-Haven/Public-API/blob/master/ToS.md)
foram consultados antes do download. As requisições de preparação usaram o identificador
`User-Agent: Alvorada-Cinzenta-Asset-Preparation/0.1`.

A aplicação serve os arquivos locais; não precisa consultar a API nem a CDN da Poly Haven
durante o jogo. Nenhum token ou conta externa é necessário.

O refino do Mundo reutiliza `ground-color.jpg` e `rock-color.jpg` em `src/world-relief.ts`: luminância fotográfica, variação de superfície e detalhe de normais por projeção triplanar. São cerca de 1,65 MB já presentes no projeto. As cores originais das fotos não tingem os biomas; pedra fica cinza e a vegetação permanece musgo. Falha/timeout de oito segundos mantém o material procedural. O Mundo não carrega os nove mapas completos utilizados na visão do reino.

## Arquivos entregues

Pasta: `public/atlas-materials/`. Todos os nove arquivos têm **1024 × 1024 pixels**, JPEG
original da distribuição 1K, sem recorte, redimensionamento, recoloração ou recompressão.

| Arquivo local | Mapa | Bytes | URL exata do download |
| --- | --- | ---: | --- |
| `ground-color.jpg` | Difusa/albedo | 1.113.899 | [forest_ground_04_diff_1k.jpg](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/forest_ground_04/forest_ground_04_diff_1k.jpg) |
| `ground-normal.jpg` | Normal OpenGL | 1.326.812 | [forest_ground_04_nor_gl_1k.jpg](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/forest_ground_04/forest_ground_04_nor_gl_1k.jpg) |
| `ground-roughness.jpg` | Rugosidade | 627.507 | [forest_ground_04_rough_1k.jpg](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/forest_ground_04/forest_ground_04_rough_1k.jpg) |
| `rock-color.jpg` | Difusa/albedo | 533.128 | [dark_rock_diff_1k.jpg](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/dark_rock/dark_rock_diff_1k.jpg) |
| `rock-normal.jpg` | Normal OpenGL | 1.006.770 | [dark_rock_nor_gl_1k.jpg](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/dark_rock/dark_rock_nor_gl_1k.jpg) |
| `rock-roughness.jpg` | Rugosidade | 585.646 | [dark_rock_rough_1k.jpg](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/dark_rock/dark_rock_rough_1k.jpg) |
| `soil-color.jpg` | Difusa/albedo | 501.955 | [brown_mud_diff_1k.jpg](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brown_mud/brown_mud_diff_1k.jpg) |
| `soil-normal.jpg` | Normal OpenGL | 1.011.780 | [brown_mud_nor_gl_1k.jpg](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brown_mud/brown_mud_nor_gl_1k.jpg) |
| `soil-roughness.jpg` | Rugosidade | 340.815 | [brown_mud_rough_1k.jpg](https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brown_mud/brown_mud_rough_1k.jpg) |

**Total dos JPEGs: 7.048.312 bytes**, aproximadamente 7,05 MB / 6,72 MiB.
O pequeno `manifest.json` contém, para cada arquivo, origem, dimensões, tamanho e MD5.
Os nove checksums foram comparados aos fornecidos pelo endpoint oficial e coincidiram.
As dimensões foram verificadas abrindo os arquivos locais, e as três imagens de cor
foram inspecionadas visualmente.

Metadados originais:

- [Arquivos Forest Ground 04](https://api.polyhaven.com/files/forest_ground_04)
- [Arquivos Dark Rock](https://api.polyhaven.com/files/dark_rock)
- [Arquivos Brown Mud](https://api.polyhaven.com/files/brown_mud)

## Contrato de integração

- Caminhos públicos: `/atlas-materials/{ground,rock,soil}-{color,normal,roughness}.jpg`.
- Cor/albedo deve ser interpretada em **sRGB**; normal e rugosidade são dados lineares.
- As normais são **OpenGL (+Y)**, não DirectX. Não inverter o canal verde inadvertidamente.
- Repetição, escala, mistura entre materiais, tom de musgo e intensidade da normal
  são definidos pelo renderer; preservar os originais para facilitar auditoria e ajustes.
- `rock-color.jpg` é escuro na origem. Evitar multiplicá-lo por uma cor quase preta,
  pois isso pode esconder seu relevo sob a iluminação noturna.
- Nenhum mapa de displacement/altura, pacote Blender, render de demonstração ou imagem
  de um mapa inteiro foi baixado. O formato e a silhueta continuam vindo da geometria 3D.
- Não há textura de madeira separada neste conjunto; não atribuir uma origem fotográfica
  independente a materiais derivados por tingimento de `ground`, `rock` ou `soil`.
