# Mastros superiores, menus de token e vínculo na posição — 26/10/2026

Correções pedidas pelas imagens: os mastros/velas de cinco barcos estavam em vista lateral sobre o casco; o controle Tamanho do token se repetia em carruagens e personagens; vincular centralizava o personagem no apoio e a ferramenta não deixava clara a direção do vínculo.

## Mastros e velas

Cinco coberturas originais novas via ferramenta embutida `image_gen`, com a câmera no zênite: galé, barco de quilha, drácar, navio à vela e navio de guerra. A ponta e a gávea do mastro aparecem pela parte superior, com vergas transversais e a vela encurtada pela projeção; nenhum eixo longitudinal de madeira representando o mastro deitado. Plano do PNG e plano da mesa conservam a proporção, mantendo circular o topo do mastro. Nas embarcações com vários mastros, cada conjunto tem recorte e registro próprio no Canvas.

PNGs originais transparentes em `public/vtt/vehicles-rigging-20261026/<id>-cover-v2.png`, sem conversão, compressão ou alteração de pixels. Prompts completos, caminhos e SHA-256 em `data/vtt/vehicle-rigging-20261026.json`. Casco, piso, remos, dimensões, outros sete veículos e os doze PNGs anteriores ficam intactos. `coverImage`/`coverPieces` em `shared/vtt-vehicle-art.json` atualizam a cobertura tanto na prévia quanto no mapa, inclusive tokens antigos que continuam com a imagem v1. Não reescrever documentos de salas. A camada superior inteira continua a 12% quando personagem visível estiver embaixo; máscara de alfa, giro, espelhamento e névoa conservados. O carregador da cena inclui as coberturas e mantém suas tentativas de recuperação.

## Controle de tamanho

O slider e o grupo Mais opções eram irmãos com a mesma chave React (`token.id`). A reconciliação em atualizações do menu podia conservar cópias de controles antigos. As chaves agora distinguem `scale-<id>` e `options-<id>`. Um controle de tamanho por menu, com PV, dimensões reais e proporção mantidos; sem limpeza manual ou ocultação de duplicatas no DOM.

## Vínculo

O servidor agora grava `offsetX=child.x-parent.x` e `offsetY=child.y-parent.y` para qualquer peça, preservando posição e orientação iniciais. Antes, personagens recebiam zero nos dois offsets e saltavam para o centro do apoio. Movimento, rotação, vínculos aninhados, limites/barreiras e permissões existentes continuam funcionando. Soltar conserva a posição atual. Veículos também podem ser apoio na camada Mapa, conservando o piso sob os passageiros; personagens permanecem na camada Tokens. Outros cenários no mapa não ganham essa permissão.

Uso: selecionar o personagem, clicar no ícone de corrente e escolher o apoio no mapa ou na lista. O painel **Vincular sem mover** identifica quem acompanha quem, oferece Escolher outra peça, Cancelar e Soltar vínculo. A seleção de apoio ignora o próprio personagem, permitindo clicar no veículo que estiver sob ele. O menu do token também oferece o mesmo controle Acompanha e Escolher apoio no mapa; removida a seleção antiga duplicada dentro de Mais opções. Personagens já vinculados pelo mestre exibem o apoio vigente. Nenhum vínculo existente é centralizado ou refeito automaticamente.

Protocolo VTT **27** exige atualizar clientes antigos antes de editar vínculos cujo apoio seja um veículo no mapa. Sem migration e sem mudança em dados, lojas, rolagens por slot, imagens de personagens ou regras de áudio. O ilustrador não participa das novas artes estáticas.

## Validação

- TypeScript, builds de cliente e servidor, verificação de espaços do Git.
- 17 testes de projeção/PNG/legados, vínculos, rotação, movimento e recuperação de imagens.
- Seis testes em PostgreSQL descartável: migração 127/histórico, dados por slot e compra de veículos; ampliados com vínculo sem deslocamento, manutenção do apoio no mapa, movimento/giro e soltura, além de permissões.
- `scripts/test-vehicles-slots-isolated.mjs --rigging`: navegador real, carruagem e personagem com seis atualizações de tamanho cada, abrir/fechar Mais opções, exatamente um slider antes/depois, quatro larguras 1440/1024/768/390, painel de vínculo e seleção real do apoio, posição/orientação conservadas ao vincular/soltar. Cinco coberturas e transparência verificadas no renderer. Evidências em `test-results/rigging-controls/`.

Publicação incremental a partir de `vtt-vehicles-slots-20261026`, preservando seus arquivos e mídias e conferindo hashes dos dados privados antes/depois. Atualizar página para receber as correções também nos veículos já colocados.

## Publicação confirmada

Ativo em https://alvoradacinzenta.com/ na imagem `vtt-rigging-controls-20261026`, fonte `e67187ca18afb63f80f571543cab11ed1ba896ee`. Arquivo de release SHA-256 `77ef5b033edc12e6a03ba4626b5bbd59519db8fae69fa64fe99c68ef60e51718`. Conferidos 49 arquivos novos, 1.019 anteriores, 46 respostas HTTPS, cinco PNGs de cobertura novos, doze PNGs anteriores e 241 áudios.

Backup completo `/opt/alvorada/backups/rigging-controls-before-20261026.dump`, configuração e snapshots privados antes/depois. Cinco mesas, quatro hotbars, 35 arquivos privados, 39 personagens/fichas, 26 slots, 190 linhas de inventário, 152 compras, oito retratos, sete tokens e 110 jobs conservaram seus hashes, incluindo documentos/vínculos e resultados/progresso dos slots. Ilustrador disponível e heartbeat recente, sem recarga necessária ou interrupção de trabalho. Nenhuma alteração de ficha/compra/mesa de teste criada em produção. Recarregar o VTT para protocolo 27.
