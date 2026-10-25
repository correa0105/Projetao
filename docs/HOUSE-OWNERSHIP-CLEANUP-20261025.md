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

Publicado em `alvorada-cinzenta:house-ownership-cleanup-20261025`, código
`fdc77bd1351d54f1ca4876d8164f8b395f81e6a8`. Release acrescenta somente a migration;
115 arquivos anteriores de cliente, servidor, arte, dados e áudio conferidos por
hash, sem reconstruir ou recomprimir imagens. Migration registrada e trigger
habilitado. Ilustrador permaneceu online sem precisar ser recarregado.

Aplicação confirmada: quatro terrenos liberados e 22 móveis guardados. O terreno
do Ubel Abuto excluído foi liberado e a casa antiga do Irineu excluído removida.
Todas as demais linhas de terrenos e móveis, incluindo a outra casa do nana,
ficaram integralmente iguais. Comparação das coleções, saldos, compras e
auditorias passou. Nenhum terreno ou casa antiga continua vinculado a personagem
excluído. VTT, hotbars e PNG privado da Caverna preservados; saúde HTTPS 200,
acesso anônimo à House 401. Verificação de produção apenas por leitura após a
limpeza autorizada.

Resultado pontual no host:
`/opt/alvorada/releases/house-ownership-cleanup-20261025/reset-result.json`.
Scripts privados de manutenção e conferência em `.local/house-cleanup-*.mjs`
e `.local/verify-house-cleanup-20261025.mjs`; não reaplicar o reset a terrenos
que já tenham sido comprados novamente.
