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

Recuperação do Jackpot concluída usando o próprio pedido que falhou: retrato
aprovado original e o mesmo token com margem transparente. Revisão independente
somente de leitura aprovou todos os critérios, sem nova geração. A manutenção
exige conta/dono/ficha ativos, revisão 4, job original com falha, cota disponível
e ausência de outro pedido/proposta; usa `completeArt` para guardar uma proposta
pendente, mantendo o par ativo e contando um único uso após a conclusão.
Backup completo e snapshot privado antecedem a operação. Não aceitar a proposta
pelo proprietário nem recuperar personagens excluídos.

Ativado no ilustrador: código `cc07bc3ad3b1fe14e6f8ab54a2279f910cc68a37`,
enviado para Welson e sincronizado na Hostinger. Recarga supervisionada sob trava
das duas filas ociosas, PID 4188 → 34496; processo novo e heartbeat de 9 s
confirmados. O build produziu os mesmos três bundles do servidor: os 733 arquivos
publicados são idênticos por hash, portanto esta mudança exige somente recarregar
o worker local. Imagem web `character-art-choice-20261025` permanece vigente,
sem restart do site ou banco e sem migração.

O pedido original recuperado foi concluído como proposta privada; par atual,
BASE, revisão 4, escolhas e demais campos da ficha foram conferidos iguais
imediatamente após o checkpoint/entrega. Um único uso de geração, nenhum pedido
duplicado ou nova imagem gerada. Depois, o próprio dono escolheu aceitar em
25/10/2026 às 20:41:27 UTC: revisão 5 e retrato/token correspondem exatamente aos
bytes da proposta. A sincronização do VTT alterou somente a imagem do token do
Jackpot e a revisão/data da sala, como esperado pela aceitação. A auditoria do
backup confirmou esse único campo de cena alterado; não restaurar a edição do
proprietário ao comparar snapshots. As outras 38 artes e os outros 109 jobs,
House e hotbars permaneceram iguais. Alba continua com falha e sem cobrança.
Rotas privadas da proposta continuam retornando 401 sem sessão.

Backup completo privado: `/opt/alvorada/backups/vestir-reliability-before-20261025.dump`.
Snapshots de ficha/par e baselines de auditoria no mesmo diretório; arquivos de
recuperação têm acesso restrito. Nenhuma credencial ou imagem privada no Git.
