# 25 plantas e 25 casas no VTT

Este guia registra a integração inicial. As correções posteriores de escala,
porta fechada persistida, visão interna/janelas, grid, troncos e navegação estão
em [VTT-SCENERY-CONTROLS-20261014.md](VTT-SCENERY-CONTROLS-20261014.md) e
substituem a descrição inicial de entrada sempre aberta e telhado sobre os tokens.

Atualização de 14/10/2026. As 50 artes foram concluídas e integradas à Biblioteca
→ Assets → Plantas/Casas, junto das árvores e pedras. O atalho
Cenários também continua disponível. O mestre pode pesquisar, abrir a
prévia, ajustar a escala, colocar no mapa ou arrastar uma peça. Miniaturas com
nomes abaixo da imagem cabem também na biblioteca do celular.

Plantas: 25 WebPs transparentes de até 768 px em public/vtt/plants-20261014;
originais em data/vtt/plants-sources-20261014. Casas: 25 telhados e 25 interiores
transparentes de 1024 px em public/vtt/houses-20261014; originais em
data/vtt/houses-sources-20261014. Imagegen embutido produziu uma imagem por
planta e uma imagem com duas camadas por casa. Os prompts completos estão em
data/vtt/plants-plan-20261014.json e data/vtt/houses-plan-20261014.json.
Registros de câmera, dimensões, registro das camadas e SHA-256 ficam nas pastas
*-completed-*. As artes anteriores continuam preservadas.

As casas são peças da camada Mapa. Cada uma tem um perímetro retangular de
paredes derivado de sua posição, tamanho, giro e espelhamento; a porta aberta
fica no centro da borda inferior. Os anexos decorativos não criam novas áreas
internas. As barreiras funcionam no cliente e no servidor. Excluir a casa
remove suas barreiras, sem deixar paredes soltas no documento.

O interior é desenhado sob os tokens e o telhado acima. Quando um token visível
entra no perímetro interno pela porta, o telhado desaparece; quando o último
sai, ele retorna. Salvar/recarregar recupera o estado pela posição dos tokens.
Não há novos campos no protocolo nem alterações de SQL. As casas antigas e
as regras das demais peças continuam preservadas.

Validação: TypeScript/build; 29 testes de geometria e movimento, cobrindo as
25 casas, giro, espelhamento, abertura, paredes, entrada/saída, remoção e
compatibilidade. Auditoria das 75 mídias: transparência, tamanho, proporção,
unicidade e integridade dos 50 originais. O navegador real confere o acesso pela aba Assets, o atalho Cenários, busca,
escala, arraste, persistência, três larguras, passagem pela porta, bloqueio de
paredes no servidor, permissão do jogador e todas as 25 combinações de telhado
e interior no renderer real. Testes usam bancos temporários isolados.

Scripts: scripts/test-vtt-nature-isolated.mjs,
scripts/verify-vtt-nature-assets.mjs e tests/vtt-houses.test.ts. Evidências em
test-results/vtt-nature. A publicação incremental acrescenta as 75 mídias e o
verso de corvo, além dos bundles revisados de cliente e servidor, preservando
os arquivos existentes e os dados de jogo. As alterações das cartas são
explicadas em CARD-INSPECTION-3D-20261013.md.

O checkpoint d142551 guardou as artes antes do reinício. Esta revisão conclui
a integração e os ajustes pendentes das cartas. Os trabalhos independentes
do checkout e o protótipo pausado dos monstros continuam separados.
