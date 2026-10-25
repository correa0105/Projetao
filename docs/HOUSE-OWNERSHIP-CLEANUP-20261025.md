# Reset das quatro casas e exclusão de moradias

Pedido explícito: resetar as quatro casas mostradas e retirar a propriedade do
nana, além de remover casas de personagens excluídos, antigos ou futuros.

As imagens foram identificadas pelos modelos, acabamento e orientação. Alvos:
terrenos 1/5/8/10 do Bairro da Lareira, modelos 014/003/002/019. A quinta casa do
nana (terreno 4, modelo 001 com telhado de madeira girado 270 graus) não aparece
nos anexos e é conservada. Casas de Ubel Abuto ativo e Budah também são protegidas.

O reset devolve os quatro terrenos ao estado livre: sem dono/casa, transformações,
compra ativa, pintura, revestimentos ou porta aberta. Coordenadas, dimensões,
preço e posição na vila permanecem. Mobília colocada é guardada na coleção da
própria conta, com luz apagada; IDs, compras, escala e rotação preservados. Nenhum
ouro, crédito de House, coleção ou histórico de compra é reembolsado/apagado.

Migration 125 cria `release_house2_plots`, idempotente e serializada com a edição
dos layouts, e um trigger de exclusão lógica de personagem. A mesma transação
que exclui a ficha libera todos os seus terrenos, retira seus tokens da vila e
remove sua casa antiga com presenças/convites/mensagens dessa casa. Coleções e
auditorias de compras/presentes/recompensas continuam gravadas. Personagens
ativos e casas de terceiros não são atingidos. Não há novo endpoint público.

A migration limpa também personagens já excluídos. Na descoberta havia um
terreno vazio ainda preso à ficha antiga e excluída de Ubel Abuto e uma casa
antiga pertencente ao Irineu excluído; ambos entram na correção retroativa.

Validação em PostgreSQL local UUID descartável: 21 testes aprovados, incluindo
exclusão pela API com confirmação/titularidade, casa liberada na mesma transação,
repetição, reset restrito aos IDs, outra casa do mesmo dono preservada, coleção e
auditoria, vizinhos protegidos, tokens e limpeza da versão anterior. TypeScript
aprovado. Runners rejeitam o túnel 5437; nenhuma conta de teste em produção.

Backup completo e snapshot privado antes da alteração:
`/opt/alvorada/backups/house-ownership-before-20261025.dump` e
`/opt/alvorada/backups/house-ownership-before-20261025.json` (permissão 600).

Publicação e conferência da limpeza: em andamento.
