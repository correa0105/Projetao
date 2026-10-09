# Revisão dos 28 efeitos — 09/10/2026

Em **VTT → Efeitos → Biblioteca**, os IDs e os presets existentes continuam
selecionando os mesmos nomes. O desenho e a animação dos 28 itens indicados pelo
usuário foram revistos. Recarregar o VTT carrega o novo bundle.

| Nº  | Efeito                | Mudança                                                                              |
| --- | --------------------- | ------------------------------------------------------------------------------------ |
| 1   | Vórtice               | Campo espiral de vapor com densidade variável e poeira convergente.                  |
| 2   | Chamas                | Combustão com textura temporal; línguas e brasas se dissipam.                        |
| 3   | Lava                  | Somente fissuras: crosta escura, ramificações irregulares, interior quente estreito. |
| 4   | Bênção                | Penas em asas abertas e centelhas de luz, sem pentagrama.                            |
| 5   | Ressonância sonora    | Pacotes de pressão que se expandem em lobos e perdem intensidade.                    |
| 6   | Círculo infernal      | Coroa de combustão com densidade e bordas que evoluem.                               |
| 7   | Fogo azul             | Jatos convectivos independentes com núcleo claro.                                    |
| 8   | Tempestade elétrica   | Nuvens e descargas ramificadas entre vários pontos.                                  |
| 9   | Véu lunar             | Crescente prateado, véu suave e poeira lunar.                                        |
| 10  | Constelações          | Quatro grafos de estrelas com pulsos nos vínculos.                                   |
| 11  | Cometas orbitais      | Cabeças luminosas em órbitas diferentes e caudas afiladas.                           |
| 12  | Escudos espelhados    | Placas facetadas com reflexos da arte do token.                                      |
| 13  | Fúria                 | Combustão mais rápida, plumas irregulares e mais brasas.                             |
| 14  | Sono encantado        | Crescentes pequenos e motes em névoa lenta.                                          |
| 15  | Medo                  | Olhos que emergem e desaparecem em sombras.                                          |
| 16  | Cometas de brasas     | Cometas de fogo com caudas turbulentas e dissipação.                                 |
| 17  | Maré de fogo          | Frente de combustão ondulante.                                                       |
| 18  | Gêiser de chamas      | Ejeções de fogo e brasas saindo do centro.                                           |
| 19  | Espiral incandescente | Duas correntes de combustão espiraladas.                                             |
| 20  | Gaiola elétrica       | Canais ramificados entre emissores em volta do corpo.                                |
| 21  | Esferas de plasma     | Núcleos luminosos com filamentos internos e pontes elétricas.                        |
| 22  | Vórtice de tempestade | Vapor em espiral e descargas tangenciais.                                            |
| 23  | Coroa de descargas    | Descargas curtas independentes, sem um anel contínuo.                                |
| 24  | Sopro venenoso        | Exalações que se alargam e dispersam em pequenas correntes.                          |
| 25  | Correntes cruzadas    | Dois fluxos de ar que se cruzam com poeira e vapor fino.                             |
| 26  | Vórtice de almas      | Aparições que convergem em espiral e se dissolvem.                                   |
| 27  | Procissão espectral   | Figuras de manto seguindo uma órbita em fila.                                        |
| 28  | Rastro espectral      | Ecos da própria arte do token com uma esteira de vapor.                              |

**Fenda dimensional** não constou nos 28 pedidos e conserva seu renderer. Na
lava, a camada de fogo no chão e as emissões em primeiro plano foram conservadas.

Pedido posterior: remover apenas a fumaça do retrato lateral de seleção. Foram
retirados o canvas WebGL e os wisps sobrepostos; a URL da imagem, o recorte, o
rosto, o nome, o enquadramento responsivo e a seleção continuam iguais.
As 16 prévias no painel de assets continuam estáticas. A animação do barco e
sua esteira de espuma continuam no mapa.

## Implementação e fontes

`vtt-effects-rebuilt.ts` seleciona esses modelos antes dos renderers genéricos.
Os módulos separados de fogo, raios, magia e atmosfera têm composições próprias.
Nenhum ID, regra, duração, preset, som ou dado de sala foi migrado.

Sete campos originais têm 48 quadros por sequência, a 24 quadros/s, interpolados
na exibição. O gerador reproduz advecção periódica, deformação do domínio e
densidade em várias escalas. Os texels mudam ao longo da animação; não se trata
apenas de girar uma imagem. O período fecha sem salto. Atlas com bordas de
proteção e sete superfícies reutilizadas; nenhum cálculo de ruído por pixel ou
leitura de pixels no loop de animação. Fontes e hashes em
`data/vtt/temporal-fields-20261009.json`; gerador
`scripts/build-vtt-temporal-fields.py` (numpy e Pillow).

A aparição de manto é uma arte original criada com o **imagegen** integrado.
Alpha nativo conservado; apenas redução técnica e conversão para WebP.
Arquivo `public/vtt/temporal-20261009/spectral-pilgrim.webp`, fonte e prompt em
`data/vtt/spectral-pilgrim-20261009.json`. Não incorpora mídia JB2A.

Os raios usam deslocamento em várias escalas, bifurcações afiladas, núcleo
irregular e ataque/decaimento por descarga. A topologia não fica tremendo
continuamente durante a vida de um raio. Cache de fissuras limitado a 16
sementes, independente de tempo, cor ou token.

## Verificação

TypeScript e build da cópia limpa de release; teste dos 105 efeitos visuais e
16 assets, incluindo estados reduzidos/desligados. Revisão dos 28 com a arte
privada de Irineu em fixture ignorada, três pranchas e quadros de movimento.
Comparação de silhuetas mágicas/espectrais, continuidade das sete sequências e
estados reduzidos congelados. Teste existente do retrato atualizado para ausência
de fumaça e conservação do rosto em seis janelas e três escalas de tela.

A revisão técnica verifica movimento, integridade e composição; não representa
aprovação estética do usuário. Artes privadas dos jogadores não entram em Git
ou no diretório público. Protótipo dos 330 × 4 e alterações independentes de
assets são preservados e ficam fora deste commit.
