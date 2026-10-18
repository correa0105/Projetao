# Cem móveis novos e luzes nos objetos

As peças `furniture-151` a `furniture-250` ampliam o catálogo compartilhado em 100 itens individuais: assentos, mesas, camas, armazenamento, bancadas de ofício, cozinha, tecidos e decoração. Nenhum ID ou arquivo anterior foi substituído. A House 2.0 passa a ter 352 itens; o VTT mantém 250 peças na categoria Mobílias e outras 100 nas categorias externas/cidade, totalizando 350 peças compartilhadas.

## Arte

- Gerador: **imagegen integrado**, uma chamada por peça, transparência nativa, sem imagens externas incorporadas.
- Projeção: ortográfica vertical a 90°, com materiais medievais pintados e sombra de contato discreta. Treze projeções foram refinadas após revisão visual.
- Artes finais: `public/vtt/furniture-100-20261017/`, 100 WebPs com dimensão maior de 1280 px e margens transparentes.
- Miniaturas: `public/vtt/furniture-100-thumbs-20261017/`, 100 WebPs de até 192 px.
- Prompts finais e procedência: `data/vtt/furniture-100-20261017/final-prompts.json` e `completed/`.
- Pranchas de revisão: `data/vtt/furniture-100-20261017/review-1.png` a `review-5.png`.
- Catálogo consumido pelos dois sistemas: `shared/vtt-medieval-furniture-catalog.json`.

`scripts/plan-furniture-100-20261017.mjs` registra o planejamento; `scripts/prepare-furniture-100-20261017.mjs --apply` prepara arquivos/miniaturas e integra as peças quando as 100 estiverem prontas. As fontes originais ficam preservadas nos caminhos registrados nos manifests. O empacotamento apenas recorta o espaço vazio e ajusta a escala dentro do footprint, mantendo a proporção da imagem e sua transparência. `scripts/review-furniture-100-20261017.mjs` verifica hashes, unicidade, alfa, margens, dimensões e gera as pranchas.

## Luminárias da House 2.0

Clique na própria luminária para abrir Acender/Apagar junto ao objeto. A caixa acompanha a posição no mapa e se mantém dentro da tela; Enter/Espaço abrem, Escape fecha e devolve o foco. Editar objeto abre os controles completos. Arrastar continua movendo a peça. Ações só aparecem para o proprietário.

Lamparinas e pequenos suportes de velas são desenhados acima das mesas, independentemente da ordem de compra. A ordem armazenada e as revisões do layout são preservadas. O brilho agora é difuso, com oscilação discreta e sem núcleo circular opaco sobre o desenho. Paredes/portas continuam limitando a luz; persistência, som, fogueira contínua e movimento reduzido permanecem.

## Verificação

- TypeScript e build isolado do cliente/servidor, sem incluir o trabalho independente do VTT.
- 18 testes House 2.0: ownership, compra, concorrência, revisões, terreno, giro e bloqueio de luz por paredes/portas.
- 3 testes de catálogo, materiais e ordem das luminárias.
- `scripts/test-house2-isolated.mjs --item-actions`: clique, camada sobre mesa comprada depois, brilho sem núcleo opaco, teclado, arraste, persistência, visitante e larguras 1440/768/390/320.
- `scripts/test-house2-isolated.mjs --furniture`: 100 identidades nos dois sistemas, compra e colocação na House, busca responsiva em três larguras, colocação pela biblioteca do VTT e persistência dos 100 móveis na mesa.
- Auditoria dos 100 WebPs e 100 miniaturas, além da revisão visual das cinco pranchas.

A publicação local é aditiva: imagem Docker baseada na aplicação vigente, apenas novos bundles/artes e servidor com catálogo ampliado. Backup completo decodificado, sem migrations ou alterações deliberadas de dados. O verificador compara os arquivos antigos por SHA-256 e as tabelas públicas antes/depois (desconsiderando somente heartbeat do ilustrador). Registro local em `.local/furniture100-deployment-result.json`.

Publicação `furniture100-inline-lights-20261017` saudável: 238 arquivos novos, 15.379 arquivos anteriores preservados e todas as 138 tabelas idênticas. Nenhuma migration. Backup validado de 512.019.904 bytes. As 200 artes/miniaturas e todos os novos bundles foram conferidos ao vivo por SHA-256.
