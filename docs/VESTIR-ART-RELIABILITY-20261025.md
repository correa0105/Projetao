# Falhas de arte no Vestir

Feedback de 25/10: alguns pedidos do inventário geraram arquivos, mas não
entregaram um par aprovado. O ilustrador estava online; os dois pedidos recentes
consultados terminaram com falha na revisão, sem uso da cota mensal.

- Jackpot: o último token nativo tinha 1312 × 1199 pixels. O formato quadrado
  obrigatório impedia a entrega. O retrato já havia passado na revisão.
- Alba Stonebreaker: a última imagem não passou na composição. Uma nova revisão
  somente de leitura do mesmo PNG identificou bigode marrom visível apesar da
  opção Sem bigode; barba cheia marrom deveria permanecer. Não publicar a arte
  reprovada nem alterar a escolha do personagem para fazê-la passar.

Antes da revisão, tokens retangulares com transparência real agora recebem
somente margem alfa centralizada até formar um quadrado. Nenhum corte,
estiramento ou alteração dos pixels nativos. Não criar transparência artificial
em candidato opaco (mesmo que já possua canal alfa), nem ultrapassar o limite
de 40 megapixels. Originais de geração permanecem intactos. Validações de
silhueta, câmera, anatomia, roupa, aparência, cabelo/barba e dimensões mínimas
continuam obrigatórias; normalização de armazenamento existente conservada.

Vestir/Nova imagem com `replacement_revision` guarda o retrato aprovado no
checkpoint privado antes de gerar o token. Se a segunda etapa falhar, o retrato
não se perde. Checkpoint não altera arte ativa, BASE, revisão ou VTT. Jobs
legados sem esse campo mantêm o comportamento anterior. A entrega de um par
continua abrindo a escolha entre manter a imagem antiga ou usar a nova.

Falhas finais de composição/token passam a incluir até dois motivos concretos
da revisão no erro privado do pedido. Resumos por job ficam na pasta privada
`.local`, sem imagens incorporadas; referências e candidatos temporários
continuam sendo limpos. Não registrar credenciais ou transcrições do CLI.

Validação: 12 testes aprovados em PostgreSQL local UUID descartável, incluindo
pixels originais, duas orientações retangulares, idempotência, opacidade com e
sem alfa, revisão, checkpoint, decisão privada, cotas, inventário, exclusão e
VTT. TypeScript e build do servidor aprovados. Nenhuma mudança de interface,
migration, catálogo, limites ou mecanismo de geração.

Recuperação do Jackpot preparada usando o próprio pedido que falhou: retrato
aprovado original e o mesmo token com margem transparente. Revisão independente
somente de leitura aprovou todos os critérios, sem nova geração. A manutenção
exige conta/dono/ficha ativos, revisão 4, job original com falha, cota disponível
e ausência de outro pedido/proposta; usa `completeArt` para guardar uma proposta
pendente, mantendo o par ativo e contando um único uso após a conclusão.
Backup completo e snapshot privado antecedem a operação. Não aceitar a proposta
pelo proprietário nem recuperar personagens excluídos.
